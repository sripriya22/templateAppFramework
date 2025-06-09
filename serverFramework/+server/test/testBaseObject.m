classdef testBaseObject < matlab.unittest.TestCase
    % TESTBASEOBJECT Unit tests for BaseObject class
    %   This class contains tests for the BaseObject class's public API
    %   including serialization, deserialization, and object identity
    
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
        function testConstructorRestriction(testCase)
            % Test that BaseObject constructor is restricted
            import server.test.fixtures.TestConcreteObject;
            
            % Verify that direct creation fails
            testCase.verifyError(@() server.model.BaseObject(testCase.RootModel), ...
                'MATLAB:class:RestrictedAccess');
            
            % Verify that creation through concrete class works
            testCase.verifyWarningFree(@() TestConcreteObject(testCase.RootModel));
        end
        
        function testRegisterObject(testCase)
            % Test object registration
            import server.test.fixtures.TestConcreteObject;
            
            % Create test object
            obj = TestConcreteObject(testCase.RootModel);
            
            % Register object
            obj.register();
            
            % Verify UID is assigned
            testCase.verifyNotEmpty(obj.Uid, 'UID should be assigned after registration');
            
            % Verify object can be looked up by UID
            foundObj = testCase.RootModel.getObjectByUid(obj.Uid);
            testCase.verifyEqual(foundObj, obj, 'Should retrieve same object by UID');
        end
        
        function testRegisterWithUid(testCase)
            % Test registration with specific UID
            import server.test.fixtures.TestConcreteObject;
            
            % Create test object
            obj = TestConcreteObject(testCase.RootModel);
            
            % Register with specific UID
            requestedUid = 'test-123';
            obj.register_with_uid(requestedUid);
            
            % Verify UID is assigned as requested
            testCase.verifyEqual(obj.Uid, requestedUid, 'Should use requested UID');
            
            % Verify object can be looked up by UID
            foundObj = testCase.RootModel.getObjectByUid(requestedUid);
            testCase.verifyEqual(foundObj, obj, 'Should retrieve same object by requested UID');
        end
        
        function testToData(testCase)
            % Test serialization to data structure
            import server.test.fixtures.TestConcreteObject;
            
            % Create and register test object
            obj = TestConcreteObject(testCase.RootModel);
            obj.register();
            obj.Name = 'Test Object';
            obj.Value = 42;
            
            % Serialize to data structure
            data = obj.toData();
            
            % Verify data structure
            testCase.verifyTrue(isfield(data, 'Uid'), 'Data should contain Uid');
            testCase.verifyEqual(data.Uid, obj.Uid, 'Uid should match');
            testCase.verifyEqual(data.Name, 'Test Object', 'Name should be serialized');
            testCase.verifyEqual(data.Value, 42, 'Value should be serialized');
        end
        
        function testFromData(testCase)
            % Test deserialization from data structure
            import server.test.fixtures.TestConcreteObject;
            
            % Create test data
            testUid = 'test-from-data';
            testData = struct('Uid', testUid, 'Name', 'From Data', 'Value', 99);
            
            % Deserialize
            obj = TestConcreteObject.fromData('server.test.fixtures.TestConcreteObject', ...
                testData, testCase.RootModel);
            
            % Verify object properties
            testCase.verifyEqual(obj.Uid, testUid, 'Uid should be deserialized');
            testCase.verifyEqual(obj.Name, 'From Data', 'Name should be deserialized');
            testCase.verifyEqual(obj.Value, 99, 'Value should be deserialized');
        end
        
        function testNestedObjectSerialization(testCase)
            % Test serialization with nested objects
            import server.test.fixtures.TestConcreteObject;
            
            % Create parent and child objects
            parent = TestConcreteObject(testCase.RootModel);
            parent.register();
            child = TestConcreteObject(testCase.RootModel);
            child.register();
            
            % Set up parent-child relationship
            parent.Child = child;
            
            % Serialize parent
            parentData = parent.toData();
            
            % Verify child is serialized as UID reference
            testCase.verifyTrue(isfield(parentData, 'Child'), 'Child should be in data');
            testCase.verifyTrue(isfield(parentData.Child, 'Uid'), 'Child should be serialized as UID reference');
            testCase.verifyEqual(parentData.Child.Uid, child.Uid, 'Child UID should match');
            % Verify that parent references child correctly
            testCase.verifyEqual(parent.Child, child, 'Parent should reference child object');
            
            % Clean up dynamic property
            delete(dynamicPropInfo);
        end
        
        function testObjectDeletion(testCase)
            % Test that objects are unregistered when deleted
            
            % Create and register object
            obj = server.model.BaseObject(testCase.RootModel);
            obj.register();
            uid = obj.Uid;
            
            % Verify object is registered
            testCase.verifyNotEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be registered');
            
            % Delete object
            delete(obj);
            
            % Verify object is unregistered
            testCase.verifyEmpty(testCase.RootModel.getObjectByUid(uid), 'Object should be unregistered after deletion');
        end
    end
end
