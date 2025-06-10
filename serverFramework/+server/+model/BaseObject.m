classdef (Abstract) BaseObject < handle
    % BASEOBJECT Base class for all model objects in the template app framework
    %   This class provides common functionality for all model objects,
    %   including data serialization, object identity, and property change notifications.
    
    properties (GetAccess=public, SetAccess=protected)
        % Unique identifier for the object
        Uid char = '';
    end
    
    % This properties block is for model properties defined in derived classes
    % The SetObservable attribute enables property change notifications
    properties (GetAccess=public, SetAccess=public, SetObservable)
    end
    
    properties (Access=protected, Transient)
        % Direct reference to root model
        % Note: This creates a circular reference; future versions should use WeakReference
        RootModel
    end
    
    methods (Access={?server.model.BaseObject, ?server.controller.AbstractController, ?matlab.unittest.TestCase})
        function obj = BaseObject(rootModel, data)
            % CONSTRUCTOR Create a new BaseObject
            % 
            % Parameters:
            %   rootModel: The root model that will manage this object's identity
            %              Can be empty for RootModel itself
            %   data: (Optional) Data structure to initialize the object from
            % 
            % Note: This constructor is only accessible to RootModel, AbstractController,
            % and test classes to ensure proper object registration.
            
            % Handle the case where this is the RootModel itself
            if nargin == 0 || isempty(rootModel)
                return;
            end
            
            % Store direct reference to root model
            obj.RootModel = rootModel;
            
            % Initialize from data if provided
            if nargin > 1 && ~isempty(data)
                obj = obj.initializeFromData(data, rootModel);
            end
        end
        
        function register(obj)
            % REGISTER Register this object with the root model
            %   This assigns a unique ID to the object and registers it with the root model.
            
            if ~isempty(obj.RootModel)
                obj.Uid = obj.RootModel.registerObject(obj);
            end
        end
        
        function register_with_uid(obj, requestedUid)
            % REGISTER_WITH_UID Register this object with a specific UID
            %   This attempts to assign the requested UID to the object.
            %   If the UID is already in use, a new one will be assigned.
            %
            %   Parameters:
            %       requestedUid: The UID to request
            
            if ~isempty(obj.RootModel)
                obj.Uid = obj.RootModel.registerObjectWithUid(obj, requestedUid);
            end
        end
        
        function delete(obj)
            % Called when object is being destroyed
            % Unregister from root model if it still exists
            if ~isempty(obj.RootModel) && ~isempty(obj.Uid)
                try
                    obj.RootModel.unregisterObject(obj.Uid);
                catch
                    % Ignore errors during cleanup
                end
            end
        end
        
        function obj = initializeFromData(obj, data, rootModel)
            % INITIALIZEFROMDATA Initialize this object from a data struct
            %   This method populates properties from a data struct. It can be 
            %   overridden by subclasses for custom initialization.
            %
            %   Parameters:
            %       data: Struct containing property values
            %       rootModel: The root model to register with
            %
            %   Returns:
            %       obj: The initialized object (self)
            
            % Begin atomic transaction if this is a top-level object
            % and we're not already in a transaction
            isTopLevel = false;
            if ~isempty(rootModel) && ~isa(obj, 'server.model.RootModel')
                try
                    % Check if we can begin a transaction (this will fail if already in one)
                    rootModel.beginTransaction();
                    isTopLevel = true;
                catch
                    % Already in a transaction, this is a nested object
                    isTopLevel = false;
                end
            end
            
            try
                % Get public properties of this class
                publicProps = properties(obj);
                dataFields = fieldnames(data);
                
                % Store rootModel reference first (needed for nested objects)
                obj.RootModel = rootModel;
                
                % Process each field in the data struct
                for i = 1:numel(dataFields)
                    fieldName = dataFields{i};
                    
                    % Skip Uid field - will be assigned by rootModel.registerObject
                    if strcmp(fieldName, 'Uid')
                        continue;
                    end
                    
                    % Check if this is a public property
                    isProp = ismember(fieldName, publicProps);
                    if ~isProp
                        warning('Property %s not found in class %s. Ignoring.', ...
                            fieldName, class(obj));
                        continue;
                    end
                    
                    % Get field value and property meta information
                    fieldValue = data.(fieldName);
                    
                    % Set property value based on type
                    obj = obj.setPropertyFromData(fieldName, fieldValue);
                end
                
                % Now register with rootModel to get UID
                if ~isempty(rootModel)
                    % If data contains a UID, try to keep it
                    if isfield(data, 'Uid') && ~isempty(data.Uid)
                        % Use our register_with_uid method
                        obj.register_with_uid(data.Uid);
                    else
                        % Use standard registration
                        obj.register();
                    end
                end
                
                % If top-level object, commit the transaction
                if isTopLevel
                    rootModel.commitTransaction();
                end
            catch e
                % If error and top-level object, rollback the transaction
                if isTopLevel
                    rootModel.rollbackTransaction();
                end
                rethrow(e);
            end
        end
        
        function obj = setPropertyFromData(obj, propName, propValue)
            % SETPROPERTYFROMDATA Set a property value from data
            %   This method handles setting a property value based on its type,
            %   with special handling for nested objects and arrays.
            %
            %   Parameters:
            %       propName: Name of the property
            %       propValue: Value from data struct
            %
            %   Returns:
            %       obj: The updated object (self)
            
            % Handle empty values
            if isempty(propValue)
                obj.(propName) = propValue;
                return;
            end
            
            % If struct has a UID, check if we already have this object
            if isstruct(propValue) && isscalar(propValue) && ...
               isfield(propValue, 'Uid') && ~isempty(propValue.Uid) && ~isempty(rootModel)
                % Try to look up by UID
                existingObj = rootModel.getObjectByUid(propValue.Uid);
                if ~isempty(existingObj)
                    obj.(propName) = existingObj;
                    return;
                end
            end
            
            % Get property validators to determine required class
            mc = metaclass(obj);
            prop = findprop(obj, propName);
            
            % If we have property validators, use them to determine the class
            if ~isempty(prop) && isprop(prop, 'Validation') && ~isempty(prop.Validation)
                for i = 1:numel(prop.Validation)
                    validator = prop.Validation(i);
                    if isprop(validator, 'Class')
                        % We found a class validator
                        targetClass = validator.Class;
                        
                        % Handle arrays of objects
                        if iscell(propValue) || (isstruct(propValue) && numel(propValue) > 1)
                            % This is an array of objects
                            if iscell(propValue)
                                % Cell array
                                numElements = numel(propValue);
                                objArray = cell(size(propValue));
                                
                                % Process each element
                                for j = 1:numElements
                                    element = propValue{j};
                                    if isstruct(element) && isscalar(element)
                                        objArray{j} = feval(targetClass, obj.RootModel, element);
                                    else
                                        % Direct assignment for non-struct elements
                                        objArray{j} = element;
                                    end
                                end
                                
                                % Try to convert to array if possible
                                try
                                    obj.(propName) = [objArray{:}];
                                catch
                                    obj.(propName) = objArray;
                                end
                            else
                                % Struct array
                                numElements = numel(propValue);
                                objArray = cell(1, numElements);
                                
                                % Process each element
                                for j = 1:numElements
                                    objArray{j} = feval(targetClass.Name, obj.RootModel, propValue(j));
                                end
                                
                                % Convert to array
                                obj.(propName) = [objArray{:}];
                            end
                            return;
                        elseif isstruct(propValue) && isscalar(propValue)
                            % Single object
                            obj.(propName) = feval(targetClass, obj.RootModel, propValue);
                            return;
                        end
                    end
                end
            end
            
            % If we get here, just do direct assignment
            obj.(propName) = propValue;
        end
    end

    methods (Access=public, Hidden)
        function results = handle_updateProperty(obj, inputs)
            arguments
                obj (1,1)
                inputs.PropertyName (1,1) string = missing
                inputs.Value
                inputs.Source (1,1) string = ""
            end

            if ismissing(inputs.PropertyName)
                error("Must specify Property Name");
            end
            if ~isfield(inputs, "Value")
                error("Must specify new Value");
            end

            obj.setPropertyFromData(inputs.PropertyName, inputs.Value);

            % No return args
            results = struct;
        end
    end

    methods (Access=public)
        function data = toData(obj)
            % TODATA Convert object to data-only structure
            %   Returns a struct containing only public properties. For properties that
            %   are references to other objects not owned by this object, returns the UID 
            %   instead of the object to prevent recursive references.
            %
            %   Returns:
            %       struct: Data-only representation of the object
            
            % Get all public properties
            props = properties(obj);
            data = struct();
            
            for i = 1:numel(props)
                prop = props{i};
                value = obj.(prop);
                
                % Handle different property types
                
                % First check for vectors/arrays (must come before scalar object checks)
                if isvector(value) && ~ischar(value) && ~isstring(value) && numel(value) > 1
                    % Handle array types
                    if isempty(value)
                        data.(prop) = value;
                    elseif all(arrayfun(@(x) isa(x, 'server.model.BaseObject'), value))
                        % Array of BaseObjects - get full representation
                        dataArray = cell(1, numel(value));
                        for j = 1:numel(value)
                            dataArray{j} = value(j).toData();
                        end
                        data.(prop) = [dataArray{:}];
                    elseif all(arrayfun(@(x) isobject(x) && ismethod(x, 'toData'), value))
                        % Array of objects with toData method
                        dataArray = cell(1, numel(value));
                        for j = 1:numel(value)
                            dataArray{j} = value(j).toData();
                        end
                        data.(prop) = [dataArray{:}];
                    else
                        % Regular array
                        data.(prop) = value;
                    end
                % Then handle scalar objects
                elseif isa(value, 'server.model.BaseObject')
                    % If it's a BaseObject, get full representation
                    data.(prop) = value.toData();
                elseif isobject(value) && ismethod(value, 'toData')
                    % Object with toData method
                    data.(prop) = value.toData();
                else
                    % Regular value
                    data.(prop) = value;
                end
            end
        end
    end
    
    % No static methods needed - initialization is now handled in the constructor
end
