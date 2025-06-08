// Mock implementation of Binding class for testing
class Binding {
  constructor(options) {
    if (!options || !options.path || !options.element || !options.eventManager) {
      throw new Error('Missing required binding options');
    }
    
    this.path = options.path;
    this.element = options.element;
    this.attribute = options.attribute || 'value';
    this.eventManager = options.eventManager;
    this.formatter = options.formatter || (value => value);
    this.parser = options.parser || (value => value);
    this._isUpdatingFromModel = false;
    
    // Set up view event listeners
    this._viewEvent = this._determineViewEvent(options);
    this._boundHandleViewChange = this._handleViewChange.bind(this);
    this.element.addEventListener(this._viewEvent, this._boundHandleViewChange);
    
    // Store binding reference on element
    this.element.__binding = this;
  }
  
  _determineViewEvent(options) {
    if (options.events && options.events.view) {
      return options.events.view;
    }
    
    const tagName = this.element.tagName.toLowerCase();
    const type = this.element.type && this.element.type.toLowerCase();
    
    if (tagName === 'select' || (tagName === 'input' && (type === 'checkbox' || type === 'radio'))) {
      return 'change';
    } else if (tagName === 'button') {
      return 'click';
    }
    
    return 'input';
  }
  
  _handleViewChange(event) {
    if (this._isUpdatingFromModel) {
      return;
    }
    
    let value;
    if (this.attribute === 'checked') {
      value = this.element.checked;
    } else if (this.attribute === 'value') {
      value = this.element.value;
    } else {
      value = this.element[this.attribute];
    }
    
    const parsedValue = this.parser(value, this.path);
    
    this.eventManager.dispatchEvent({
      type: 'VIEW_TO_MODEL_PROPERTY_CHANGED',
      detail: {
        path: this.path,
        value: parsedValue
      }
    });
  }
  
  handleModelChange(event) {
    if (event.type !== 'MODEL_TO_VIEW_PROPERTY_CHANGED') {
      return;
    }
    
    const { path, value } = event.detail;
    
    if (path === this.path) {
      this._isUpdatingFromModel = true;
      try {
        this._updateViewFromModel(value);
      } catch (error) {
        console.error('Error updating view from model:', error);
      } finally {
        this._isUpdatingFromModel = false;
      }
    }
  }
  
  _updateViewFromModel(valueFromEvent) {
    let value;
    if (valueFromEvent !== undefined) {
      value = valueFromEvent;
    } else {
      const app = this.eventManager._owner;
      if (!app) return;
      const model = app.getModel();
      if (!model) return;
      const rootInstance = model.getRootInstance();
      value = this._getValueFromPath(rootInstance, this.path);
    }
    
    // Handle null or undefined values
    if (value === null || value === undefined) {
      value = '';
    }
    
    const formattedValue = this.formatter(value);
    
    if (this.attribute === 'value') {
      this.element.value = formattedValue;
    } else if (this.attribute === 'checked') {
      this.element.checked = formattedValue;
    } else if (this.attribute === 'textContent') {
      this.element.textContent = formattedValue;
    } else if (this.attribute === 'innerHTML') {
      this.element.innerHTML = formattedValue;
    } else {
      try {
        this.element[this.attribute] = formattedValue;
      } catch {
        this.element.setAttribute(this.attribute, formattedValue);
      }
    }
  }
  
  _getValueFromPath(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
  
  destroy() {
    if (this.element) {
      this.element.removeEventListener(this._viewEvent, this._boundHandleViewChange);
      delete this.element.__binding;
    }
    
    this.element = null;
    this.eventManager = null;
    this._boundHandleViewChange = null;
  }
}

module.exports = { Binding };
