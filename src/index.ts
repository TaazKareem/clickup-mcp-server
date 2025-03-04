#!/usr/bin/env node

/**
 * ClickUp MCP Server - A Model Context Protocol server for ClickUp integration
 * 
 * This server enables AI applications to interact with ClickUp through a standardized protocol,
 * allowing AI assistants to manage tasks, lists, and folders in ClickUp workspaces.
 * 
 * Key capabilities include:
 * 
 * Task Management:
 * - Create, update, move and duplicate tasks with rich description support
 * - Find tasks by name with smart disambiguation
 * - Bulk task creation for efficient workflow setup
 * - Comprehensive filtering and sorting options
 * 
 * Workspace Organization:
 * - Navigate and discover workspace structure with hierarchical views
 * - Create and manage lists and folders with proper nesting
 * - Smart name-based lookups that eliminate the need for IDs
 * - Support for priorities, statuses, and due dates
 * 
 * AI-Enhanced Capabilities:
 * - Task summarization and status grouping for project overviews
 * - Priority analysis and optimization for workload balancing
 * - Detailed task description generation with structured content
 * - Task relationship identification for dependency management
 * 
 * Technical Features:
 * - Full markdown support for rich text content
 * - Secure credential handling through configuration
 * - Comprehensive error reporting and validation
 * - Name-based entity resolution with fuzzy matching
 * 
 * This implementation follows the Model Context Protocol specification and
 * is designed to be used with AI assistants that support MCP.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configureServer, server } from "./server.js";

/**
 * Application entry point that configures and starts the MCP server.
 */
async function main() {
  // Configure the server with all handlers
  configureServer();
  
  // Connect using stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

