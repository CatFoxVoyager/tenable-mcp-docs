# Tenable Docs MCP Server

A Model Context Protocol (MCP) server for retrieving Tenable documentation to assist with script generation and API usage.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that allows AI assistants (like Claude) to interact with external tools and data sources. This server acts as a **bridge** between Claude and Tenable's documentation, enabling Claude to read and understand Tenable APIs to help you generate scripts and build integrations.

### How MCP Works

1. **MCP Server**: This project runs as a separate process (Node.js server)
2. **MCP Client**: Claude Desktop (or other AI assistants) communicates with the server
3. **Communication**: Uses JSON-RPC 2.0 over stdin/stdout (stdio transport)
4. **Tools**: Server exposes callable tools that Claude can invoke

When you ask Claude a question about Tenable APIs, Claude can:
- Call `search_docs` to find relevant documentation
- Call `read_page` to read the full documentation
- Use the retrieved information to generate code or answer your question

## ⚠️ Important Notice

**This server is designed for DOCUMENTATION RETRIEVAL ONLY.** It does NOT:
- Manage or store API keys
- Authenticate to Tenable APIs
- Execute API requests
- Access your Tenable account data

This tool reads public Tenable documentation to help you understand how to use Tenable APIs, generate scripts, and integrate Tenable services into your applications.

## Features

- **Search Tenable Documentation**: Find relevant API documentation, recipes, and examples
- **Read Documentation Pages**: Convert documentation pages to clean Markdown format
- **Preserve Code Examples**: Code blocks and examples are preserved during conversion
- **Input Validation**: All inputs are validated for security and correctness
- **Error Handling**: Comprehensive error handling with clear error messages
- **Type Safe**: Full TypeScript implementation with strict mode enabled

## Use Cases

### 1. Learning Tenable APIs
```
You: How do I use the Tenable API to launch a scan?
Claude: Let me search the documentation...
[calls search_docs with "launch scan"]
Claude: I found relevant documentation. Let me read the details...
[calls read_page on the scan API documentation]
Claude: Here's how to launch a scan using the Tenable API:
[provides code example and explanation based on documentation]
```

### 2. Writing Integration Scripts
```
You: I need to import AWS assets into Tenable. Can you help?
Claude: Let me search for Cloud Connector API documentation...
[calls search_docs with "Cloud Connector" or "import assets"]
Claude: Reading the Cloud Connector API documentation...
[calls read_page]
Claude: Here's a Python script to import AWS assets:
[provides complete script using API endpoints from documentation]
```

### 3. Understanding API Limits and Pagination
```
You: How do I handle pagination in the Vulnerability Management API?
Claude: Let me search for pagination information...
[calls search_docs with "pagination"]
Claude: Reading the API basics documentation...
[calls read_page]
Claude: The Vulnerability Management API uses cursor-based pagination...
[explains pagination mechanism with code examples]
```

### 4. Exploring Tenable.sc Features via API
```
You: Can you show me how to create target groups via API?
Claude: Searching for target group documentation...
[calls search_docs with "target groups"]
Claude: Reading the target group API reference...
[calls read_page]
Claude: Here's how to create and manage target groups:
[provides API endpoints and examples]
```

## Installation

### Prerequisites

- **Node.js 18 or higher** - Required for ES modules and modern features
- **npm or yarn** - Package manager for dependencies
- **Git** - For cloning the repository

### Install Dependencies

```bash
npm install
```

This installs all required dependencies:
- @modelcontextprotocol/sdk - MCP framework
- axios - HTTP client
- cheerio - HTML parser
- turndown - HTML to Markdown converter

### Build Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory:
- `src/index.ts` → `dist/index.js`
- `src/tools/*.ts` → `dist/tools/*.js`
- `src/utils/*.ts` → `dist/utils/*.js`
- `src/types.ts` → `dist/types.js`

Type definitions (`.d.ts`) and source maps (`.js.map`) are also generated for better debugging.

## Usage

### Running the Server

**Production Mode:**
```bash
npm start
```

**Development Mode (with watch):**
```bash
npm run watch
```

**Build and Run (one command):**
```bash
npm run dev
```

### Debug Mode

To see startup messages and debug information:
```bash
DEBUG=1 npm start
```

Server will log startup message to stderr, which is visible in most terminals.

### Testing the Server Locally

A test script is included to verify the server works correctly:

```bash
node test.mjs
```

This will:
1. Start the MCP server
2. Initialize the connection
3. List available tools
4. Call `search_docs` with a test query
5. Display the results
6. Exit cleanly

### Integration with Claude Desktop

To use this server with Claude Desktop, add it to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "tenable-docs": {
      "command": "node",
      "args": [
        "C:/path/to/tenable-mcp-docs/dist/index.js"
      ]
    }
  }
}
```

**Important:**
- Use the **absolute path** to `dist/index.js`
- Path must use forward slashes on Windows (e.g., `C:/Users/...` not `C:\Users\...`)
- Restart Claude Desktop after updating the configuration

### Verifying Installation

After configuring Claude Desktop, verify the server is available:

1. Open Claude Desktop
2. Start a new conversation
3. Type: "What tools do you have access to?"
4. Claude should respond with information about the `search_docs` and `read_page` tools

## Available Tools

### search_docs

Search Tenable Developer documentation for relevant pages.

**How it works:**
1. Analyzes your search query
2. Matches keywords against known documentation patterns
3. Calculates relevance scores
4. Returns top 10 most relevant results

**Parameters:**
- `query` (string, required): Search terms to find relevant documentation
  - Minimum: 2 characters
  - Maximum: 200 characters
  - Case-insensitive
  - Special characters are removed during processing

**Example Queries:**
- `"vulnerability management api"` - Find VM API documentation
- `"scan targets"` - Learn about target management
- `"pytenable"` - Find Python SDK examples
- `"web app scanning"` - Get WVS API info
- `"attack surface management"` - Explore ASM features

**Returns:**
Array of search results with URL, title, and description.

**Example Response:**
```json
{
  "query": "vulnerability management api",
  "results": [
    {
      "url": "https://developer.tenable.com/reference/vulnerability-management-api",
      "title": "Vulnerability Management API",
      "description": "Complete API documentation for Tenable Vulnerability Management"
    },
    {
      "url": "https://developer.tenable.com/recipes/vm-scan",
      "title": "VM: Launch a Scan",
      "description": "Recipe showing how to launch a scan using Python"
    }
  ],
  "count": 2
}
```

**Search Categories:**
The tool searches across these documentation areas:
- API References (vulnerability management, WAS, ASM, Identity Exposure, PCI)
- Tenable One (exposure view, attack path, inventory)
- Recipes (integration examples, automation scripts)
- API Explorer (interactive testing)

### read_page

Download a Tenable documentation page, clean the HTML, and convert it to Markdown.

**How it works:**
1. Validates the URL (must be from Tenable domain)
2. Downloads the HTML content using axios
3. Cleans the HTML by removing navigation, sidebars, footers
4. Preserves code blocks (extraction before cleaning, restoration after)
5. Converts cleaned HTML to Markdown using turndown
6. Returns structured result with metadata

**Parameters:**
- `url` (string, required): Full URL to Tenable documentation page
  - Must start with `http://` or `https://`
  - Domain must be `developer.tenable.com` or `tenable.com`
  - Query parameters are preserved

**Allowed Domains:**
- `developer.tenable.com`
- `tenable.com`
- Subdomains of the above (e.g., `community.tenable.com`)

**Returns:**
Object with URL, title, Markdown content, and word count.

**Example Response:**
```json
{
  "url": "https://developer.tenable.com/reference/vulnerability-management-api",
  "title": "Vulnerability Management API",
  "content": "# Vulnerability Management API\n\nComplete API documentation for Tenable Vulnerability Management...\n\n## Authentication\n\nAll API requests require...\n\n```python\nimport tenable\n\nsc = tenable.TenableIOV2()\n```\n\n## Launching a Scan\n\nTo launch a scan...\n",
  "wordCount": 542
}
```

**Content Cleaning:**
The tool removes these elements automatically:
- Navigation menus and sidebars
- Headers and footers
- Breadcrumbs and pagination
- Search boxes and forms
- Cookie banners and popups
- Scripts and styles

**Code Preservation:**
- Code blocks (`<pre><code>`) are preserved exactly as they appear
- Inline code (`<code>`) is converted to Markdown backticks
- Syntax highlighting information is retained
- Indentation and whitespace are preserved

## Advanced Usage

### Combining Tools

You can use both tools together for complex queries:

```
User: Show me examples of using the Tenable API with Python
Claude: Let me search for Python examples...
[calls search_docs with "python example pytenable"]
Claude: I found several recipes. Let me read a comprehensive one...
[calls read_page on a recipe URL]
Claude: Here's a complete Python example from the documentation:
[provides full code from read_page]
```

### Error Handling

The server returns structured error responses:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Search query must be at least 2 characters long",
  "details": { "query": "x", "minLength": 2 }
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `NETWORK_ERROR` - HTTP request failed
- `PARSE_ERROR` - HTML/JSON parsing failed
- `SCRAPING_ERROR` - Content scraping/cleaning failed
- `CONVERSION_ERROR` - HTML to Markdown conversion failed
- `SEARCH_ERROR` - Search functionality failed
- `UNKNOWN_ERROR` - Unexpected error occurred

### Using with Other MCP Clients

This server uses **stdio transport**, which is supported by all MCP clients. Examples:

**Claude Desktop**: (see above configuration)

**Cline** (VS Code extension):
```json
{
  "mcpServers": {
    "tenable-docs": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

**Other Clients**:
Consult your client's documentation for MCP server configuration. The key requirement is that the client supports stdio transport.

## Technical Details

### Architecture

```
tenable-docs-mcp/
├── src/
│   ├── index.ts           # Main MCP server entry point
│   ├── tools/            # MCP tool implementations
│   │   ├── search.ts      # Search functionality
│   │   └── read.ts        # Page reading functionality
│   ├── utils/            # Utility functions
│   │   ├── scraper.ts     # HTML download, parsing, cleaning
│   │   └── converter.ts   # HTML to Markdown conversion
│   └── types.ts          # TypeScript type definitions
├── dist/                 # Compiled JavaScript (generated by build)
├── test.mjs            # Server test script
├── package.json           # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # This file
├── AGENTS.md            # Documentation for AI agents
└── .gitignore           # Git ignore patterns
```

### Dependencies

**Core Dependencies:**
- **@modelcontextprotocol/sdk@^1.0.4**: MCP framework providing Server, request handlers, and types
- **axios@^1.7.9**: Promise-based HTTP client for fetching web pages
- **cheerio@^1.0.0-rc.12**: jQuery-like API for HTML parsing and manipulation
- **turndown@^7.2.0**: HTML to Markdown converter with customizable rules

**Dev Dependencies:**
- **typescript@^5.7.2**: TypeScript compiler
- **@types/node@^22.10.2**: Node.js type definitions
- **@types/turndown@^5.0.5**: Turndown type definitions

### Performance Considerations

**Request Processing:**
- HTML download: ~1-3 seconds depending on page size
- HTML cleaning: ~50-200ms
- Markdown conversion: ~100-500ms
- Total per `read_page`: ~2-4 seconds

**Network:**
- No concurrent requests (sequential processing)
- No caching (each request downloads fresh content)
- Follows up to 5 HTTP redirects
- 30-second timeout for requests

**Memory Usage:**
- Base server: ~50MB
- Per page read: ~10-20MB (depends on page size)
- No persistent state or connection pooling

### Code Quality

**TypeScript Configuration:**
- Strict mode enabled
- No implicit any types
- No unused variables
- ES2022 target
- Module: ESNext

**Error Handling:**
- All async operations wrapped in try-catch
- Custom error classes with error codes
- Structured error responses for MCP clients
- Error details included for debugging

## Troubleshooting

### Server Won't Start

**Problem**: Error when running `npm start`

**Symptoms:**
```
Error: Cannot find module '@modelcontextprotocol/sdk'
```

**Solutions:**
1. Ensure dependencies are installed: `npm install`
2. Build the project first: `npm run build`
3. Check Node.js version: `node --version` (should be 18+)
4. Verify you're in the correct directory: `ls -la dist/index.js`
5. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Tools Not Available in Claude Desktop

**Problem**: Tools don't appear in Claude Desktop

**Symptoms:**
- Claude says "I don't have access to documentation tools"
- Tools menu doesn't show `search_docs` or `read_page`

**Solutions:**
1. Verify the path in configuration is absolute (not relative)
2. Ensure path points to `dist/index.js` (NOT `src/index.ts`)
3. Use forward slashes on Windows: `C:/Users/...` not `C:\Users\...`
4. Restart Claude Desktop completely (quit and reopen)
5. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/claude-desktop.log`
   - Windows: `%APPDATA%\Claude\logs\`
6. Try running the server manually first: `npm start` to verify it works

### Search Returns No Results

**Problem**: `search_docs` returns empty results or irrelevant pages

**Symptoms:**
```json
{
  "query": "something specific",
  "results": [],
  "count": 0
}
```

**Solutions:**
1. Try different search terms (use broader keywords)
2. Use more specific Tenable terminology
3. Check the query relates to Tenable documentation (not general coding)
4. Use category names: "vulnerability management", "web app scanning", "asm"
5. Try searching for API names: "scans", "assets", "users"

### Page Read Fails

**Problem**: `read_page` returns an error

**Symptoms:**
```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "URL domain \"example.com\" is not allowed"
}
```

**Solutions:**
1. Verify URL is correct (copy from browser address bar)
2. Ensure URL is from `developer.tenable.com` or `tenable.com`
3. Check if the page is publicly accessible (try opening in browser)
4. Make sure you're using HTTPS (not HTTP) if required
5. Test with a known working URL:
   ```
   https://developer.tenable.com/reference
   ```

### TypeScript Compilation Errors

**Problem**: `npm run build` fails with TypeScript errors

**Solutions:**
1. Check that all imports are used
2. Verify type definitions exist in `src/types.ts`
3. Ensure all functions have return types
4. Run `npx tsc --noEmit` to check types without building

### Network Timeouts

**Problem**: `read_page` times out on large pages

**Symptoms:**
```json
{
  "error": true,
  "code": "NETWORK_ERROR",
  "message": "Failed to download HTML: timeout of 30000ms exceeded"
}
```

**Solutions:**
1. Check your internet connection
2. Try with a smaller documentation page
3. The 30-second timeout is configurable in `src/utils/scraper.ts`
4. Some documentation pages may be temporarily unavailable

## Limitations

### Current Implementation Limitations

1. **Search is Pattern-Based**: The search tool matches queries against known documentation patterns. It doesn't perform full-text search or connect to Tenable's search API. This is intentional for the current implementation.

2. **No Caching**: Pages are downloaded on every request. This means:
   - Repeated requests for the same URL will re-download
   - No offline capability
   - Potential for hitting rate limits with repeated queries

3. **No Persistent Storage**: The server doesn't cache results or maintain any state between requests. Each request is independent.

4. **Rate Limiting**: While timeouts are implemented, there's no built-in request throttling. Users should avoid making excessive rapid requests.

5. **Single-Threaded Processing**: The server processes one request at a time. No concurrent request handling.

### Future Enhancements

Potential improvements for future versions:
- Implement actual Tenable search API integration
- Add response caching for better performance
- Implement concurrent request handling
- Add request throttling/rate limiting
- Support for authentication-protected documentation
- Offline mode with cached documentation

## Development

### Setting Up Development Environment

```bash
# Clone repository
git clone <repository-url>
cd tenable-mcp-docs

# Install dependencies
npm install

# Start in watch mode (auto-rebuild on changes)
npm run watch
```

### Adding New Tools

1. Create tool file in `src/tools/`
2. Import and use utility functions from `src/utils/`
3. Define types in `src/types.ts` if needed
4. Register tool in `src/index.ts`:
   ```typescript
   // In ListToolsRequestSchema handler
   tools: [
     {
       name: 'new_tool',
       description: 'Tool description',
       inputSchema: {
         type: 'object',
         properties: {
           // Define parameters
         },
         required: ['param1']
       }
     }
   ]

   // In CallToolRequestSchema handler
   case 'new_tool': {
     const param = args?.param1 as string;
     // Implement tool logic
     return {
       content: [{ type: 'text', text: JSON.stringify(result) }]
     };
   }
   ```
5. Rebuild: `npm run build`
6. Test with `node test.mjs` or MCP client

### Debugging

Enable debug output to see server startup and error details:

```bash
DEBUG=1 node dist/index.js
```

Server will log to stderr:
```
tenable-docs-mcp v1.0.0 started successfully
```

For detailed debugging, you can add `console.error()` statements in the code. MCP protocol uses stderr for logging, which won't interfere with stdio communication.

### Testing

Use the included test script:

```bash
node test.mjs
```

Or create custom tests in `src/tools/` and run them manually.

## Security Considerations

### URL Whitelisting

The `read_page` tool only accepts URLs from Tenable documentation domains. This prevents:
- Accessing arbitrary websites
- Phishing or malicious content retrieval
- Unintended external API calls

### Input Validation

All user inputs are validated:
- Query length and format checks
- URL syntax and domain verification
- Type checking via TypeScript

### No Credential Storage

The server explicitly does NOT:
- Accept API keys or tokens
- Store passwords or credentials
- Access user accounts
- Authenticate to external services

### Network Security

- Uses HTTPS by default for Tenable documentation
- Follows redirects safely (max 5)
- Timeout prevents hanging connections
- No persistent connections to reduce attack surface

## Contributing

Contributions are welcome! Please ensure:

1. **Code Quality**
   - TypeScript with strict mode
   - No `any` types
   - Proper error handling
   - JSDoc comments for public APIs

2. **Testing**
   - Add test scripts for new features
   - Test with `node test.mjs`
   - Verify MCP protocol compliance

3. **Documentation**
   - Update `README.md` with new features
   - Add inline code comments
   - Update `AGENTS.md` for maintainers

4. **Commit Standards**
   - Clear commit messages
   - One logical change per commit
   - Reference issues in commits

## License

MIT License - feel free to use, modify, and distribute this server.

## Support and Resources

### Official Documentation
- [Tenable Developer Portal](https://developer.tenable.com/)
- [Tenable API Reference](https://developer.tenable.com/reference)
- [Tenable Recipes](https://developer.tenable.com/recipes)
- [Tenable API Explorer](https://developer.tenable.com/api-explorer)
- [Tenable Community](https://community.tenable.com/)

### SDKs and Libraries
- [pyTenable](https://pytenable.readthedocs.io/) - Official Python SDK
- [Tenable PowerShell Tools](https://github.com/tenable/Tenable-PowerShellTools) - PowerShell scripts
- [Tenable.sc API Integrations](https://community.tenable.com/s/) - Community integrations

### Getting Help
- Search [Tenable Community](https://community.tenable.com/s/) for existing solutions
- Check [Tenable Support](https://www.tenable.com/support) for official assistance
- Open an issue in this repository for server-specific problems

## Changelog

### Version 1.0.0 (2026-01-09)
- Initial release
- `search_docs` tool for documentation search
- `read_page` tool for page reading and conversion
- HTML cleaning with code block preservation
- Full TypeScript implementation
- MCP stdio transport
- Comprehensive error handling
- Input validation and URL whitelisting

---

**Made with ❤️ for the Tenable developer community**
