classdef TestConcreteObject < server.model.BaseObject
    % TESTCONCRETEOBJECT A concrete implementation of BaseObject for testing
    %   This class is used in unit tests to verify BaseObject functionality
    %   with a concrete implementation.
    
    properties
        % Test property for name
        Name char
        % Test property for value
        Value double
        % Test property for child object
        Child server.model.BaseObject
    end
    
    methods (Access={?server.model.RootModel, ?server.controller.AbstractController, ?matlab.unittest.TestCase})
        function obj = TestConcreteObject(rootModel)
            % Constructor
            %   Creates a new TestConcreteObject instance
            %
            % Parameters:
            %   rootModel: The root model to associate with this object
            
            % Call parent constructor
            obj = obj@server.model.BaseObject(rootModel);
        end
    end
end
