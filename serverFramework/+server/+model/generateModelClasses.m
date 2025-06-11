function generatedFiles = generateModelClasses(jsonFileOrDir, targetDir, options)
%GENERATEMODELCLASSES Generate MATLAB classes from JSON model definitions with package support
%   generateModelClasses(JSONFILE, TARGETDIR) generates MATLAB class files from JSON
%   model definitions. JSONFILE can be a single JSON file or a directory containing
%   multiple JSON files. TARGETDIR is the directory where the generated MATLAB
%   class files will be saved, with package directories created as needed.
%   
%   generateModelClasses(..., 'Overwrite', true) overwrites existing files
%   generateModelClasses(..., 'Verbose', true) shows detailed output
%   generateModelClasses(..., 'IsRoot', true) marks this as the root class (inherits from RootModel)
%
%   Example:
%       % Generate classes in a package directory
%       server.model.generateModelClasses('model.json', 'path/to/+myapp', 'Overwrite', true);
%
%   The generated classes will be placed in the appropriate package directory structure.
%   For example, if TARGETDIR is 'path/to/+myapp', the class files will be created in
%   'path/to/+myapp/@MyClass'.
% GENERATEMODELCLASSES Generate MATLAB classes from JSON model definitions
%   generateModelClasses(JSONFILE, TARGETDIR) generates MATLAB class files from JSON
%   model definitions. JSONFILE can be a single JSON file or a directory containing
%   multiple JSON files. TARGETDIR is the directory where the generated MATLAB
%   class files will be saved.
%   
%   generateModelClasses(..., 'Overwrite', true) overwrites existing files
%   generateModelClasses(..., 'AddToPath', true) adds the target directory to the MATLAB path
%   generateModelClasses(..., 'Verbose', true) shows detailed output
%
%   Example:
%       server.model.generateModelClasses('model.json', 'generated', 'Overwrite', true)

% Parse inputs
arguments
    jsonFileOrDir {mustBeTextScalar}
    targetDir {mustBeTextScalar}
    options.Overwrite (1,1) logical = false
    options.Verbose (1,1) logical = true
    options.IsRoot (1,1) logical = false
end

% Convert to full paths
jsonFileOrDir = fullfile(char(jsonFileOrDir));
targetDir = fullfile(char(targetDir));

% Ensure target directory exists and is writable
if ~exist(targetDir, 'dir')
    try
        mkdir(targetDir);
        if options.Verbose
            fprintf('Created target directory: %s\n', targetDir);
        end
    catch ME
        error('Failed to create target directory %s: %s', targetDir, ME.message);
    end
end

% Check if target directory is writable
[status, attr] = fileattrib(targetDir);
if ~status || ~attr.UserWrite
    error('Target directory is not writable: %s', targetDir);
end

% Process JSON files
if isdir(jsonFileOrDir)
    % Get all JSON files in directory
    files = dir(fullfile(jsonFileOrDir, '*.json'));
    jsonFiles = fullfile({files.folder}, {files.name});
else
    % Single file
    jsonFiles = {jsonFileOrDir};
end

generatedFiles = {};
for i = 1:length(jsonFiles)
    jsonFile = jsonFiles{i};
    [~, baseName] = fileparts(jsonFile);
    
    try
        % Read and parse JSON
        jsonText = fileread(jsonFile);
        jsonData = jsondecode(jsonText);
        
        % Validate JSON structure
        if ~isfield(jsonData, 'ClassName') || ~isfield(jsonData, 'Properties')
            warning('Skipping invalid JSON file (missing ClassName or Properties): %s', jsonFile);
            continue;
        end
        
        % Determine if this is the root class (from options or JSON)
        isRoot = options.IsRoot || (isfield(jsonData, 'IsRoot') && jsonData.IsRoot);
        
        % Get class name and determine superclass
        className = jsonData.ClassName;
        
        % Initialize pkgDir to targetDir by default
        pkgDir = targetDir;
        pkgName = '';
        
        % Handle package-qualified class names (e.g., 'pkg.ClassName')
        pkgParts = strsplit(className, '.');
        if numel(pkgParts) > 1
            % The class name is package-qualified
            pkgName = strjoin(pkgParts(1:end-1), '.');
            className = pkgParts{end};
            pkgDir = fullfile(targetDir, ['+' pkgName]);
            if ~exist(pkgDir, 'dir')
                mkdir(pkgDir);
            end
        end
        
        % Create class file directly in the package directory
        classFile = fullfile(pkgDir, [className '.m']);
        
        % Skip if file exists and not overwriting
        if exist(classFile, 'file') && ~options.Overwrite
            if options.Verbose
                fprintf('Skipping existing file: %s\n', classFile);
            end
            continue;
        end
        
        % Ensure package directory exists
        if ~exist(pkgDir, 'dir')
            mkdir(pkgDir);
            if options.Verbose
                fprintf('Created directory: %s\n', pkgDir);
            end
        end
        
        % Generate class content with proper package and superclass
        % If we have a package name from the class name, use that, otherwise use the directory name
        if isempty(pkgName) && ~isempty(regexp(pkgDir, '\+[^\/]+$', 'once'))
            % Extract package name from directory (e.g., '+gPKPDSimConfig' -> 'gPKPDSimConfig')
            pkgName = regexp(pkgDir, '\+([^\/]+)$', 'tokens');
            if ~isempty(pkgName)
                pkgName = pkgName{1}{1};
            end
        end
        content = generateClassContent(jsonData, pkgName, isRoot, options.Verbose);
        
        % Write to file
        fid = fopen(classFile, 'w');
        if fid == -1
            error('Could not open file for writing: %s', classFile);
        end
        
        % Write the content to file
        if iscell(content)
            % Content is a cell array of strings
            for j = 1:length(content)
                fprintf(fid, '%s\n', content{j});
            end
        else
            % Content is a single string
            fprintf(fid, '%s\n', content);
        end
        
        fclose(fid);
        
        % Add to generated files list
        generatedFiles{end+1} = classFile; %#ok<AGROW>
        
        if options.Verbose
            fprintf('Generated: %s\n', classFile);
        end
        
    catch ME
        warning('Error processing %s: %s', jsonFile, ME.message);
        if options.Verbose
            fprintf(2, 'Stack trace:\n');
            disp(ME.getReport());
        end
    end
end

    % Note: Path management should be handled by the calling code or startup script
    if options.Verbose && ~isempty(generatedFiles)
        fprintf('Generated %d model class files\n', numel(generatedFiles));
    end
end

function classContent = generateClassContent(jsonData, pkgName, isRoot, verbose)
    % Generate MATLAB class content from JSON definition

    % Initialize output
    classContent = '';

    % Determine superclass - always use server.model.BaseObject for non-root models
    if isRoot
        superClass = 'server.model.RootModel';
    else
        superClass = 'server.model.BaseObject';
    end

    % Determine the full class name for documentation
    if ~isempty(pkgName)
        fullClassName = [pkgName '.' jsonData.ClassName];
    else
        fullClassName = jsonData.ClassName;
    end

    % Start building class content
    classDef = sprintf('classdef %s < %s', jsonData.ClassName, superClass);

    % Initialize content with class definition
    content = {};
    content{end+1} = classDef;

    % Add class header comment
    if isfield(jsonData, 'Description') && ~isempty(jsonData.Description)
        content{end+1} = sprintf('    % %s', jsonData.Description);
        content{end+1} = '    %';
    end

    % Properties are separated into two blocks:
    % 1. ReadOnly properties (SetAccess=protected, GetAccess=public)
    % 2. Regular properties (Access=public)
    
    % Separate properties into regular and readOnly groups
    regularProps = {};
    readOnlyProps = {};
    
    % Add properties from JSON
    if isfield(jsonData, 'Properties')
        propNames = fieldnames(jsonData.Properties);
        for i = 1:numel(propNames)
            propName = propNames{i};
            prop = jsonData.Properties.(propName);
            
            % Determine if property is readOnly
            isReadOnly = isfield(prop, 'ReadOnly') && prop.ReadOnly == true;
            
            % Prepare property comment
            propComment = '';
            if isfield(prop, 'Description')
                propComment = ['        % ' prop.Description];
            end
            
            % Determine property type, size, and default value
            [propType, sizeStr, defaultValue] = getPropertyTypeAndSize(propName, prop, pkgName);
            
            % Ensure propType is properly qualified with package name if it's a custom type
            % Skip package qualification for primitive types and string types with validation
            if ~isempty(pkgName) && ~isempty(propType) && ...
                    ~strcmp(propType, 'string') && ...
                    ~strcmp(propType, 'double') && ...
                    ~strcmp(propType, 'logical') && ...
                    ~startsWith(propType, 'string {') ...
                if isempty(regexp(propType, '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$', 'once'))
                    propType = [pkgName '.' propType];
                end
            end
            
            % Create property declaration with size validation
            propDeclaration = '';
            if ~isempty(defaultValue)
                if ~isempty(sizeStr)
                    propDeclaration = sprintf('        %s %s %s = %s', propName, sizeStr, propType, defaultValue);
                else
                    propDeclaration = sprintf('        %s %s = %s', propName, propType, defaultValue);
                end
            else
                if ~isempty(sizeStr)
                    propDeclaration = sprintf('        %s %s %s', propName, sizeStr, propType);
                else
                    propDeclaration = sprintf('        %s %s', propName, propType);
                end
            end
            
            % Add to appropriate property group
            if isReadOnly
                if ~isempty(propComment)
                    readOnlyProps{end+1} = propComment;
                end
                readOnlyProps{end+1} = propDeclaration;
                readOnlyProps{end+1} = '';
            else
                if ~isempty(propComment)
                    regularProps{end+1} = propComment;
                end
                regularProps{end+1} = propDeclaration;
                regularProps{end+1} = '';
            end
        end
    end

    % Add readOnly properties block if any exist
    if ~isempty(readOnlyProps)
        content{end+1} = '    properties (SetObservable, GetAccess=public, SetAccess=?server.model.BaseObject)';
        % Add each property individually to avoid dimension mismatch
        for i = 1:numel(readOnlyProps)
            content{end+1} = readOnlyProps{i};
        end
        content{end+1} = '    end';
        content{end+1} = '';
    end
    
    % Add regular properties block if any exist
    if ~isempty(regularProps)
        content{end+1} = '    properties (SetObservable, Access=public)';
        % Add each property individually to avoid dimension mismatch
        for i = 1:numel(regularProps)
            content{end+1} = regularProps{i};
        end
        content{end+1} = '    end';
        content{end+1} = '';
    end

    % No explicit constructor needed - using BaseObject's constructor

    % Add methods section if needed
    if isfield(jsonData, 'Methods') && ~isempty(fieldnames(jsonData.Methods))
        content{end+1} = '    methods';
        % Add methods here if needed
        content{end+1} = '    end  % methods';
        content{end+1} = '';
    end

    % End of class definition
    content{end+1} = 'end  % classdef';

    % Return the content as a cell array for writing to file
    classContent = content;
    
    if verbose
        fprintf('Generated class content for %s\n', fullClassName);
    end
end

function [propType, sizeStr, defaultValue] = getPropertyTypeAndSize(propName, prop, pkgName)
    % Get property type, size, and default value from property definition
    % pkgName - The package name to use for custom types

    % Default values
    propType = '';
    sizeStr = '';
    defaultValue = '';

    if ~isfield(prop, 'Type')
        return;
    end

    % Get type and array info
    type = prop.Type;

    % Handle different types
    switch lower(type)
        case 'string'
            baseType = 'string';
            
            % Check if this string property has ValidValues for validation
            if isfield(prop, 'ValidValues') && ~isempty(prop.ValidValues)
                % Create the validation string using mustBeMember
                validValuesStr = '[';
                for i = 1:numel(prop.ValidValues)
                    if i > 1
                        validValuesStr = [validValuesStr ', ']; %#ok<AGROW>
                    end
                    validValuesStr = [validValuesStr '"' strrep(prop.ValidValues{i}, '"', '\\"') '"']; %#ok<AGROW>
                end
                validValuesStr = [validValuesStr ']'];
                
                % Add mustBeMember validation to the type
                baseType = ['string {mustBeMember(' propName ', ' validValuesStr ')}'];
            end
            
            if isfield(prop, 'DefaultValue')
                defaultValue = ['"' strrep(prop.DefaultValue, '"', '\\"') '"'];
            else
                defaultValue = '';  % Will be set to empty string for arrays if needed
            end
            
        case 'number'
            baseType = 'double';
            if isfield(prop, 'DefaultValue')
                defaultValue = num2str(prop.DefaultValue);
            else
                defaultValue = '';  % Will be set to 0 for arrays if needed
            end
            
        case 'boolean'
            baseType = 'logical';
            if isfield(prop, 'DefaultValue')
                if prop.DefaultValue
                    defaultValue = 'true';
                else
                    defaultValue = 'false';
                end
            else
                defaultValue = '';  % Will be set to false for arrays if needed
            end
            
        otherwise
            % Assume it's a custom class type
            baseType = type;
            % Always add package qualification for custom types if package name is available
            % and the type isn't already qualified
            if ~isempty(pkgName) && isempty(regexp(baseType, '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$', 'once'))
                baseType = [pkgName '.' baseType];
            end
            defaultValue = '';  % Will be set to empty for arrays if needed
    end

    % Handle array types
    isArray = isfield(prop, 'IsArray') && prop.IsArray;

    if isArray
        if isfield(prop, 'Size') && ~isempty(prop.Size)
            sizeStr = ['(' strjoin(cellfun(@num2str, num2cell(prop.Size), 'UniformOutput', false), ',') ')'];
        else
            % Default to column vector if size not specified
            sizeStr = '(:,1)';
        end
        
        % Set default value for arrays if not already set
        if isempty(defaultValue)
            if strcmp(baseType, 'string')
                defaultValue = 'string.empty';
            elseif strcmp(baseType, 'double')
                defaultValue = '[]';
            elseif strcmp(baseType, 'logical')
                defaultValue = 'false';
            else
                % For custom types, use the fully qualified type name with .empty
                if ~isempty(pkgName) && ~startsWith(baseType, [pkgName '.']) && ~startsWith(baseType, 'server.model.')
                    defaultValue = [pkgName '.' baseType '.empty'];
                else
                    defaultValue = [baseType '.empty'];
                end
            end
        end
    end

    % Set the return type
    propType = baseType;
    if ~isArray
        sizeStr = '(1,1)';
    end
end
