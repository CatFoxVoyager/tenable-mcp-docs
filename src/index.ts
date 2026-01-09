/**
 * Tenable Docs MCP Server
 * 
 * A Model Context Protocol (MCP) server for retrieving Tenable documentation
 * to assist with script generation and API usage.
 * 
 * This server provides tools to:
 * - search_docs: Search Tenable documentation for relevant pages
 * - read_page: Read and convert documentation pages to Markdown
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { searchDocs } from './tools/search.js';
import { readPage } from './tools/read.js';
import {
  TenableMCPError,
  ValidationError,
} from './types.js';

/**
 * Server version
 */
const SERVER_VERSION = '1.0.0';

/**
 * Server name
 */
const SERVER_NAME = 'tenable-docs-mcp';

/**
 * Create and configure the MCP server
 */
async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'search_docs',
        description: `Search Tenable Developer documentation for relevant pages.
This tool helps find documentation about Tenable APIs, recipes, and examples.
Returns URLs, titles, and descriptions of relevant documentation pages.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search terms to find relevant documentation (e.g., "vulnerability management api", "scan targets", "pytenable")',
              minLength: 2,
              maxLength: 200,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'read_page',
        description: `Download a Tenable documentation page, clean the HTML, and convert it to readable Markdown.
This tool fetches the full content of a documentation page and returns it in Markdown format for easy reading.
Preserves code blocks, examples, and technical formatting.`,
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Full URL to the Tenable documentation page (e.g., "https://developer.tenable.com/reference/vulnerability-management-api")',
              format: 'uri',
            },
          },
          required: ['url'],
        },
      },
    ];

    return { tools };
  });

  /**
   * Handle tool calls
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'search_docs': {
          const query = args?.query as string;
          if (!query) {
            throw new ValidationError('Missing required parameter: query');
          }

          const results = await searchDocs(query);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query,
                  results,
                  count: results.length,
                }, null, 2),
              },
            ],
          };
        }

        case 'read_page': {
          const url = args?.url as string;
          if (!url) {
            throw new ValidationError('Missing required parameter: url');
          }

          const result = await readPage({ url });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Handle known error types
      if (error instanceof TenableMCPError) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                code: error.code,
                message: error.message,
                details: error.details,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Handle unknown errors
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: 'UNKNOWN_ERROR',
              message: 'An unexpected error occurred',
              details: error instanceof Error ? error.message : String(error),
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start the MCP server
 */
async function main() {
  try {
    const server = await createServer();
    
    // Configure stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.connect(transport);
    
    // Log startup message (will be visible in debug mode)
    if (process.env.DEBUG) {
      console.error(`${SERVER_NAME} v${SERVER_VERSION} started successfully`);
    }
    
  } catch (error) {
    console.error(`Failed to start ${SERVER_NAME}:`, error);
    process.exit(1);
  }
}

// Start the server
main();
