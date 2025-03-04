/**
 * ClickUp MCP Workspace Tools
 * 
 * This module defines workspace-related tools like retrieving workspace hierarchy.
 * It handles the workspace tool definitions and the implementation of their handlers.
 */

import { createClickUpServices, WorkspaceNode } from '../services/clickup/index.js';
import config from '../config.js';

// Initialize ClickUp services using the factory function
const services = createClickUpServices({
  apiKey: config.clickupApiKey,
  teamId: config.clickupTeamId
});

// Extract the workspace service for use in this tool
const { workspace } = services;

/**
 * Tool definition for retrieving the complete workspace hierarchy
 */
export const workspaceHierarchyTool = {
  name: "get_workspace_hierarchy",
  description: "Retrieve the complete ClickUp workspace hierarchy, including all spaces, folders, and lists with their IDs, names, and hierarchical paths. Call this tool only when you need to discover the workspace structure and don't already have this information from recent context. Avoid using for repeated lookups of the same information.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

/**
 * Handler for the get_workspace_hierarchy tool
 * Fetches and formats the complete workspace hierarchy with spaces, folders, and lists
 */
export async function handleGetWorkspaceHierarchy() {
  try {
    const hierarchy = await workspace.getWorkspaceHierarchy();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          workspace: {
            id: hierarchy.root.id,
            name: hierarchy.root.name,
            spaces: hierarchy.root.children.map((space: WorkspaceNode) => ({
              id: space.id,
              name: space.name,
              lists: space.children
                .filter((node: WorkspaceNode) => node.type === 'list')
                .map((list: WorkspaceNode) => ({
                  id: list.id,
                  name: list.name,
                  path: `${space.name} > ${list.name}`
                })),
              folders: space.children
                .filter((node: WorkspaceNode) => node.type === 'folder')
                .map((folder: WorkspaceNode) => ({
                  id: folder.id,
                  name: folder.name,
                  path: `${space.name} > ${folder.name}`,
                  lists: folder.children.map((list: WorkspaceNode) => ({
                    id: list.id,
                    name: list.name,
                    path: `${space.name} > ${folder.name} > ${list.name}`
                  }))
                }))
            }))
          }
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
} 