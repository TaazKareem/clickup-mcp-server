#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ClickUpService } from "./services/clickup.js";
import config from "./config.js";
import { handleWorkspaceHierarchy, handleCreateTask } from "./handlers/tools.js";
import { handleSummarizeTasks, handleAnalyzeTaskPriorities } from "./handlers/prompts.js";
import { getAllTasks } from "./utils/resolvers.js";
import {
  CreateTaskData,
  CreateListData,
  CreateFolderData,
  BulkCreateTasksData
} from "./types/clickup.js";

console.log('Server starting up...');
console.log('Config loaded:', {
  clickupApiKey: config.clickupApiKey ? '***' : 'missing',
  teamId: config.teamId || 'missing'
});

// Initialize ClickUp service
let clickup: ClickUpService;
try {
  console.log('Initializing ClickUp service...');
  clickup = ClickUpService.initialize(config.clickupApiKey);
  console.log('ClickUp service initialized successfully');
} catch (error) {
  console.error("Failed to initialize ClickUp service:", error);
  process.exit(1);
}

console.log('Creating MCP server...');
const server = new Server(
  {
    name: "clickup",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {
        list: true,
        read: true,
      },
      tools: {
        workspace_hierarchy: {
          description: "List complete hierarchy of the ClickUp workspace",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        },
        create_task: {
          description: "Create a new task in ClickUp",
          inputSchema: {
            type: "object",
            properties: {
              listId: {
                type: "string",
                description: "ID of the list to create the task in (optional if listName is provided)"
              },
              listName: {
                type: "string",
                description: "Name of the list to create the task in (optional if listId is provided)"
              },
              name: {
                type: "string",
                description: "Name of the task"
              },
              description: {
                type: "string",
                description: "Description of the task"
              },
              status: {
                type: "string",
                description: "Status of the task"
              },
              priority: {
                type: "number",
                description: "Priority of the task (1-4)"
              },
              dueDate: {
                type: "string",
                description: "Due date of the task (ISO string)"
              }
            },
            required: ["name"]
          }
        },
        create_bulk_tasks: {
          description: "Create multiple tasks in a ClickUp list",
          inputSchema: {
            type: "object",
            properties: {
              listId: {
                type: "string",
                description: "ID of the list to create the tasks in (optional if listName is provided)"
              },
              listName: {
                type: "string",
                description: "Name of the list to create the tasks in (optional if listId is provided)"
              },
              tasks: {
                type: "array",
                description: "Array of tasks to create",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the task"
                    },
                    description: {
                      type: "string",
                      description: "Description of the task"
                    },
                    status: {
                      type: "string",
                      description: "Status of the task"
                    },
                    priority: {
                      type: "number",
                      description: "Priority level (1-4)"
                    },
                    dueDate: {
                      type: "string",
                      description: "Due date (ISO string)"
                    },
                    assignees: {
                      type: "array",
                      items: {
                        type: "number"
                      },
                      description: "Array of user IDs to assign to the task"
                    }
                  },
                  required: ["name"]
                }
              }
            },
            required: ["tasks"]
          }
        },
        create_list: {
          description: "Create a new list in a ClickUp space",
          inputSchema: {
            type: "object",
            properties: {
              spaceId: {
                type: "string",
                description: "ID of the space to create the list in (optional if spaceName is provided)"
              },
              spaceName: {
                type: "string",
                description: "Name of the space to create the list in (optional if spaceId is provided)"
              },
              name: {
                type: "string",
                description: "Name of the list"
              },
              content: {
                type: "string",
                description: "Description or content of the list"
              },
              dueDate: {
                type: "string",
                description: "Due date for the list (ISO string)"
              },
              priority: {
                type: "number",
                description: "Priority of the list (1-4)"
              },
              assignee: {
                type: "number",
                description: "User ID to assign the list to"
              },
              status: {
                type: "string",
                description: "Status of the list"
              }
            },
            required: ["name"]
          }
        },
        create_folder: {
          description: "Create a new folder in a ClickUp space",
          inputSchema: {
            type: "object",
            properties: {
              spaceId: {
                type: "string",
                description: "ID of the space to create the folder in (optional if spaceName is provided)"
              },
              spaceName: {
                type: "string",
                description: "Name of the space to create the folder in (optional if spaceId is provided)"
              },
              name: {
                type: "string",
                description: "Name of the folder"
              },
              override_statuses: {
                type: "boolean",
                description: "Whether to override space statuses"
              }
            },
            required: ["name"]
          }
        },
        create_list_in_folder: {
          description: "Create a new list in a ClickUp folder",
          inputSchema: {
            type: "object",
            properties: {
              folderId: {
                type: "string",
                description: "ID of the folder to create the list in (optional if folderName and spaceId/spaceName are provided)"
              },
              folderName: {
                type: "string",
                description: "Name of the folder to create the list in"
              },
              spaceId: {
                type: "string",
                description: "ID of the space containing the folder (required if using folderName)"
              },
              spaceName: {
                type: "string",
                description: "Name of the space containing the folder (alternative to spaceId)"
              },
              name: {
                type: "string",
                description: "Name of the list"
              },
              content: {
                type: "string",
                description: "Description or content of the list"
              },
              status: {
                type: "string",
                description: "Status of the list"
              }
            },
            required: ["name"]
          }
        },
        move_task: {
          description: "Move a task to a different list",
          inputSchema: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "ID of the task to move"
              },
              listId: {
                type: "string",
                description: "ID of the destination list (optional if listName is provided)"
              },
              listName: {
                type: "string",
                description: "Name of the destination list (optional if listId is provided)"
              }
            },
            required: ["taskId"]
          }
        },
        duplicate_task: {
          description: "Duplicate a task to a list",
          inputSchema: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "ID of the task to duplicate"
              },
              listId: {
                type: "string",
                description: "ID of the destination list (optional if listName is provided)"
              },
              listName: {
                type: "string",
                description: "Name of the destination list (optional if listId is provided)"
              }
            },
            required: ["taskId"]
          }
        },
        update_task: {
          description: "Update an existing task in ClickUp",
          inputSchema: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "ID of the task to update"
              },
              name: {
                type: "string",
                description: "New name of the task"
              },
              description: {
                type: "string",
                description: "New description of the task"
              },
              status: {
                type: "string",
                description: "New status of the task"
              },
              priority: {
                type: "number",
                description: "New priority of the task (1-4)"
              },
              dueDate: {
                type: "string",
                description: "New due date of the task (ISO string)"
              }
            },
            required: ["taskId"]
          }
        }
      },
      prompts: {
        summarize_tasks: {
          description: "Summarize tasks in the workspace",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        },
        analyze_priorities: {
          description: "Analyze task priorities",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
    },
  }
);
console.log('MCP server created');

/**
 * Handler for listing available ClickUp tasks as resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.log('Handling ListResources request');
  try {
    const { tasks, spaces } = await getAllTasks(clickup, config.teamId);
    
    return {
      resources: tasks.map(task => ({
        uri: `clickup://task/${task.id}`,
        mimeType: "application/json",
        name: task.name,
        description: task.description || `Task in ${task.list.name} (${task.space.name})`,
        tags: []
      }))
    };
  } catch (error) {
    console.error('Error in ListResources:', error);
    throw error;
  }
});

/**
 * Handler for reading the contents of a specific ClickUp task.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const url = new URL(request.params.uri);
    const taskId = url.pathname.replace(/^\/task\//, '');
    const task = await clickup.getTask(taskId);

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(task, null, 2),
        tags: []
      }]
    };
  } catch (error) {
    console.error('Error reading resource:', error);
    throw error;
  }
});

/**
 * Handler for listing available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log('Handling ListTools request');
  return {
    tools: [
      {
        name: "workspace_hierarchy",
        description: "List complete hierarchy of the ClickUp workspace",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "create_task",
        description: "Create a new task in ClickUp",
        inputSchema: {
          type: "object",
          properties: {
            listId: {
              type: "string",
              description: "ID of the list to create the task in (optional if listName is provided)"
            },
            listName: {
              type: "string",
              description: "Name of the list to create the task in (optional if listId is provided)"
            },
            name: {
              type: "string",
              description: "Name of the task"
            },
            description: {
              type: "string",
              description: "Description of the task"
            },
            status: {
              type: "string",
              description: "Status of the task"
            },
            priority: {
              type: "number",
              description: "Priority of the task (1-4)"
            },
            dueDate: {
              type: "string",
              description: "Due date of the task (ISO string)"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "create_bulk_tasks",
        description: "Create multiple tasks in a ClickUp list",
        inputSchema: {
          type: "object",
          properties: {
            listId: {
              type: "string",
              description: "ID of the list to create the tasks in (optional if listName is provided)"
            },
            listName: {
              type: "string",
              description: "Name of the list to create the tasks in (optional if listId is provided)"
            },
            tasks: {
              type: "array",
              description: "Array of tasks to create",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the task"
                  },
                  description: {
                    type: "string",
                    description: "Description of the task"
                  },
                  status: {
                    type: "string",
                    description: "Status of the task"
                  },
                  priority: {
                    type: "number",
                    description: "Priority level (1-4)"
                  },
                  dueDate: {
                    type: "string",
                    description: "Due date (ISO string)"
                  },
                  assignees: {
                    type: "array",
                    items: {
                      type: "number"
                    },
                    description: "Array of user IDs to assign to the task"
                  }
                },
                required: ["name"]
              }
            }
          },
          required: ["tasks"]
        }
      },
      {
        name: "create_list",
        description: "Create a new list in a ClickUp space",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: {
              type: "string",
              description: "ID of the space to create the list in (optional if spaceName is provided)"
            },
            spaceName: {
              type: "string",
              description: "Name of the space to create the list in (optional if spaceId is provided)"
            },
            name: {
              type: "string",
              description: "Name of the list"
            },
            content: {
              type: "string",
              description: "Description or content of the list"
            },
            dueDate: {
              type: "string",
              description: "Due date for the list (ISO string)"
            },
            priority: {
              type: "number",
              description: "Priority of the list (1-4)"
            },
            assignee: {
              type: "number",
              description: "User ID to assign the list to"
            },
            status: {
              type: "string",
              description: "Status of the list"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "create_folder",
        description: "Create a new folder in a ClickUp space",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: {
              type: "string",
              description: "ID of the space to create the folder in (optional if spaceName is provided)"
            },
            spaceName: {
              type: "string",
              description: "Name of the space to create the folder in (optional if spaceId is provided)"
            },
            name: {
              type: "string",
              description: "Name of the folder"
            },
            override_statuses: {
              type: "boolean",
              description: "Whether to override space statuses"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "create_list_in_folder",
        description: "Create a new list in a ClickUp folder",
        inputSchema: {
          type: "object",
          properties: {
            folderId: {
              type: "string",
              description: "ID of the folder to create the list in (optional if folderName and spaceId/spaceName are provided)"
            },
            folderName: {
              type: "string",
              description: "Name of the folder to create the list in"
            },
            spaceId: {
              type: "string",
              description: "ID of the space containing the folder (required if using folderName)"
            },
            spaceName: {
              type: "string",
              description: "Name of the space containing the folder (alternative to spaceId)"
            },
            name: {
              type: "string",
              description: "Name of the list"
            },
            content: {
              type: "string",
              description: "Description or content of the list"
            },
            status: {
              type: "string",
              description: "Status of the list"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "move_task",
        description: "Move a task to a different list",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to move"
            },
            listId: {
              type: "string",
              description: "ID of the destination list (optional if listName is provided)"
            },
            listName: {
              type: "string",
              description: "Name of the destination list (optional if listId is provided)"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "duplicate_task",
        description: "Duplicate a task to a list",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to duplicate"
            },
            listId: {
              type: "string",
              description: "ID of the destination list (optional if listName is provided)"
            },
            listName: {
              type: "string",
              description: "Name of the destination list (optional if listId is provided)"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "update_task",
        description: "Update an existing task in ClickUp",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to update"
            },
            name: {
              type: "string",
              description: "New name of the task"
            },
            description: {
              type: "string",
              description: "New description of the task"
            },
            status: {
              type: "string",
              description: "New status of the task"
            },
            priority: {
              type: "number",
              description: "New priority of the task (1-4)"
            },
            dueDate: {
              type: "string",
              description: "New due date of the task (ISO string)"
            }
          },
          required: ["taskId"]
        }
      }
    ]
  };
});

/**
 * Handler for executing tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "workspace_hierarchy": {
        const output = await handleWorkspaceHierarchy(clickup, config.teamId);
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      }

      case "create_task": {
        const args = request.params.arguments as unknown as CreateTaskData & { listId?: string; listName?: string };
        const task = await handleCreateTask(clickup, config.teamId, args);
        return {
          content: [{
            type: "text",
            text: `Created task ${task.id}: ${task.name}`
          }]
        };
      }

      case "create_bulk_tasks": {
        const args = request.params.arguments as unknown as BulkCreateTasksData & { listId?: string, listName?: string };
        let listId = args.listId;

        if (!listId && args.listName) {
          const result = await clickup.findListByNameGlobally(config.teamId, args.listName);
          if (!result) {
            throw new Error(`List with name "${args.listName}" not found`);
          }
          listId = result.list.id;
        }

        if (!listId) {
          throw new Error("Either listId or listName is required");
        }

        if (!args.tasks || !args.tasks.length) {
          throw new Error("At least one task is required");
        }

        const { listId: _, listName: __, tasks } = args;
        const createdTasks = await clickup.createBulkTasks(listId, { tasks });
        return {
          content: [{
            type: "text",
            text: `Created ${createdTasks.length} tasks:\n${createdTasks.map(task => `- ${task.id}: ${task.name}`).join('\n')}`
          }]
        };
      }

      case "create_list": {
        const args = request.params.arguments as unknown as CreateListData & { 
          spaceId?: string; 
          spaceName?: string;
          folderName?: string;
          folderId?: string;
        };
        
        if (!args.name) {
          throw new Error("name is required");
        }

        // If folder is specified, create list in folder
        if (args.folderName || args.folderId) {
          let folderId = args.folderId;
          if (!folderId && args.folderName) {
            const result = await clickup.findFolderByNameGlobally(config.teamId, args.folderName);
            if (!result) {
              throw new Error(`Folder with name "${args.folderName}" not found`);
            }
            folderId = result.folder.id;
          }
          
          if (!folderId) {
            throw new Error("Either folderId or folderName must be provided");
          }

          const { spaceId: _, spaceName: __, folderName: ___, folderId: ____, ...listData } = args;
          const list = await clickup.createListInFolder(folderId, listData);
          return {
            content: [{
              type: "text",
              text: `Created list ${list.id}: ${list.name} in folder`
            }]
          };
        }
        
        // Otherwise, create list in space
        let spaceId = args.spaceId;
        if (!spaceId && args.spaceName) {
          const space = await clickup.findSpaceByName(config.teamId, args.spaceName);
          if (!space) {
            throw new Error(`Space with name "${args.spaceName}" not found`);
          }
          spaceId = space.id;
        }
        
        if (!spaceId) {
          throw new Error("Either spaceId or spaceName must be provided");
        }

        const { spaceId: _, spaceName: __, folderName: ___, folderId: ____, ...listData } = args;
        const list = await clickup.createList(spaceId, listData);
        return {
          content: [{
            type: "text",
            text: `Created list ${list.id}: ${list.name}`
          }]
        };
      }

      case "create_folder": {
        const args = request.params.arguments as unknown as CreateFolderData & { spaceId?: string; spaceName?: string };
        if (!args.name) {
          throw new Error("name is required");
        }
        
        let spaceId = args.spaceId;
        if (!spaceId && args.spaceName) {
          const space = await clickup.findSpaceByName(config.teamId, args.spaceName);
          if (!space) {
            throw new Error(`Space with name "${args.spaceName}" not found`);
          }
          spaceId = space.id;
        }
        
        if (!spaceId) {
          throw new Error("Either spaceId or spaceName must be provided");
        }

        const { spaceId: _, spaceName: __, ...folderData } = args;
        const folder = await clickup.createFolder(spaceId, folderData);
        return {
          content: [{
            type: "text",
            text: `Created folder ${folder.id}: ${folder.name}`
          }]
        };
      }

      case "create_list_in_folder": {
        const args = request.params.arguments as unknown as CreateListData & {
          folderId?: string;
          folderName?: string;
          spaceId?: string;
          spaceName?: string;
        };

        if (!args.name) {
          throw new Error("name is required");
        }

        let folderId = args.folderId;
        if (!folderId && args.folderName) {
          const result = await clickup.findFolderByNameGlobally(config.teamId, args.folderName);
          if (!result) {
            throw new Error(`Folder with name "${args.folderName}" not found`);
          }
          folderId = result.folder.id;
        }

        if (!folderId) {
          throw new Error("Either folderId or folderName is required");
        }

        const listData = {
          name: args.name,
          content: args.content,
          status: args.status
        };

        try {
          const list = await clickup.createListInFolder(folderId, listData);
          return {
            content: [{
              type: "text",
              text: `Created list ${list.id}: ${list.name} in folder`
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to create list: ${error.message}`);
        }
      }

      case "move_task": {
        const args = request.params.arguments as {
          taskId: string;
          listId?: string;
          listName?: string;
        };
        
        if (!args.taskId) {
          throw new Error("taskId is required");
        }

        let listId = args.listId;
        if (!listId && args.listName) {
          const result = await clickup.findListByNameGlobally(config.teamId, args.listName);
          if (!result) {
            throw new Error(`List with name "${args.listName}" not found`);
          }
          listId = result.list.id;
        }

        if (!listId) {
          throw new Error("Either listId or listName is required");
        }

        const task = await clickup.moveTask(args.taskId, listId);
        return {
          content: [{
            type: "text",
            text: `Moved task ${task.id} to list ${listId}`
          }]
        };
      }

      case "duplicate_task": {
        const args = request.params.arguments as {
          taskId: string;
          listId?: string;
          listName?: string;
        };
        
        if (!args.taskId) {
          throw new Error("taskId is required");
        }

        let listId = args.listId;
        if (!listId && args.listName) {
          const result = await clickup.findListByNameGlobally(config.teamId, args.listName);
          if (!result) {
            throw new Error(`List with name "${args.listName}" not found`);
          }
          listId = result.list.id;
        }

        if (!listId) {
          throw new Error("Either listId or listName is required");
        }

        const task = await clickup.duplicateTask(args.taskId, listId);
        return {
          content: [{
            type: "text",
            text: `Duplicated task ${args.taskId} to new task ${task.id} in list ${listId}`
          }]
        };
      }

      case "update_task": {
        const args = request.params.arguments as {
          taskId: string;
          name?: string;
          description?: string;
          status?: string;
          priority?: number;
          due_date?: string;
        };
        
        if (!args.taskId) {
          throw new Error("taskId is required");
        }

        const task = await clickup.updateTask(args.taskId, {
          name: args.name,
          description: args.description,
          status: args.status,
          priority: args.priority,
          due_date: args.due_date
        });
        return {
          content: [{
            type: "text",
            text: `Updated task ${task.id}: ${task.name}`
          }]
        };
      }

      default:
        throw new Error("Unknown tool");
    }
  } catch (error: any) {
    console.error('Error executing tool:', error);
    throw error;
  }
});

/**
 * Handler for listing available prompts.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "summarize_tasks",
        description: "Summarize all ClickUp tasks"
      },
      {
        name: "analyze_task_priorities",
        description: "Analyze task priorities"
      }
    ]
  };
});

/**
 * Handler for getting a specific prompt.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "summarize_tasks": {
        const output = await handleSummarizeTasks(clickup, config.teamId);
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      }

      case "analyze_task_priorities": {
        const output = await handleAnalyzeTaskPriorities(clickup, config.teamId);
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      }

      default:
        throw new Error("Prompt not found");
    }
  } catch (error) {
    console.error('Error getting prompt:', error);
    throw error;
  }
});

if (process.argv.includes('--stdio')) {
  console.log('Starting server in stdio mode...');
  
  // Set up stdio transport
  const transport = new StdioServerTransport();
  
  // Connect server with better error handling
  server.connect(transport)
    .then(() => {
      console.log('Server connected successfully to stdio transport');
      
      // Keep the process alive
      process.stdin.resume();
      
      // Handle process termination
      process.on('SIGINT', () => {
        console.log('Received SIGINT. Shutting down...');
        transport.close();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('Received SIGTERM. Shutting down...');
        transport.close();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Failed to connect server to transport:', error);
      process.exit(1);
    });
} else {
  console.log('Starting server in standard mode...');
  // Add your non-stdio server initialization here if needed
}

// Prevent unhandled promise rejections from crashing the server
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});