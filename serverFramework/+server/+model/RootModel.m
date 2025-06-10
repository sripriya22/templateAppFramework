classdef RootModel < server.model.BaseObject
    % ROOTMODEL Root model class that manages object identity and serves as the root of the model hierarchy
    %   This class maintains a map of all objects in the model hierarchy and
    %   provides centralized UID management. It also manages event notifications for
    %   property changes in any object in the hierarchy.
    
    % Define custom events for model changes
    events
        % ModelChanged event occurs when any property in any model object is changed
        % Event data will include object path, property name, and new value
        ModelChanged
    end
    
    properties (Access=protected, Transient)
        % Map of UIDs to object references
        UidMap containers.Map
        
        % Next available UID (incremental integer)
        NextUid int64 = int64(1)

        % Transaction support for atomic registration
        % Whether we're in a transaction
        InTransaction logical = false
        
        % Saved state for rollback
        TransactionSnapshot struct = struct()
        
        % Objects pending registration
        PendingRegistrations cell = {}
        end
    
    methods
        function path = getPathFromUid(obj, uid, propertyName)
            % GETPATHFROMUID Convert a UID to a binding path
            %   Traverses the model to find the object with the given UID and returns
            %   its path in the format used by the binding framework
            %
            %   Parameters:
            %     uid - The UID of the object to find
            %     propertyName - The name of the property that changed (optional)
            %
            %   Returns:
            %     path - A string path in the format 'root.property.subproperty' or
            %            'root.array[0].property' compatible with the binding framework
            
            % Start the search from the root model
            path = obj.findObjectPath(obj, uid, "RootModel");
            
            if isempty(path)
                % If path not found, fall back to using the UID directly
                warning('Could not find path for object with UID %s', uid);
                path = uid;
            end
            
            % Append the property name to the path if provided
            if nargin > 2 && ~isempty(propertyName)
                path = sprintf('%s.%s', path, propertyName);
            end
        end
        
        function path = findObjectPath(obj, currentObj, targetUid, currentPath)
            % FINDOBJECTPATH Recursively search for an object with the given UID
            %   Returns the path to the object in binding framework format
            
            % Default arguments
            if nargin < 4
                currentPath = '';
            end
            
            % Check if current object has a UID property
            if isprop(currentObj, 'Uid') && strcmp(currentObj.Uid, targetUid)
                path = currentPath;
                return;
            end
            
            % Get all properties of the current object
            props = properties(currentObj);
            path = '';
            
            % Recursively search through properties
            for i = 1:length(props)
                propName = props{i};
                
                % Skip certain properties that shouldn't be traversed
                if strcmp(propName, 'Uid') || strcmp(propName, 'Parent') || strcmp(propName, 'UidMap') || ...
                   strcmp(propName, 'NextUid') || strcmp(propName, 'InTransaction') || ...
                   strcmp(propName, 'TransactionSnapshot') || strcmp(propName, 'PendingRegistrations')
                    continue;
                end
                
                try
                    propValue = currentObj.(propName);
                    
                    % Skip empty values
                    if isempty(propValue)
                        continue;
                    end
                    
                    % Handle arrays
                    if isvector(propValue) && ~ischar(propValue) && ~isscalar(propValue)
                        for j = 1:length(propValue)
                            % Build path with array notation
                            if isempty(currentPath)
                                nextPath = sprintf('%s[%d]', propName, j-1); % Zero-based indexing for JS
                            else
                                nextPath = sprintf('%s.%s[%d]', currentPath, propName, j-1);
                            end
                            
                            % Check if this array element is an object
                            if isobject(propValue(j))
                                subPath = obj.findObjectPath(propValue(j), targetUid, nextPath);
                                if ~isempty(subPath)
                                    path = subPath;
                                    return;
                                end
                            end
                        end
                    % Handle object properties
                    elseif isobject(propValue) && ~isvalid(propValue)
                        % Skip invalid objects
                        continue;
                    elseif isobject(propValue)
                        % Build path for nested object
                        if isempty(currentPath)
                            nextPath = propName;
                        else
                            nextPath = sprintf('%s.%s', currentPath, propName);
                        end
                        
                        % Recursively search in this object
                        subPath = obj.findObjectPath(propValue, targetUid, nextPath);
                        if ~isempty(subPath)
                            path = subPath;
                            return;
                        end
                    end
                catch ex
                    % Skip properties that can't be accessed
                    continue;
                end
            end
        end
        
        function obj = RootModel(data)
            % ROOTMODEL Constructor
            %   data: (Optional) Data structure to initialize the object from
            %
            % This is the root of the model hierarchy and manages object identity.
            % It maintains a map of all objects in the model hierarchy and
            % provides centralized UID management.
            
            % Call superclass constructor with empty rootModel (RootModel is its own root)
            obj = obj@server.model.BaseObject([]);
            
            % Initialize the UID map
            obj.UidMap = containers.Map('KeyType', 'char', 'ValueType', 'any');
            
            % Register self with UID 0
            obj.Uid = '0';
            obj.UidMap(obj.Uid) = obj; % Direct reference to self
            
            % Initialize from data if provided
            if nargin > 0 && ~isempty(data)
                % Use the standard BaseObject initialization
                obj = obj.initializeFromData(data, obj);
            end
        end
        
        function uid = registerObject(obj, modelObj)
            % REGISTEROBJECT Register an object in the UID map and assign it a UID
            %
            % Parameters:
            %   modelObj: The object to register
            %
            % Returns:
            %   uid: The assigned UID
            %
            % Note: If not already in a transaction, this method will create a
            % single-registration transaction. All registrations happen in transactions.
            
            % Check if we need to create a transaction
            createTransaction = ~obj.InTransaction;
            
            % Start transaction if needed
            if createTransaction
                obj.beginTransaction();
            end
            
            try
                % Generate a new UID
                uid = num2str(obj.NextUid);
                obj.NextUid = obj.NextUid + 1;
                
                % Add to map with direct reference 
                obj.UidMap(uid) = modelObj;
                
                % Also store the UID in the object
                modelObj.Uid = uid;
                
                % Create property change listeners for this object
                obj.createPropertyListeners(modelObj);
                
                % If we created a transaction, commit it
                if createTransaction
                    obj.commitTransaction();
                end
            catch e
                % If we created a transaction and encountered an error, roll it back
                if createTransaction
                    obj.rollbackTransaction();
                end
                rethrow(e);
            end
        end
        
        function unregisterObject(obj, uid)
            % Unregister an object from the UID map
            %
            % Parameters:
            %   uid: The UID of the object to unregister
            
            if obj.UidMap.isKey(uid)
                try
                    obj.UidMap.remove(uid);
                catch
                    % Ignore errors during cleanup
                end
            end
        end
        
        function targetObj = getObjectByUid(obj, uid)
            % Get an object by its UID
            %
            % Parameters:
            %   uid: The UID to look up
            %
            % Returns:
            %   targetObj: The object with the specified UID, or empty if not found
            
            if obj.UidMap.isKey(uid)
                weakRef = obj.UidMap(uid);
                if isvalid(weakRef)
                    targetObj = weakRef.get();
                    if isempty(targetObj) || ~isvalid(targetObj)
                        % Object was garbage collected, clean up
                        obj.unregisterObject(uid);
                        targetObj = [];
                    end
                else
                    % Weak reference is invalid, clean up
                    obj.unregisterObject(uid);
                    targetObj = [];
                end
            else
                targetObj = [];
            end
        end
        
        function uid = registerObjectWithUid(obj, modelObj, requestedUid)
            % REGISTEROBJECTWITHUID Register an object with a specific UID if possible
            %
            % Parameters:
            %   modelObj: The object to register
            %   requestedUid: The requested UID
            %
            % Returns:
            %   uid: The assigned UID (may not be the requested one if collision)
            %
            % Note: If not already in a transaction, this method will create a
            % single-registration transaction. All registrations happen in transactions.
            
            % Check if requestedUid is in use - if so, delegate to regular registration
            if obj.UidMap.isKey(requestedUid)
                % UID already in use, fall back to auto-generation
                uid = obj.registerObject(modelObj);
                return;
            end
            
            % Check if we need to create a transaction
            createTransaction = ~obj.InTransaction;
            
            % Start transaction if needed
            if createTransaction
                obj.beginTransaction();
            end
            
            try
                % Use the requested UID
                uid = requestedUid;
                
                % Update next available UID if necessary
                uidAsInt = str2double(uid);
                if ~isnan(uidAsInt) && uidAsInt >= obj.NextUid
                    obj.NextUid = uidAsInt + 1;
                end
                
                % Add to map with weak reference
                obj.UidMap(uid) = matlab.lang.WeakReference(modelObj);
                
                % Store UID in object
                modelObj.Uid = uid;
                
                % Create property change listeners for this object
                obj.createPropertyListeners(modelObj);
                
                % If we created a transaction, commit it
                if createTransaction
                    obj.commitTransaction();
                end
            catch e
                % If we created a transaction and encountered an error, roll it back
                if createTransaction
                    obj.rollbackTransaction();
                end
                rethrow(e);
            end
        end
    end
    
    methods (Access=protected)
        function onPropertyChanged(obj, src, event)
            % ONPROPERTYCHANGED Handle property change events from any model object
            %
            % Parameters:
            %   src: Source object (meta.property)
            %   event: Event data (event.PropertyEvent)
            %
            % This method is called when any property on any registered object changes.
            % It constructs event data with object UID, property name and new value,
            % then notifies listeners of the ModelChanged event.
            
            % Skip if the object doesn't have a UID (not yet registered)
            if isempty(event.AffectedObject.Uid)
                return;
            end
            
            % Notify listeners of the ModelChanged event
            notify(obj, 'ModelChanged', server.controller.ModelChangedEventData(event.AffectedObject, event.Source.Name));
        end
        
        function createPropertyListeners(obj, modelObj)
            % CREATEPROPERTYLISTENERS Create listeners for all observable properties
            %
            % Parameters:
            %   modelObj: The model object to create listeners for
            %
            % This method creates PostSet listeners for all SetObservable properties
            % of the given model object. These listeners will call onPropertyChanged
            % when properties change.
            
            % Get metaclass info for the object
            mc = metaclass(modelObj);
            
            % Loop through all properties with SetObservable attribute
            for i = 1:numel(mc.PropertyList)
                prop = mc.PropertyList(i);
                
                % Check if property is observable
                if prop.SetObservable
                    % Create a listener for this property's PostSet event
                    addlistener(modelObj, prop.Name, 'PostSet', @obj.onPropertyChanged);
                end
            end
        end
    end
    
    methods
        function beginTransaction(obj)
            % BEGINTRANSACTION Start an atomic registration transaction
            %   Call this before creating a group of objects that need to be registered atomically
            %   Must be followed by either commitTransaction or rollbackTransaction
            
            if obj.InTransaction
                error('Transaction already in progress');
            end
            
            % Snapshot current state for potential rollback
            obj.TransactionSnapshot.NextUid = obj.NextUid;
            obj.TransactionSnapshot.UidMapKeys = keys(obj.UidMap);
            
            % Mark that we're in a transaction
            obj.InTransaction = true;
            obj.PendingRegistrations = {};
        end
        
        function commitTransaction(obj)
            % COMMITTRANSACTION Commit all pending registrations
            %   Call this after successfully creating all objects in a transaction
            
            if ~obj.InTransaction
                error('No transaction in progress');
            end
            
            % Process all queued registrations
            % In this implementation, we don't actually queue registrations,
            % so there's nothing to do here except clear the transaction state
            
            % Clear transaction state
            obj.InTransaction = false;
            obj.TransactionSnapshot = struct();
            obj.PendingRegistrations = {};
        end
        
        function rollbackTransaction(obj)
            % ROLLBACKTRANSACTION Discard all pending registrations
            %   Call this if an error occurs during object creation in a transaction
            
            if ~obj.InTransaction
                error('No transaction in progress');
            end
            
            % Restore state from snapshot
            obj.NextUid = obj.TransactionSnapshot.NextUid;
            
            % Remove any UIDs that weren't in the original map
            currentKeys = keys(obj.UidMap);
            for i = 1:numel(currentKeys)
                key = currentKeys{i};
                if ~ismember(key, obj.TransactionSnapshot.UidMapKeys)
                    obj.UidMap.remove(key);
                end
            end
            
            % Clear transaction state
            obj.InTransaction = false;
            obj.TransactionSnapshot = struct();
            obj.PendingRegistrations = {};
        end
    end
end
