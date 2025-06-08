/**
 * Mock ModelClassDefinitionManager for testing
 */
export class MockModelClassDefinitionManager {
  constructor() {
    this._classRegistry = new Map();
    this.registerClass = jest.fn(this._mockRegisterClass.bind(this));
    this.registerClassDefinition = jest.fn(this._mockRegisterClassDefinition.bind(this));
    this.isClassRegistered = jest.fn(this._mockIsClassRegistered.bind(this));
    this.getClass = jest.fn(this._mockGetClass.bind(this));
    this.getDefinition = jest.fn(this._mockGetDefinition.bind(this));
    this.getPropertyInfo = jest.fn(this._mockGetPropertyInfo.bind(this));
    this.getAllRegisteredClassNames = jest.fn(this._mockGetAllRegisteredClassNames.bind(this));
    this.getRegistrationStatus = jest.fn(this._mockGetRegistrationStatus.bind(this));
    this.loadDefinitions = jest.fn(this._mockLoadDefinitions.bind(this));
    this.clear = jest.fn(this._mockClear.bind(this));
  }

  _mockRegisterClass(className, constructor) {
    const classInfo = this._classRegistry.get(className) || { propertyCache: new Map() };
    classInfo.constructor = constructor;
    this._classRegistry.set(className, classInfo);
    return this;
  }

  _mockRegisterClassDefinition(className, definition, constructor) {
    const classInfo = this._classRegistry.get(className) || { propertyCache: new Map() };
    classInfo.definition = definition;
    if (constructor) {
      classInfo.constructor = constructor;
    }
    this._classRegistry.set(className, classInfo);
    return true;
  }

  _mockIsClassRegistered(className) {
    const classInfo = this._classRegistry.get(className);
    return classInfo && classInfo.constructor !== undefined;
  }

  _mockGetClass(className) {
    const classInfo = this._classRegistry.get(className);
    return classInfo ? classInfo.constructor : undefined;
  }

  _mockGetDefinition(className) {
    const classInfo = this._classRegistry.get(className);
    return classInfo ? classInfo.definition : undefined;
  }

  _mockGetPropertyInfo(className, propName) {
    const classInfo = this._classRegistry.get(className);
    if (!classInfo || !classInfo.definition || !classInfo.definition.Properties) {
      return undefined;
    }
    return classInfo.definition.Properties[propName];
  }

  _mockGetAllRegisteredClassNames() {
    return Array.from(this._classRegistry.keys());
  }

  _mockGetRegistrationStatus(className) {
    const classInfo = this._classRegistry.get(className);
    if (!classInfo) {
      return { registered: false, hasConstructor: false, hasDefinition: false };
    }
    return {
      registered: true,
      hasConstructor: classInfo.constructor !== undefined,
      hasDefinition: classInfo.definition !== undefined
    };
  }

  _mockLoadDefinitions(definitions) {
    Object.entries(definitions).forEach(([className, def]) => {
      this._mockRegisterClassDefinition(className, def);
    });
    return this;
  }

  _mockClear() {
    this._classRegistry.clear();
    return this;
  }
}
