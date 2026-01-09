const { spawn } = require('child_process');

console.log('Starting MCP server test...');
console.log('');

// On Windows, use cmd /c npx
const server = spawn('cmd', ['/c', 'npx', 'tenable-docs-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

server.stderr.on('data', (data) => {
  console.error('[STDERR]', data.toString());
});

server.stdout.on('data', (data) => {
  console.log('[STDOUT]', data.toString());
});

// Send initialization after 1 second
setTimeout(() => {
  console.log('Sending initialization...');
  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  }) + '\n';

  server.stdin.write(initMsg);
}, 1000);

// Exit after 10 seconds
setTimeout(() => {
  console.log('Test timeout, exiting...');
  server.kill();
  process.exit(0);
}, 10000);

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
});
