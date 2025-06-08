// Custom test environment to handle TextEncoder/TextDecoder and other globals
const JSDOMEnvironment = require('jest-environment-jsdom').default;
const { TextEncoder, TextDecoder } = require('util');

class CustomTestEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super({
      ...config,
      globals: {
        ...config.globals,
        Uint32Array,
        Uint8Array,
        ArrayBuffer,
        TextEncoder,
        TextDecoder,
      },
    }, context);
  }

  async setup() {
    await super.setup();
    
    // Add any additional setup here
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.Uint8Array = Uint8Array;
    this.global.ArrayBuffer = ArrayBuffer;
  }

  async teardown() {
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

module.exports = CustomTestEnvironment;
