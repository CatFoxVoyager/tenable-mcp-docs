#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Starting test...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Collect stdout
let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('[OUT]', data.toString().trim().substring(0, 200));
});

// Collect stderr (debug info)
server.stderr.on('data', (data) => {
  console.log('[ERR]', data.toString().trim());
});

// Send initialize message
setTimeout(() => {
  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test',
        version: '1.0.0'
      }
    }
  }) + '\n';

  console.log('[IN] Sending initialization...');
  server.stdin.write(initMsg);
}, 100);

// After 500ms, list tools
setTimeout(() => {
  const listMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n';

  console.log('[IN] Listing tools...');
  server.stdin.write(listMsg);
}, 600);

// After 1000ms, call search tool
setTimeout(() => {
  const callMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'search_docs',
      arguments: { query: 'api' }
    }
  }) + '\n';

  console.log('[IN] Calling search_docs...');
  server.stdin.write(callMsg);
}, 1100);

// After 3000ms, exit and show results
setTimeout(() => {
  console.log('\n--- Complete Output ---');
  console.log(output);

  try {
    const lines = output.trim().split('\n').filter(l => l.trim());
    console.log('\n--- Parsed Messages ---');
    lines.forEach((line, i) => {
      try {
        const msg = JSON.parse(line);
        console.log(`Message ${i + 1}:`, msg.result ? 'Success' : msg.error ? 'Error' : 'Other');
        if (msg.result && msg.result.tools) {
          console.log(`  Found ${msg.result.tools.length} tools`);
        }
        if (msg.result && msg.result.content) {
          console.log(`  Got content response`);
        }
      } catch (e) {
        console.log(`Message ${i + 1}: Failed to parse`);
      }
    });
  } catch (e) {
    console.log('Parse error:', e.message);
  }

  server.kill();
  process.exit(0);
}, 5000);

server.on('exit', (code) => {
  console.log(`\nServer exited with code ${code}`);
});
