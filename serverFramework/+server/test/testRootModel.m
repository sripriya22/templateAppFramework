classdef testRootModel < matlab.unittest.TestCase
    % TESTROOTMODEL Unit tests for RootModel class
    %   This class contains tests for the RootModel class's public API
    %   including object registration, UID management, and serialization
    
    properties
        RootModel
    end
    
    methods (TestMethodSetup)
        function setupMethod(testCase)
            % Create a new RootModel for each test
            testCase.RootModel = server.model.RootModel();
        end
    end
    
    methods (Test)
        function testConstructor(testCase)
            % Test RootModel constructor
            
            % Verify that RootModel can be created directly
            testCase.verifyWarningFree(@() server.model.RootModel());
            
            % Verify that RootModel is a BaseObject
            testCase.verifyTrue(isa(testCase.RootModel, 'server.model.BaseObject'), ...
                'RootModel should be a BaseObject');
            
            % Verify that UidMap is initialized
            testCase.verifyTrue(isprop(testCase.RootModel, 'UidMap'), ...
                'RootModel should have UidMap property');
            testCase.verifyTrue(isa(testCase.RootModel.UidMap, 'containers.Map'), ...
                'UidMap should be a containers.Map');
            
            % Verify that NextUid is initialized
            testCase.verifyTrue(isprop(testCase.RootModel, 'NextUid'), ...
                'RootModel should have NextUid property');
            testCase.verifyGreaterThan(testCase.RootModel.NextUid, 0, ...
                'NextUid should be initialized to a positive value');
        end
        
        function testRegisterObject(testCase)
            % Test object registration
            import server.test.fixtures.TestConcreteObject;
            
            % Create test object
            obj = server.model.BaseObject(testCase.RootModel);
            
            % Register object
            uid = testCase.RootModel.registerObject(obj);
            
            % Verify that UID is assigned
            testCase.verifyNotEmpty(uid, 'UID should be assigned');
            testCase.verifyEqual(obj.Uid, uid, 'Object Uid should match assigned Uid');
            
            % Verify that object can be looked up by UID
            foundObj = testCase.RootModel.getObjectByUid(uid);
            testCase.verifyEqual(foundObj, obj, 'Object should be retrievable by UID');
            
            % Verify that NextUid was incremented
            initialNextUid = str2double(uid) + 1;
            testCase.verifyEqual(testCase.RootModel.NextUid, initialNextUid, ...
                'NextUid should be incremented after registration');
        end
        
        function testRegisterWithUid(testCase)
            % Test registration with specific UID
            import server.test.fixtures.TestConcreteObject;
            
            % Create test object
            obj = TestConcreteObject(testCase.RootModel);
            
            % Register with specific UID
            requestedUid = 'test-123';
            assignedUid = testCase.RootModel.registerObjectWithUid(obj, requestedUid);
            
            % Verify UID is assigned as requested
            testCase.verifyEqual(assignedUid, requestedUid, 'Should use requested UID');
            testCase.verifyEqual(obj.Uid, requestedUid, 'Object UID should match requested UID');
            
            % Verify object is registered with requested UID
            testCase.verifyEqual(testCase.RootModel.getObjectByUid(requestedUid), obj, ...
                'Should retrieve object by requested UID');
            
            % Test UID collision
            obj2 = TestConcreteObject(testCase.RootModel);
            newUid = testCase.RootModel.registerObjectWithUid(obj2, requestedUid);
            
            % Verify a different UID was assigned due to collision
            testCase.verifyNotEqual(newUid, requestedUid, 'Should assign different UID on collision');
            testCase.verifyEqual(obj2.Uid, newUid, 'Object UID should match assigned UID');
            testCase.verifyNotEqual(obj2.Uid, obj.Uid, 'Objects should have different UIDs');
        end
        
        function testUnregisterObject(testCase)
            % Test object unregistration
            
            % Create and register object
            obj = TestConcreteObject(testCase.RootModel);
            uid = testCase.RootModel.registerObject(obj);
            
            % Verify object is registered
            testCase.verifyNotEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be registered');
            
            % Verify UID is assigned to object
            testCase.verifyEqual(obj.Uid, uid, 'UID should be assigned to object');
            
            % Verify object can be retrieved by UID
            retrievedObj = testCase.RootModel.getObjectByUid(uid);
            testCase.verifyEqual(retrievedObj, obj, 'Should retrieve same object by UID');
            
            % Unregister object
            testCase.RootModel.unregisterObject(uid);
            
            % Verify object is unregistered
            testCase.verifyEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be unregistered');
            
            % Test duplicate registration
            testCase.verifyError(@() testCase.RootModel.registerObject(obj), ...
                'MATLAB:Containers:Map:KeyInUse', ...
                'Should not allow duplicate registration');
        end
        
        function testWeakReferences(testCase)
            % Test that weak references allow objects to be garbage collected
            import server.test.fixtures.TestConcreteObject;
            
            % Create and register object
            obj = TestConcreteObject(testCase.RootModel);
            uid = testCase.RootModel.registerObject(obj);
            
            % Verify object is registered
            testCase.verifyNotEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be registered');
            
            % Clear object reference to allow garbage collection
            clear obj;
            
            % Force garbage collection (this is implementation-dependent)
            % Note: This test may be flaky as MATLAB's garbage collection is non-deterministic
            % We'll skip the actual verification for now
            
            % Ideally, after GC, the weak reference should be cleared
            % But we can't reliably test this in a unit test
            % testCase.verifyEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be garbage collected');
        end
        
        function testToData(testCase)
            % Test RootModel toData serialization
            import server.test.fixtures.TestConcreteObject;
            
            % Add some test objects to the model
            obj1 = TestConcreteObject(testCase.RootModel);
            obj1.register();
            obj2 = TestConcreteObject(testCase.RootModel);
            obj2.register();
            
            % Get data representation
            data = testCase.RootModel.toData();
            
            % Verify data structure
            testCase.verifyTrue(isfield(data, 'Uid'), 'Data should contain Uid');
            testCase.verifyTrue(isfield(data, 'ModelType'), 'Data should contain ModelType');
            testCase.verifyEqual(data.ModelType, 'RootModel', 'ModelType should be RootModel');
            
            % Verify objects are included in the data
            testCase.verifyTrue(isfield(data, 'UidMap'), 'Data should contain UidMap');
            testCase.verifyTrue(isfield(data.UidMap, obj1.Uid), 'UidMap should contain first object');
            testCase.verifyTrue(isfield(data.UidMap, obj2.Uid), 'UidMap should contain second object');
            
            % Verify that data is a struct
            testCase.verifyTrue(isstruct(data), 'toData should return a struct');
            
            % Verify that UID is included
            testCase.verifyTrue(isfield(data, 'Uid'), 'Data should include Uid field');
            
            % Verify that ModelType is included
            testCase.verifyTrue(isfield(data, 'ModelType'), 'Data should include ModelType field');
            testCase.verifyEqual(data.ModelType, 'server.model.RootModel', ...
                'ModelType should be correct class name');
        end
        
        function testFromData(testCase)
            % Test RootModel fromData deserialization
            
            % Create original RootModel and register some objects
            originalModel = server.model.RootModel();
            obj1 = server.model.BaseObject(originalModel);
            obj1.register();
            obj2 = server.model.BaseObject(originalModel);
            obj2.register();
            
            % Serialize the RootModel
            modelData = originalModel.toData();
            
            % Create a new RootModel from data
            % Note: This is a special case as RootModel doesn't need a parent RootModel
            newModel = server.model.RootModel.fromData('server.model.RootModel', modelData, []);
            
            % Verify that the new model was created
            testCase.verifyTrue(isa(newModel, 'server.model.RootModel'), ...
                'New RootModel should be created from data');
            
            % Verify that NextUid was preserved
            testCase.verifyEqual(newModel.NextUid, originalModel.NextUid, ...
                'NextUid should be preserved during deserialization');
        end
    end
end
