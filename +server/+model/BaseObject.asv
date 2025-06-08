classdef BaseObject
    
    methods (Static)
        function targetObj = getObjectFromPath(rootObj, path)
            % GETOBJECTFROMPATH Traverses a hierarchical object structure to find a nested object
            %
            % This method navigates through a hierarchical tree of objects using
            % a path string and returns the target object. It supports both array
            % indexing and property navigation.
            %
            % Parameters:
            %   rootObj (BaseObject): The root object to start from
            %   path (string): Path string in format "prop1.prop2[0].prop3"
            %                  Empty path returns the root object itself
            %
            % Returns:
            %   targetObj: The target object found at the specified path, or empty if not found
            %
            % Example:
            %   obj = MyModel();
            %   target = BaseObject.getObjectFromPath(obj, "children[2].properties.color");
            arguments
                rootObj (1,1) BaseObject
                path (1,1) string
            end
            
            % Start with root object
            targetObj = rootObj;
            
            % If path is empty, return the root object itself
            if isempty(path)
                return;
            end
            
            % Split the path into segments by period
            segments = strsplit(path, '.');
            
            % Traverse the path segments
            try
                for i = 1:length(segments)
                    segment = segments{i};
                    
                    % Check if segment contains array indexing
                    if contains(segment, '[')
                        % Extract property name and index
                        [propName, indexStr] = strtok(segment, '[');
                        
                        % Extract numeric index from string like '[0]'
                        index = str2double(regexp(indexStr, '\d+', 'match'));
                        
                        % First access the property to get the array
                        if ~isempty(propName)
                            targetArray = targetObj.(propName);
                        else
                            % If no property name (path starts with index), use object directly
                            targetArray = targetObj;
                        end
                        
                        % Then access the array element
                        if index >= 1 && index <= length(targetArray)
                            targetObj = targetArray(index);
                        else
                            warning('Array index %d out of bounds for %s', index, propName);
                            targetObj = [];
                            return;
                        end
                    else
                        % Simple property access
                        if isprop(targetObj, segment) || isfield(targetObj, segment)
                            targetObj = targetObj.(segment);
                        else
                            warning('Property %s not found', segment);
                            targetObj = [];
                            return;
                        end
                    end
                end
            catch ex
                warning('Error traversing path: %s', ex.message);
                targetObj = [];
            end
        end
    end

end

