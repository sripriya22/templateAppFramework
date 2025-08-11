classdef AbstractController < handle
    % ABSTRACTCONTROLLER Base class for MATLAB controllers in the template app framework
    %   AbstractController serves as the base class for all MATLAB controllers
    %   that interact with JavaScript clients. It manages the HTML component,
    %   provides object path resolution, and maintains a reference to the root model.
    
    properties (Access=private)
        UIHTML matlab.ui.control.HTML {mustBeScalarOrEmpty} = matlab.ui.control.HTML.empty
    end
    
    properties (GetAccess=public, SetAccess=protected)
        RootModel server.model.RootModel {mustBeScalarOrEmpty} = server.model.RootModel.empty
    end
    
    methods
        function obj = AbstractController(uiHTML)
            arguments
                uiHTML = matlab.ui.control.HTML.empty
            end

            if ~isempty(uiHTML)
                obj.UIHTML = uiHTML;
                obj.UIHTML.HTMLEventReceivedFcn = @(source, event)dispatch(obj, source, event);
            end
        end
    end
    
    methods (Access=protected)
        function setupModelListeners(obj)
            % SETUPMODELLISTENERS Set up listeners for model changes
            %   This method sets up a listener for the ModelChanged event on the RootModel
            %   When a model property changes, it will notify the client
            
            if isempty(obj.RootModel)
                warning('Cannot set up model listeners: Root model not initialized');
                return;
            end
            
            % Create listener for ModelChanged events
            addlistener(obj.RootModel, 'ModelChanged', @obj.onModelChanged);
        end
        
        function onModelChanged(obj, ~, eventData)
            % ONMODELCHANGED Handle ModelChanged events from the RootModel
            %   This method is called when any property in the model hierarchy changes
            %   It notifies the client of the change via a server_notification event
            
            % Extract event data
            affectedObj = eventData.UpdatedObject;
            propertyName = eventData.PropertyName;
            
            % Get the object path for the changed object
            objectPath = obj.RootModel.getPathFromUid(affectedObj.Uid);
            
            % Create notification data
            notificationData = struct(...
                'EventID', 'SERVER_MODEL_PROPERTY_UPDATED', ...
                'EventData', struct(...
                    'ObjectPath', objectPath, ...
                    'PropertyName', propertyName, ...
                    'Value', affectedObj.(propertyName), ...
                    'Source', 'server'));
            
            % Send notification to client
            obj.notifyApp('server_notification', notificationData);
        end
    end

    methods (Access={?server.controller.AbstractController, ?testConfigController})
        function dispatch(obj, ~, event)
            eventData = event.HTMLEventData;
            reply = rmfield(eventData, "Args");

            try
                methodName = eventData.MethodName;
                
                targetObj = obj.getObjFromPath(eventData.ObjectPath);
                argsCell = namedargs2cell(eventData.Args);
                % Methods must return a struct as the output arg to
                % document exactly what is being returned
                reply.Results = targetObj.("handle_"+methodName)(argsCell{:});
                
                obj.notifyApp("matlab_method_call_response", reply);

            catch ex
                reply.Error = struct("id", ex.identifier, "message", ex.message);
                obj.notifyApp("matlab_method_call_error", reply);
            end
        end
    end

    % App-accessible API via dispatch
    methods (Access=protected)        
        function results = handle_resetRootModel(obj)
            arguments
                obj (1,1)
            end

            obj.RootModel = obj.constructNewRootModel(struct);
            
            % Set up listeners for model changes
            obj.setupModelListeners();

            results.RootModel = obj.RootModel.toData();
        end

        function results = handle_setRootModel(obj, inputs)
            arguments
                obj (1,1)
                inputs.RootModelData (1,1) struct
            end

            if ~isfield(inputs, "RootModelData")
                error("Missing required input field RootModelData.")
            end

            obj.RootModel = obj.constructNewRootModel(inputs.RootModelData);
            
            % Set up listeners for model changes
            obj.setupModelListeners();
            
            % No returned results
            results = struct;

            broadcastNotification = struct(...
                "EventID", "SERVER_MODEL_UPDATED", ...
                "EventData", struct(...
                    "Data", obj.RootModel.toData()));
            obj.notifyApp("server_notification", broadcastNotification);
        end
    end
    
    methods (Abstract, Access=protected)
        rootModel = constructNewRootModel(obj, rootModelData)
    end

    methods (Access=protected)
        function notifyApp(obj, eventName, eventData)
            if isempty(obj.UIHTML)
                % For testing
                disp(jsonencode(eventData));
            else
                sendEventToHTMLSource(obj.UIHTML, eventName, eventData);
            end
        end

        function targetObj = getObjFromPath(obj, path)
            % GETOBJFROMPATH Get object by path or UID
            %   obj.getObjFromPath(path) returns the object at the specified path
            %
            %   Path can be:
            %   1. Empty - returns the controller itself
            %   2. A UID string starting with 'uid:' - looks up in UID map
            %   3. A dot-separated path with array indices (e.g., 'children[2].property')
            %
            %   For UID format: 'uid:1234-5678-9012'
            
            % Handle empty path - return controller
            if isempty(path)
                targetObj = obj;
                return;
            end
            
            % Check for UID format - TODO: this is fragile code
            if startsWith(path, 'uid:')
                uid = path(5:end);  % Remove 'uid:' prefix
                if isempty(uid)
                    error('Invalid UID: empty UID provided');
                end
                targetObj = obj.getObjectByUid(uid);
                if isempty(targetObj)
                    error('Object with UID "%s" not found', uid);
                end
                return;
            end
            
            % Handle dot-separated path with array indices
            if isempty(obj.RootModel)
                error('Cannot resolve path: Root model not initialized');
            end
            
            % Start from controller
            targetObj = obj;
            
            % Split path into segments
            segments = strsplit(path, '.');
            
            for i = 1:length(segments)
                segment = segments{i};
                
                % Check for array indexing
                if contains(segment, '[') && segment(end) == ']'
                    % Extract property name and index
                    [propName, idx] = obj.parseArraySegment(segment);
                    
                    % Get array property
                    if ~isprop(targetObj, propName)
                        error('Property "%s" not found in object of type %s', ...
                            propName, class(targetObj));
                    end
                    
                    propValue = targetObj.(propName);
                    
                    % Validate array
                    if ~isvector(propValue) || ~isnumeric(idx) || idx < 1 || idx > numel(propValue)
                        error('Invalid array index %d for property "%s"', idx, propName);
                    end
                    
                    targetObj = propValue(idx);
                else
                    % Simple property access
                    if ~isprop(targetObj, segment)
                        error('Property "%s" not found in object of type %s', ...
                            segment, class(targetObj));
                    end
                    targetObj = targetObj.(segment);
                end
            end
        end
        
        function [propName, idx] = parseArraySegment(~, segment)
            % PARSEARRAYSEGMENT Parse array segment like 'property[1]'
            %   Returns property name and index
            %   NOTE: Paths from JavaScript use 0-based indices, but MATLAB uses 1-based
            %   This method automatically converts from JS 0-based to MATLAB 1-based
            
            tokens = regexp(segment, '^(.+)\[(\d+)\]$', 'tokens');
            if isempty(tokens) || numel(tokens{1}) ~= 2
                error('Invalid array segment format: %s', segment);
            end
            
            propName = tokens{1}{1};
            % JavaScript indices are 0-based, MATLAB indices are 1-based
            % Add 1 to convert from JS to MATLAB indexing
            idx = str2double(tokens{1}{2}) + 1;
        end
        
        function obj = getObjectByUid(~, uid)
            % GETOBJECTBYUID Get object by UID
            %   Override this method in subclasses to implement UID-based lookup
            %   Default implementation returns empty
            
            % In a real implementation, you would have a UID map:
            % obj = obj.UidMap(uid);
            
            % For now, return empty to indicate not found
            obj = [];
        end
    end    

    methods(Static, Access=protected)
        function filepath = getFilePath(mode, filepath, supportedExtensions)
            arguments
                mode (1,1) string {mustBeMember(mode, ["save", "load"])}
                filepath (1,1) string = missing
                supportedExtensions {mustBeText} = ''
            end

            if mode == "save"
                fcn = @uiputfile;
                title = "Save file";
            else
                fcn = @uigetfile;
                title = "Choose file";
            end

            if ismissing(filepath)
                % Prompt user for load location
                [filename, pathname] = fcn(supportedExtensions, title);

                % If user cancels, return
                if isequal(filename, 0) || isequal(pathname, 0)
                    error("User cancelled action");
                end

                filepath = fullfile(pathname, filename);
            end
        end
    end
end

