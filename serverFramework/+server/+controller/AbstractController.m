classdef AbstractController < handle
    % ABSTRACTCONTROLLER Base class for MATLAB controllers in the template app framework
    %   AbstractController serves as the base class for all MATLAB controllers
    %   that interact with JavaScript clients. It manages the HTML component,
    %   provides object path resolution, and maintains a reference to the root model.
    
    properties (Access=private)
        UIHTML matlab.ui.control.HTML {mustBeScalarOrEmpty} = matlab.ui.control.HTML.empty
    end
    
    properties (Access=protected)
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

    methods (Access={?ConfigController, ?testConfigController})
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

            obj.RootModel = obj.constructNewRootModel(obj, struct);
            
            obj.RootModel = rootModel;

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
            
            % No returned results
            results = struct;
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
            
            % Start from root model
            targetObj = obj.RootModel;
            
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
            
            tokens = regexp(segment, '^(.+)\[(\d+)\]$', 'tokens');
            if isempty(tokens) || numel(tokens{1}) ~= 2
                error('Invalid array segment format: %s', segment);
            end
            
            propName = tokens{1}{1};
            idx = str2double(tokens{1}{2});
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

    methods(Static)
        function testFcn()            
            disp("Called testFcn");
        end
    end
end

