function generateAppModels(appName, options)
% GENERATEAPPMODELS Generate all model classes for an application
%   generateAppModels(APPNAME) generates model classes for the specified app
%   
%   generateAppModels(..., 'TargetDir', TARGETDIR) specifies the output directory
%   generateAppModels(..., 'Overwrite', true) overwrites existing files
%   generateAppModels(..., 'AddToPath', true) adds the target directory to MATLAB path
%   generateAppModels(..., 'Verbose', true) shows detailed output
%
%   Example:
%       server.model.generateAppModels('gPKPDSimConfig', 'Overwrite', true)

% Parse inputs
arguments
    appName {mustBeTextScalar}
    options.TargetDir {mustBeTextScalar} = ''
    options.Overwrite (1,1) logical = false
    options.AddToPath (1,1) logical = true
    options.Verbose (1,1) logical = true
end

% Use current working directory as the base
appRoot = pwd; % Use the directory from which the function is called

% Set default target directory if not specified
if isempty(options.TargetDir)
    % Default to app's server/model directory
    targetDir = fullfile('apps', appName, 'server', 'model');
    % Create the directory if it doesn't exist
    if ~exist(targetDir, 'dir')
        mkdir(targetDir);
        if options.Verbose
            fprintf('Created directory: %s\n', targetDir);
        end
    end
else
    % Use provided target directory as-is (relative to current directory)
    targetDir = options.TargetDir;
end

% Ensure target directory exists and is writable
if ~exist(targetDir, 'dir')
    error('Target directory does not exist: %s', targetDir);
elseif ~isfolder(targetDir)
    error('Target path is not a directory: %s', targetDir);
elseif ~isempty(regexp(targetDir, '\s', 'once'))
    warning('Target directory contains spaces which may cause issues: %s', targetDir);
end

% Ensure target directory exists
if ~exist(targetDir, 'dir')
    mkdir(targetDir);
end

% Find all JSON files in the app's data-model directory
dataModelDir = fullfile('apps', appName, 'data-model');

% Ensure the data model directory exists
if ~exist(dataModelDir, 'dir')
    error('Data model directory not found: %s\nCurrent directory: %s', ...
        fullfile(pwd, dataModelDir), pwd);
end

% Get all JSON files in the data-model directory
jsonFiles = dir(fullfile(dataModelDir, '*.json'));

if isempty(jsonFiles)
    error('No JSON files found in %s. Current directory: %s', dataModelDir, pwd);
end

% Create the package directory structure
packageDir = fullfile(targetDir, ['+' appName]);
if ~exist(packageDir, 'dir')
    mkdir(packageDir);
    if options.Verbose
        fprintf('Created package directory: %s\n', packageDir);
    end
end

% Generate each model class
for i = 1:length(jsonFiles)
    jsonFile = fullfile(jsonFiles(i).folder, jsonFiles(i).name);
    
    if options.Verbose
        fprintf('Generating class for %s...\n', jsonFiles(i).name);
    end
    
    try
        % Read the JSON file to check if it's the root class
        jsonText = fileread(jsonFile);
        classDef = jsondecode(jsonText);
        
        % Determine if this is the root class
        isRoot = isfield(classDef, 'IsRoot') && classDef.IsRoot;
        
        % Generate the class in the package directory
        server.model.generateModelClasses(...
            jsonFile, ...
            packageDir, ...  % Output to package directory
            'Overwrite', options.Overwrite, ...
            'Verbose', options.Verbose, ...
            'IsRoot', isRoot);
            
        if options.Verbose
            fprintf('  -> Generated %s in %s\n', classDef.ClassName, packageDir);
        end
    catch ME
        warning('Failed to generate class for %s: %s', jsonFiles(i).name, ME.message);
    end
end

if options.Verbose
    fprintf('Done generating model classes in %s\n', targetDir);
end

% Add target directory to path if requested
if options.AddToPath && ~isempty(which('addpath'))
    addpath(targetDir);
    if options.Verbose
        fprintf('Added %s to MATLAB path\n', targetDir);
    end
end
end
