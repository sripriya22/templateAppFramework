// test-runner.js
const { exec } = require('child_process');
const path = require('path');

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.TEST_ENV = 'ci';

console.log('Starting test runner...');
console.log(`Running tests in: ${__dirname}`);

// Command to run tests with coverage
const testCommand = 'cd appFramework && npm run test:coverage';

const testProcess = exec(testCommand, { 
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit'
}, (error, stdout, stderr) => {
  if (error) {
    console.error('Test run failed:');
    console.error(error);
    process.exit(1);
  }
  console.log(stdout || '');
  console.error(stderr || '');
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  testProcess.kill('SIGINT');
  process.exit(0);
});
