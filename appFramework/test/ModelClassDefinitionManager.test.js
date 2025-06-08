import { ModelClassDefinitionManager } from '../model/ModelClassDefinitionManager.js';
import fs from 'fs';
import path from 'path';

describe('ModelClassDefinitionManager', () => {
  let manager;
  let testBaseClassDef;
  let testChildClassDef;
  
  beforeEach(() => {
    // Create a fresh manager for each test
    manager = new ModelClassDefinitionManager();
    
    // Load test definitions from files
    testBaseClassDef = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data-models/TestBaseClass.json'), 'utf-8')
    );
    testChildClassDef = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data-models/TestChildClass.json'), 'utf-8')
    );
  });
  
  describe('Registration and Retrieval', () => {
    test('should register and retrieve class definitions', () => {
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef);
      
      const retrievedDef = manager.getDefinition('TestBaseClass');
      expect(retrievedDef).toBe(testBaseClassDef);
    });
    
    test('should register and retrieve class constructors', () => {
      class TestClass {}
      
      manager.registerClass('TestClass', TestClass);
      
      const retrievedClass = manager.getClass('TestClass');
      expect(retrievedClass).toBe(TestClass);
    });
    
    test('should register both definition and constructor together', () => {
      class TestBaseClass {}
      
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef, TestBaseClass);
      
      expect(manager.getDefinition('TestBaseClass')).toBe(testBaseClassDef);
      expect(manager.getClass('TestBaseClass')).toBe(TestBaseClass);
    });
    
    test('should correctly check if a class is registered', () => {
      class TestClass {}
      
      expect(manager.isClassRegistered('TestClass')).toBeFalsy();
      
      manager.registerClass('TestClass', TestClass);
      
      expect(manager.isClassRegistered('TestClass')).toBe(true);
    });
    
    test('should return undefined for non-existent classes', () => {
      expect(manager.getClass('NonExistentClass')).toBeUndefined();
      expect(manager.getDefinition('NonExistentClass')).toBeUndefined();
    });
  });
  
  describe('Property Information', () => {
    test('should retrieve property info for a class', () => {
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef);
      
      const namePropertyInfo = manager.getPropertyInfo('TestBaseClass', 'name');
      expect(namePropertyInfo).toBeDefined();
      expect(namePropertyInfo.Type).toBe('string');
      expect(namePropertyInfo.Required).toBe(true);
    });
    
    test('should return undefined for non-existent properties', () => {
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef);
      
      const nonExistentProperty = manager.getPropertyInfo('TestBaseClass', 'nonExistentProperty');
      expect(nonExistentProperty).toBeUndefined();
    });
    
    test('should return undefined for non-existent classes', () => {
      const propertyInfo = manager.getPropertyInfo('NonExistentClass', 'anyProperty');
      expect(propertyInfo).toBeUndefined();
    });
  });
  
  describe('Loading Multiple Definitions', () => {
    test('should load multiple definitions at once', () => {
      const definitions = {
        'TestBaseClass': testBaseClassDef,
        'TestChildClass': testChildClassDef
      };
      
      manager.loadDefinitions(definitions);
      
      expect(manager.getDefinition('TestBaseClass')).toBe(testBaseClassDef);
      expect(manager.getDefinition('TestChildClass')).toBe(testChildClassDef);
    });
    
    test('should throw an error if extended class is not found', () => {
      const invalidDefinition = {
        'InvalidClass': {
          'ClassName': 'InvalidClass',
          'Extends': 'NonExistentParent',
          'Properties': {}
        }
      };
      
      expect(() => {
        manager.loadDefinitions(invalidDefinition);
      }).toThrow('Extended class not found: NonExistentParent');
    });
  });
  
  describe('Clearing Registry', () => {
    test('should clear all registrations', () => {
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef);
      manager.registerClassDefinition('TestChildClass', testChildClassDef);
      
      expect(manager.getDefinition('TestBaseClass')).toBeDefined();
      expect(manager.getDefinition('TestChildClass')).toBeDefined();
      
      manager.clear();
      
      expect(manager.getDefinition('TestBaseClass')).toBeUndefined();
      expect(manager.getDefinition('TestChildClass')).toBeUndefined();
    });
  });
  
  describe('Synthetic Constructors', () => {
    test('should create a synthetic constructor when only definition is provided', () => {
      // Register class definition without a constructor
      manager.registerClassDefinition('TestBaseClass', testBaseClassDef);
      
      // Verify we can get a constructor
      const Constructor = manager.getClass('TestBaseClass');
      expect(Constructor).toBeDefined();
      expect(typeof Constructor).toBe('function');
      
      // Create an instance and verify it sets the _className
      const instance = new Constructor();
      expect(instance._className).toBe('TestBaseClass');
    });
  });

  describe('Error Handling', () => {
    test('should throw when registering a definition with null className', () => {
      expect(() => {
        manager.registerClassDefinition(null, testBaseClassDef);
      }).toThrow('Class name is required');
    });
    
    test('should throw when registering a null definition', () => {
      expect(() => {
        manager.registerClassDefinition('TestClass', null);
      }).toThrow('Definition must be a non-null object');
    });
  });
});
