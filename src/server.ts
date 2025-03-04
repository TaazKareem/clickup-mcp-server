import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClickUpServices } from "./services/clickup/index.js";
import config from "./config.js";
import { workspaceHierarchyTool, handleGetWorkspaceHierarchy } from "./tools/workspace.js";
import {
  createTaskTool, handleCreateTask,
  updateTaskTool, handleUpdateTask,
  moveTaskTool, handleMoveTask,
  duplicateTaskTool, handleDuplicateTask,
  getTaskTool, handleGetTask,
  getTasksTool, handleGetTasks,
  deleteTaskTool, handleDeleteTask,
  createBulkTasksTool, handleCreateBulkTasks,
  updateBulkTasksTool, handleUpdateBulkTasks,
  moveBulkTasksTool, handleMoveBulkTasks
} from "./tools/task.js";
import {
  createListTool, handleCreateList,
  createListInFolderTool, handleCreateListInFolder,
  getListTool, handleGetList,
  updateListTool, handleUpdateList,
  deleteListTool, handleDeleteList
} from "./tools/list.js";
import {
  createFolderTool, handleCreateFolder,
  getFolderTool, handleGetFolder,
  updateFolderTool, handleUpdateFolder,
  deleteFolderTool, handleDeleteFolder
} from "./tools/folder.js";

// Initialize ClickUp services
const services = createClickUpServices({
  apiKey: config.clickupApiKey,
  teamId: config.clickupTeamId
});

// Extract the workspace service for use in this module
const { workspace } = services;

/**
 * MCP Server for ClickUp integration
 */
export const server = new Server(
  {
    name: "clickup-mcp-server",
    version: "0.4.50",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Configure the server routes and handlers
 */
export function configureServer() {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        workspaceHierarchyTool,
        createTaskTool,
        getTaskTool,
        getTasksTool,
        updateTaskTool,
        moveTaskTool,
        duplicateTaskTool,
        deleteTaskTool,
        createBulkTasksTool,
        updateBulkTasksTool,
        moveBulkTasksTool,
        createListTool,
        createListInFolderTool,
        getListTool,
        updateListTool,
        deleteListTool,
        createFolderTool,
        getFolderTool,
        updateFolderTool,
        deleteFolderTool
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: params } = req.params;
    
    // Handle tool calls by routing to the appropriate handler
    switch (name) {
      case "get_workspace_hierarchy":
        return handleGetWorkspaceHierarchy();
      case "create_task":
        return handleCreateTask(params);
      case "update_task":
        return handleUpdateTask(params);
      case "move_task":
        return handleMoveTask(params);
      case "duplicate_task":
        return handleDuplicateTask(params);
      case "get_task":
        return handleGetTask(params);
      case "get_tasks":
        return handleGetTasks(params);
      case "delete_task":
        return handleDeleteTask(params);
      case "create_bulk_tasks":
        return handleCreateBulkTasks(params);
      case "update_bulk_tasks":
        return handleUpdateBulkTasks(params as { tasks: any[] });
      case "move_bulk_tasks":
        return handleMoveBulkTasks(params as { tasks: any[], targetListId?: string, targetListName?: string });
      case "create_list":
        return handleCreateList(params);
      case "create_list_in_folder":
        return handleCreateListInFolder(params);
      case "get_list":
        return handleGetList(params);
      case "update_list":
        return handleUpdateList(params);
      case "delete_list":
        return handleDeleteList(params);
      case "create_folder":
        return handleCreateFolder(params);
      case "get_folder":
        return handleGetFolder(params);
      case "update_folder":
        return handleUpdateFolder(params);
      case "delete_folder":
        return handleDeleteFolder(params);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  server.setRequestHandler(GetPromptRequestSchema, async () => {
    throw new Error("Prompt not found");
  });

  return server;
}

/**
 * Export the clickup service for use in tool handlers
 */
export { workspace };