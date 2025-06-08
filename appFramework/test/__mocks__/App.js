/**
 * Mock App for testing ClientModel
 */
import { EventManager } from '../../controller/EventManager.js';

export class MockApp {
  constructor() {
    this.eventManager = new EventManager();
    this.name = 'MockApp';
    this.version = '1.0.0';
    this.getRootClassName = jest.fn(() => 'TestBaseClass');
    this.getRootFolderPath = jest.fn(() => 'testApp');
    this.getAppTitle = jest.fn(() => 'Test Application');
  }
}
