const { describe, test, expect, beforeEach, afterEach, beforeAll } = require('@jest/globals');
const { ModelClassDefinitionManager } = require('../model/ModelClassDefinitionManager.js');
const { loadTestDefinitions } = require('./test-utils');

describe('ModelClassDefinitionManager', () => {
  let manager;
  let definitions;

  beforeAll(async () => {
    // Load test definitions before any tests run
    definitions = await loadTestDefinitions();
  });

  beforeEach(() => {
    // Create a fresh manager instance before each test
    manager = new ModelClassDefinitionManager();
    // Register a base class for testing
    class BaseClass {}
    manager.registerClass('BaseClass', BaseClass);
  });

  test('should be able to register and retrieve a class', () => {
    class TestClass {}
    manager.registerClass('TestClass', TestClass);
    
    const retrievedClass = manager.getClass('TestClass');
    expect(retrievedClass).toBe(TestClass);
  });

  test('should throw when getting an unregistered class', () => {
    expect(() => manager.getClass('NonExistentClass')).toThrow('No class registered for: NonExistentClass');
  });

  test('should check if a class is registered', () => {
    class TestClass {}
    
    expect(manager.isClassRegistered('TestClass')).toBe(false);
    manager.registerClass('TestClass', TestClass);
    expect(manager.isClassRegistered('TestClass')).toBe(true);
  });

  test('should load definitions correctly', () => {
    manager.loadDefinitions(definitions);
    
    // Definitions should be loaded but not registered as classes yet
    expect(manager.isClassRegistered('BaseModel')).toBe(false);
    
    // But we can check if the definition exists by trying to generate a class
    const BaseModel = manager.generateClass('BaseModel', class {});
    expect(BaseModel).toBeDefined();
    expect(manager.isClassRegistered('BaseModel')).toBe(true);
  });

  test('should generate a class with the correct inheritance', () => {
    // First, register the base class definition
    manager.definitions.set('BaseClass', { ClassName: 'BaseClass' });
    manager.definitions.set('ChildClass', { 
      ClassName: 'ChildClass',
      Extends: 'BaseClass' 
    });
    
    // Generate the base class first
    const BaseClass = manager.generateClass('BaseClass', class {});
    
    // Then generate the child class
    const ChildClass = manager.generateClass('ChildClass', class extends BaseClass {});
    
    expect(ChildClass).toBeDefined();
    expect(new ChildClass()).toBeInstanceOf(BaseClass);
  });

  test('should throw when generating a class without a definition', () => {
    expect(() => {
      manager.generateClass('UndefinedClass', class {});
    }).toThrow('No definition found for class: UndefinedClass');
  });

  test('should clear all registered classes and definitions', () => {
    // Add a definition and register a class
    manager.definitions.set('TestClass', { ClassName: 'TestClass' });
    class TestClass {}
    manager.registerClass('TestClass', TestClass);
    
    expect(manager.isClassRegistered('TestClass')).toBe(true);
    expect(manager.definitions.has('TestClass')).toBe(true);
    
    manager.clear();
    
    expect(manager.isClassRegistered('TestClass')).toBe(false);
    expect(manager.definitions.has('TestClass')).toBe(false);
  });
});
