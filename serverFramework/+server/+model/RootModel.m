classdef RootModel < server.model.BaseObject
    % ROOTMODEL Root model class that manages object identity and serves as the root of the model hierarchy
    %   This class maintains a map of all objects in the model hierarchy and
    %   provides centralized UID management.
    
    properties (Access=protected, Transient)
        % Map of UIDs to weak references of objects
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
            obj.UidMap(obj.Uid) = matlab.lang.WeakReference(obj);
            
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
                
                % Add to map with weak reference
                obj.UidMap(uid) = matlab.lang.WeakReference(modelObj);
                
                % Also store the UID in the object
                modelObj.Uid = uid;
                
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
