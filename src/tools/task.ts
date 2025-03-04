/**
 * ClickUp MCP Task Tools
 * 
 * This module defines task-related tools including creating, updating, 
 * moving, duplicating, and deleting tasks. It also provides tools for 
 * retrieving task details.
 */

import { 
  CreateTaskData, 
  UpdateTaskData,
  TaskPriority,
  ClickUpTask,
  TaskFilters,
  TasksResponse
} from '../services/clickup/types.js';
import { createClickUpServices } from '../services/clickup/index.js';
import config from '../config.js';
import { findListIDByName } from './list.js';
import { parseDueDate } from './utils.js';

// Initialize ClickUp services using the factory function
const services = createClickUpServices({
  apiKey: config.clickupApiKey,
  teamId: config.clickupTeamId
});

// Extract the services we need for task operations
const { task: taskService, workspace: workspaceService } = services;

/**
 * Creates a task in a ClickUp list
 */
export const createTaskTool = {
  name: "create_task",
  description: "Create a single task in a ClickUp list. Use this tool for individual task creation only. For multiple tasks, use create_bulk_tasks instead. Before calling this tool, check if you already have the necessary list ID from previous responses in the conversation history, as this avoids redundant lookups. When creating a task, you must provide either a listId or listName.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the task. Put a relevant emoji followed by a blank space before the name."
      },
      description: {
        type: "string",
        description: "Plain text description for the task"
      },
      markdown_description: {
        type: "string",
        description: "Markdown formatted description for the task. If provided, this takes precedence over description"
      },
      listId: {
        type: "string",
        description: "ID of the list to create the task in (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to create the task in - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      status: {
        type: "string",
        description: "OPTIONAL: Override the default ClickUp status. In most cases, you should omit this to use ClickUp defaults"
      },
      priority: {
        type: "number",
        description: "Priority of the task (1-4), where 1 is urgent/highest priority and 4 is lowest priority. Only set this when the user explicitly requests a priority level."
      },
      dueDate: {
        type: "string",
        description: "Due date of the task (Unix timestamp in milliseconds). Convert dates to this format before submitting."
      }
    },
    required: ["name"]
  },
  async handler({ name, description, markdown_description, dueDate, priority, status, listId, listName }: {
    name: string;
    description?: string;
    markdown_description?: string;
    dueDate?: string;
    priority?: number;
    status?: string;
    listId?: string;
    listName?: string;
  }) {
    let targetListId = listId;
    
    // If no listId but listName is provided, look up the list ID
    if (!targetListId && listName) {
      // Use workspace service to find list by name
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      targetListId = listInfo.id;
    }
    
    if (!targetListId) {
      throw new Error("Either listId or listName must be provided");
    }

    // Prepare task data
    const taskData: CreateTaskData = {
      name,
      description,
      markdown_description,
      status,
      priority: priority as TaskPriority,
      due_date: dueDate ? parseInt(dueDate) : undefined
    };

    // Create the task
    const createdTask = await taskService.createTask(targetListId, taskData);

    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: createdTask.id,
          name: createdTask.name,
          url: createdTask.url,
          status: createdTask.status?.status || "New",
          list: createdTask.list.name,
          space: createdTask.space.name,
          folder: createdTask.folder?.name
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for updating a task
 */
export const updateTaskTool = {
  name: "update_task",
  description: "Modify the properties of an existing task. Use this tool when you need to change a task's name, description, status, priority, or due date. Before calling, check if you already have the necessary task ID from previous responses in the conversation, as this avoids redundant lookups. Only the fields you specify will be updated; other fields will remain unchanged.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to update (optional if using taskName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      taskName: {
        type: "string",
        description: "Name of the task to update - will automatically find the task by name (optional if using taskId instead). Only use this if you don't already have the task ID from previous responses."
      },
      listName: {
        type: "string",
        description: "Optional: Name of the list to narrow down task search when multiple tasks have the same name"
      },
      name: {
        type: "string",
        description: "New name for the task"
      },
      description: {
        type: "string",
        description: "New plain text description for the task"
      },
      markdown_description: {
        type: "string",
        description: "New markdown formatted description for the task. If provided, this takes precedence over description"
      },
      status: {
        type: "string",
        description: "New status for the task (must be a valid status in the task's list)"
      },
      priority: {
        type: ["number", "null"],
        enum: [1, 2, 3, 4, null],
        description: "New priority for the task (1-4 or null), where 1 is urgent/highest priority and 4 is lowest priority. Set to null to clear priority."
      }
    },
    required: []
  },
  async handler({ taskId, taskName, listName, name, description, markdown_description, status, priority }: {
    taskId?: string;
    taskName?: string;
    listName?: string;
    name?: string;
    description?: string;
    markdown_description?: string;
    status?: string;
    priority?: number | null;
  }) {
    let targetTaskId = taskId;
    
    // If no taskId but taskName is provided, look up the task ID
    if (!targetTaskId && taskName) {
      // First find the list ID if listName is provided
      let listId: string | undefined;
      
      if (listName) {
        const hierarchy = await workspaceService.getWorkspaceHierarchy();
        const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
        
        if (!listInfo) {
          throw new Error(`List "${listName}" not found`);
        }
        listId = listInfo.id;
      }
      
      // Now find the task
      const tasks = await taskService.getTasks(listId || '');
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
      }
      targetTaskId = foundTask.id;
    }
    
    if (!targetTaskId) {
      throw new Error("Either taskId or taskName must be provided");
    }
    
    // Prepare update data
    const updateData: UpdateTaskData = {
      name,
      description,
      markdown_description,
      status,
      priority: priority as TaskPriority
    };
    
    // Update the task
    const updatedTask = await taskService.updateTask(targetTaskId, updateData);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: updatedTask.id,
          name: updatedTask.name,
          url: updatedTask.url,
          status: updatedTask.status?.status || "Unknown",
          updated: true
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for moving a task
 */
export const moveTaskTool = {
  name: "move_task",
  description: "Move an existing task from its current list to a different list. Use this tool when you need to relocate a task within your workspace hierarchy. Before calling, check if you already have the necessary task ID and list ID from previous responses in the conversation, as this avoids redundant lookups. Task statuses may be reset if the destination list uses different status options.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to move (optional if using taskName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      taskName: {
        type: "string",
        description: "Name of the task to move - will automatically find the task by name (optional if using taskId instead). Only use this if you don't already have the task ID from previous responses."
      },
      listId: {
        type: "string",
        description: "ID of the destination list (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the destination list - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      sourceListName: {
        type: "string",
        description: "Optional: Name of the source list to narrow down task search when multiple tasks have the same name"
      }
    },
    required: []
  },
  async handler({ taskId, taskName, listId, listName, sourceListName }: {
    taskId?: string;
    taskName?: string;
    listId?: string;
    listName?: string;
    sourceListName?: string;
  }) {
    let targetTaskId = taskId;
    let targetListId = listId;
    
    // If no taskId but taskName is provided, look up the task ID
    if (!targetTaskId && taskName) {
      // First find the source list ID if sourceListName is provided
      let sourceListId: string | undefined;
      
      if (sourceListName) {
        const hierarchy = await workspaceService.getWorkspaceHierarchy();
        const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, sourceListName, 'list');
        
        if (!listInfo) {
          throw new Error(`Source list "${sourceListName}" not found`);
        }
        sourceListId = listInfo.id;
      }
      
      // Now find the task
      const tasks = await taskService.getTasks(sourceListId || '');
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found${sourceListName ? ` in list "${sourceListName}"` : ""}`);
      }
      targetTaskId = foundTask.id;
    }
    
    if (!targetTaskId) {
      throw new Error("Either taskId or taskName must be provided");
    }
    
    // If no listId but listName is provided, look up the list ID
    if (!targetListId && listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      targetListId = listInfo.id;
    }
    
    if (!targetListId) {
      throw new Error("Either listId or listName must be provided");
    }
    
    // Move the task
    const movedTask = await taskService.moveTask(targetTaskId, targetListId);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: movedTask.id,
          name: movedTask.name,
          url: movedTask.url,
          status: movedTask.status?.status || "Unknown",
          list: movedTask.list.name,
          moved: true
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for duplicating a task
 */
export const duplicateTaskTool = {
  name: "duplicate_task",
  description: "Create a copy of an existing task in the same or different list. Use this tool when you need to replicate a task's content and properties. Before calling, check if you already have the necessary task ID and list ID from previous responses in the conversation, as this avoids redundant lookups. The duplicate will preserve name, description, priority, and other attributes from the original task.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to duplicate (optional if using taskName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      taskName: {
        type: "string",
        description: "Name of the task to duplicate - will automatically find the task by name (optional if using taskId instead). Only use this if you don't already have the task ID from previous responses."
      },
      listId: {
        type: "string",
        description: "ID of the list to create the duplicate in (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to create the duplicate in - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      sourceListName: {
        type: "string",
        description: "Optional: Name of the source list to narrow down task search when multiple tasks have the same name"
      }
    },
    required: []
  },
  async handler({ taskId, taskName, listId, listName, sourceListName }: {
    taskId?: string;
    taskName?: string;
    listId?: string;
    listName?: string;
    sourceListName?: string;
  }) {
    let targetTaskId = taskId;
    let targetListId = listId;
    
    // If no taskId but taskName is provided, look up the task ID
    if (!targetTaskId && taskName) {
      // First find the source list ID if sourceListName is provided
      let sourceListId: string | undefined;
      
      if (sourceListName) {
        const hierarchy = await workspaceService.getWorkspaceHierarchy();
        const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, sourceListName, 'list');
        
        if (!listInfo) {
          throw new Error(`Source list "${sourceListName}" not found`);
        }
        sourceListId = listInfo.id;
      }
      
      // Now find the task
      const tasks = await taskService.getTasks(sourceListId || '');
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found${sourceListName ? ` in list "${sourceListName}"` : ""}`);
      }
      targetTaskId = foundTask.id;
    }
    
    if (!targetTaskId) {
      throw new Error("Either taskId or taskName must be provided");
    }
    
    // If no listId but listName is provided, look up the list ID
    if (!targetListId && listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      targetListId = listInfo.id;
    }
    
    // Duplicate the task
    const duplicatedTask = await taskService.duplicateTask(targetTaskId, targetListId);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: duplicatedTask.id,
          name: duplicatedTask.name,
          url: duplicatedTask.url,
          status: duplicatedTask.status?.status || "Unknown",
          list: duplicatedTask.list.name,
          duplicated: true
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for getting a task
 */
export const getTaskTool = {
  name: "get_task",
  description: "Retrieve comprehensive details about a specific ClickUp task. Use this tool when you need in-depth information about a particular task, including its description, custom fields, attachments, and other metadata. Before calling, check if you already have the necessary task ID from previous responses in the conversation, as this avoids redundant lookups.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to retrieve (optional if using taskName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      taskName: {
        type: "string",
        description: "Name of the task to retrieve - will automatically find the task by name (optional if using taskId instead). Only use this if you don't already have the task ID from previous responses."
      },
      listName: {
        type: "string",
        description: "Optional: Name of the list to narrow down task search when multiple tasks have the same name"
      }
    },
    required: []
  },
  async handler({ taskId, taskName, listName }: {
    taskId?: string;
    taskName?: string;
    listName?: string;
  }) {
    let targetTaskId = taskId;
    
    // If no taskId but taskName is provided, look up the task ID
    if (!targetTaskId && taskName) {
      let listId: string | undefined;
      
      if (listName) {
        const hierarchy = await workspaceService.getWorkspaceHierarchy();
        const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
        
        if (!listInfo) {
          throw new Error(`List "${listName}" not found`);
        }
        listId = listInfo.id;
      }
      
      // Now find the task
      const tasks = await taskService.getTasks(listId || '');
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
      }
      targetTaskId = foundTask.id;
    }
    
    if (!targetTaskId) {
      throw new Error("Either taskId or taskName must be provided");
    }
    
    // Get the task
    const task = await taskService.getTask(targetTaskId);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: task.id,
          name: task.name,
          description: task.description,
          status: task.status?.status || "Unknown",
          priority: task.priority,
          due_date: task.due_date,
          url: task.url,
          list: task.list.name,
          space: task.space.name,
          folder: task.folder?.name,
          creator: task.creator,
          assignees: task.assignees,
          tags: task.tags,
          time_estimate: task.time_estimate,
          time_spent: task.time_spent,
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for getting tasks
 */
export const getTasksTool = {
  name: "get_tasks",
  description: "Retrieve tasks from a ClickUp list with optional filtering capabilities. Use this tool when you need to see existing tasks or analyze your current workload. Before calling, check if you already have the necessary list ID from previous responses in the conversation, as this avoids redundant lookups. Results can be filtered by status, assignees, dates, and more.",
  inputSchema: {
    type: "object",
    properties: {
      listId: {
        type: "string",
        description: "ID of the list to get tasks from (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to get tasks from - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      archived: {
        type: "boolean",
        description: "Set to true to include archived tasks in the results"
      },
      page: {
        type: "number",
        description: "Page number for pagination when dealing with many tasks (starts at 0)"
      },
      order_by: {
        type: "string",
        description: "Field to order tasks by (e.g., 'due_date', 'created', 'updated')"
      },
      reverse: {
        type: "boolean",
        description: "Set to true to reverse the sort order (descending instead of ascending)"
      },
      subtasks: {
        type: "boolean",
        description: "Set to true to include subtasks in the results"
      },
      statuses: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of status names to filter tasks by (e.g., ['To Do', 'In Progress'])"
      },
      include_closed: {
        type: "boolean",
        description: "Set to true to include tasks with 'Closed' status"
      },
      assignees: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of user IDs to filter tasks by assignee"
      },
      due_date_gt: {
        type: "number",
        description: "Filter tasks due after this timestamp (Unix milliseconds)"
      },
      due_date_lt: {
        type: "number",
        description: "Filter tasks due before this timestamp (Unix milliseconds)"
      },
      date_created_gt: {
        type: "number",
        description: "Filter tasks created after this timestamp (Unix milliseconds)"
      },
      date_created_lt: {
        type: "number",
        description: "Filter tasks created before this timestamp (Unix milliseconds)"
      },
      date_updated_gt: {
        type: "number",
        description: "Filter tasks updated after this timestamp (Unix milliseconds)"
      },
      date_updated_lt: {
        type: "number",
        description: "Filter tasks updated before this timestamp (Unix milliseconds)"
      },
      custom_fields: {
        type: "object",
        description: "Object with custom field IDs as keys and desired values for filtering"
      }
    },
    required: []
  },
  async handler({ listId, listName, archived, include_closed, subtasks, page, order_by, reverse, statuses, assignees, due_date_gt, due_date_lt, date_created_gt, date_created_lt, date_updated_gt, date_updated_lt, custom_fields }: {
    listId?: string;
    listName?: string;
    archived?: boolean;
    include_closed?: boolean;
    subtasks?: boolean;
    page?: number;
    order_by?: 'id' | 'created' | 'updated' | 'due_date';
    reverse?: boolean;
    statuses?: string[];
    assignees?: string[];
    due_date_gt?: number;
    due_date_lt?: number;
    date_created_gt?: number;
    date_created_lt?: number;
    date_updated_gt?: number;
    date_updated_lt?: number;
    custom_fields?: Record<string, any>;
  }) {
    let targetListId = listId;
    
    // If no listId but listName is provided, look up the list ID
    if (!targetListId && listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      targetListId = listInfo.id;
    }
    
    if (!targetListId) {
      throw new Error("Either listId or listName must be provided");
    }
    
    // Prepare filters - remove archived as it's not in TaskFilters
    const filters: TaskFilters = {
      include_closed,
      subtasks,
      page,
      order_by,
      reverse,
      statuses,
      assignees,
      due_date_gt,
      due_date_lt,
      date_created_gt,
      date_created_lt,
      date_updated_gt,
      date_updated_lt,
      custom_fields
    };
    
    // Get tasks with filters
    const tasks = await taskService.getTasks(targetListId, filters);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          task_count: tasks.length,
          tasks: tasks.map((task: ClickUpTask) => ({
            id: task.id,
            name: task.name,
            status: task.status?.status || "Unknown",
            priority: task.priority,
            due_date: task.due_date,
            url: task.url
          }))
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for deleting a task
 */
export const deleteTaskTool = {
  name: "delete_task",
  description: "Permanently remove a task from your ClickUp workspace. Use this tool with caution as deletion cannot be undone. Before calling, check if you already have the necessary task ID from previous responses in the conversation, as this avoids redundant lookups. For safety, the task ID is required.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to delete - this is required for safety to prevent accidental deletions. If you have this ID from a previous response, use it directly."
      },
      taskName: {
        type: "string",
        description: "Name of the task to delete - will automatically find the task by name (optional if using taskId instead). Only use this if you don't already have the task ID from previous responses."
      },
      listName: {
        type: "string",
        description: "Optional: Name of the list to narrow down task search when multiple tasks have the same name"
      }
    },
    required: []
  },
  async handler({ taskId, taskName, listName }: {
    taskId?: string;
    taskName?: string;
    listName?: string;
  }) {
    let targetTaskId = taskId;
    
    // If no taskId but taskName is provided, look up the task ID
    if (!targetTaskId && taskName) {
      // First find the list ID if listName is provided
      let listId: string | undefined;
      
      if (listName) {
        const hierarchy = await workspaceService.getWorkspaceHierarchy();
        const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
        
        if (!listInfo) {
          throw new Error(`List "${listName}" not found`);
        }
        listId = listInfo.id;
      }
      
      // Now find the task
      const tasks = await taskService.getTasks(listId || '');
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
      }
      targetTaskId = foundTask.id;
    }
    
    if (!targetTaskId) {
      throw new Error("Either taskId or taskName must be provided");
    }
    
    // Try to get task info for the response
    let taskInfo;
    try {
      taskInfo = await taskService.getTask(targetTaskId);
    } catch (error) {
      // If we can't get the task info, we'll continue with deletion anyway
      console.warn(`Could not get task info before deletion: ${error}`);
    }
    
    // Delete the task
    const result = await taskService.deleteTask(targetTaskId);
    
    // Format response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: result.success,
          deleted: true,
          task_info: taskInfo ? {
            id: taskInfo.id,
            name: taskInfo.name,
            list: taskInfo.list.name
          } : { id: targetTaskId }
        }, null, 2)
      }]
    };
  }
};

/**
 * Tool definition for creating multiple tasks at once
 */
export const createBulkTasksTool = {
  name: "create_bulk_tasks",
  description: "Create multiple tasks in a ClickUp list simultaneously with advanced processing options. Use this tool when you need to add multiple related tasks in a single operation. Supports configurable batching, concurrency, and error handling. More efficient than creating tasks one by one.",
  inputSchema: {
    type: "object",
    properties: {
      listId: {
        type: "string",
        description: "ID of the list to create the tasks in (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to create the tasks in - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      tasks: {
        type: "array",
        description: "Array of tasks to create (at least one task required)",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the task. Consider adding a relevant emoji before the name."
            },
            description: {
              type: "string",
              description: "Plain text description for the task"
            },
            markdown_description: {
              type: "string",
              description: "Markdown formatted description for the task. If provided, this takes precedence over description"
            },
            status: {
              type: "string",
              description: "OPTIONAL: Override the default ClickUp status. In most cases, you should omit this to use ClickUp defaults"
            },
            priority: {
              type: "number",
              description: "Priority level (1-4), where 1 is urgent/highest priority and 4 is lowest priority. Only set when explicitly requested."
            },
            dueDate: {
              type: "string",
              description: "Due date (Unix timestamp in milliseconds). Convert dates to this format before submitting."
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
      },
      options: {
        type: "object",
        description: "Optional advanced processing options for the bulk operation",
        properties: {
          batchSize: {
            type: "number",
            description: "Number of tasks to process in each batch (default: 10). Larger batches are faster but may hit rate limits."
          },
          concurrency: {
            type: "number",
            description: "Number of operations to run concurrently (default: 1). Higher concurrency may improve performance but increases API load."
          },
          continueOnError: {
            type: "boolean",
            description: "Whether to continue processing if some tasks fail (default: true). Set to false to stop on first error."
          },
          retryCount: {
            type: "number",
            description: "Number of retry attempts for failed operations (default: 3)"
          }
        }
      }
    },
    required: ["tasks"]
  }
};

/**
 * Tool definition for bulk task updates
 */
export const updateBulkTasksTool = {
  name: "update_bulk_tasks",
  description: "Update multiple tasks simultaneously with properties like name, description, status, or priority. Tasks can be identified by Task ID or by Task name + list name.",
  inputSchema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to update (optional if using taskName)"
            },
            taskName: {
              type: "string",
              description: "Name of the task to update (optional if using taskId)"
            },
            listName: {
              type: "string",
              description: "Required when using taskName: Name of the list containing the task"
            },
            name: {
              type: "string",
              description: "New name for the task"
            },
            description: {
              type: "string",
              description: "New plain text description"
            },
            markdown_description: {
              type: "string",
              description: "New markdown formatted description"
            },
            status: {
              type: "string",
              description: "New status for the task"
            },
            priority: {
              type: ["number", "null"],
              enum: [1, 2, 3, 4, null],
              description: "New priority (1-4 or null)"
            }
          }
        }
      }
    },
    required: ["tasks"]
  }
};

/**
 * Handler for bulk task updates
 */
export async function handleUpdateBulkTasks({ tasks }: { tasks: any[] }) {
  if (!tasks || !tasks.length) {
    throw new Error("No tasks provided for bulk update");
  }

  const results = {
    total: tasks.length,
    successful: 0,
    failed: 0,
    failures: [] as any[]
  };

  for (const task of tasks) {
    try {
      let taskId = task.taskId;
      
      if (!taskId && task.taskName) {
        if (!task.listName) {
          throw new Error(`List name is required when using task name for task "${task.taskName}"`);
        }
        
        const listInfo = await findListIDByName(workspaceService, task.listName);
        if (!listInfo) {
          throw new Error(`List "${task.listName}" not found`);
        }
        const taskList = await taskService.getTasks(listInfo.id);
        const foundTask = taskList.find(t => t.name.toLowerCase() === task.taskName.toLowerCase());
        
        if (!foundTask) {
          throw new Error(`Task "${task.taskName}" not found in list "${task.listName}"`);
        }
        taskId = foundTask.id;
      }

      if (!taskId) {
        throw new Error("Either taskId or taskName must be provided");
      }

      await taskService.updateTask(taskId, {
        name: task.name,
        description: task.description,
        markdown_description: task.markdown_description,
        status: task.status,
        priority: task.priority as TaskPriority
      });

      results.successful++;
    } catch (error: any) {
      results.failed++;
      results.failures.push({
        task: task.taskId || task.taskName,
        error: error.message
      });
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(results, null, 2)
    }]
  };
}

/**
 * Tool definition for bulk task moves
 */
export const moveBulkTasksTool = {
  name: "move_bulk_tasks",
  description: "Move multiple tasks to a different list simultaneously. Tasks can be identified by Task ID or by Task name + list name.",
  inputSchema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to move (optional if using taskName)"
            },
            taskName: {
              type: "string",
              description: "Name of the task to move (optional if using taskId)"
            },
            listName: {
              type: "string",
              description: "Required when using taskName: Name of the list containing the task"
            }
          }
        }
      },
      targetListId: {
        type: "string",
        description: "ID of the destination list (optional if using targetListName)"
      },
      targetListName: {
        type: "string",
        description: "Name of the destination list (optional if using targetListId)"
      }
    },
    required: ["tasks"]
  }
};

/**
 * Handler for bulk task moves
 */
export async function handleMoveBulkTasks({ tasks, targetListId, targetListName }: { 
  tasks: any[],
  targetListId?: string,
  targetListName?: string
}) {
  if (!tasks || !tasks.length) {
    throw new Error("No tasks provided for bulk move");
  }

  // Get target list ID if name provided
  let destinationListId = targetListId;
  if (!destinationListId && targetListName) {
    const listInfo = await findListIDByName(workspaceService, targetListName);
    if (!listInfo) {
      throw new Error(`Target list "${targetListName}" not found`);
    }
    destinationListId = listInfo.id;
  }

  if (!destinationListId) {
    throw new Error("Either targetListId or targetListName must be provided");
  }

  // Collect all task IDs first
  const taskIds: string[] = [];
  const results = {
    total: tasks.length,
    successful: 0,
    failed: 0,
    failures: [] as any[]
  };

  // First pass: collect all task IDs
  for (const task of tasks) {
    try {
      let taskId = task.taskId;
      
      if (!taskId && task.taskName) {
        if (!task.listName) {
          throw new Error(`List name is required when using task name for task "${task.taskName}"`);
        }
        
        const listInfo = await findListIDByName(workspaceService, task.listName);
        if (!listInfo) {
          throw new Error(`List "${task.listName}" not found`);
        }
        const taskList = await taskService.getTasks(listInfo.id);
        const foundTask = taskList.find(t => t.name.toLowerCase() === task.taskName.toLowerCase());
        
        if (!foundTask) {
          throw new Error(`Task "${task.taskName}" not found in list "${task.listName}"`);
        }
        taskId = foundTask.id;
      }

      if (!taskId) {
        throw new Error("Either taskId or taskName must be provided");
      }

      taskIds.push(taskId);
    } catch (error: any) {
      results.failed++;
      results.failures.push({
        task: task.taskId || task.taskName,
        error: error.message
      });
    }
  }

  // If we have task IDs to process, do the bulk move
  if (taskIds.length > 0) {
    try {
      const moveResult = await taskService.moveBulkTasks(taskIds, destinationListId);
      results.successful = moveResult.successfulItems.length;
      // Update failed count to include both lookup failures and move failures
      results.failed += moveResult.failedItems.length;
      results.failures.push(...moveResult.failedItems.map(failure => ({
        task: failure.item,
        error: failure.error.message
      })));
    } catch (error: any) {
      // If the bulk operation itself fails, mark remaining tasks as failed
      const remainingTasks = taskIds.length;
      results.failed += remainingTasks;
      results.failures.push({
        task: 'Bulk operation',
        error: error.message
      });
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(results, null, 2)
    }]
  };
}

/**
 * Handler for bulk task creation
 */
export async function handleCreateBulkTasks(parameters: any) {
  // Validate required parameters
  const { tasks, listId, listName } = parameters;
  
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('You must provide a non-empty array of tasks to create');
  }

  let targetListId = listId;
      
  // If no listId but listName is provided, look up the list ID
  if (!targetListId && listName) {
    const listInfo = await findListIDByName(workspaceService, listName);
    if (!listInfo) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listInfo.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }

  const results = {
    total: tasks.length,
    successful: 0,
    failed: 0,
    failures: [] as any[]
  };

  // Create tasks in bulk using the task service
  try {
    const bulkResult = await taskService.createBulkTasks(targetListId, { tasks });
    
    // Update results based on bulk operation outcome
    results.successful = bulkResult.successfulItems.length;
    results.failed = bulkResult.failedItems.length;
    results.failures = bulkResult.failedItems.map(failure => ({
      task: failure.item.name,
      error: failure.error.message
    }));
  } catch (error: any) {
    // If the bulk operation itself fails, mark all tasks as failed
    results.failed = tasks.length;
    results.failures = tasks.map(task => ({
      task: task.name,
      error: error.message
    }));
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(results, null, 2)
    }]
  };
}

/**
 * Handler for the create_task tool
 */
export async function handleCreateTask(parameters: any) {
  const { name, description, markdown_description, listId, listName, status, priority, dueDate } = parameters;
  
  // Validate required fields
  if (!name) {
    throw new Error("Task name is required");
  }
  
  let targetListId = listId;
  
  // If no listId but listName is provided, look up the list ID
  if (!targetListId && listName) {
    // Use workspace service to find the list by name in the hierarchy
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
    
    if (!listInfo) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listInfo.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }

  // Prepare task data
  const taskData: CreateTaskData = {
    name,
    description,
    markdown_description,
    status,
    priority: priority as TaskPriority,
    due_date: dueDate ? parseInt(dueDate) : undefined
  };

  // Create the task
  const task = await taskService.createTask(targetListId, taskData);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        id: task.id,
        name: task.name,
        url: task.url,
        status: task.status?.status || "New",
        list: task.list.name,
        space: task.space.name,
        folder: task.folder?.name
      }, null, 2)
    }]
  };
}

/**
 * Handler for the update_task tool
 */
export async function handleUpdateTask(parameters: any) {
  const { taskId, taskName, listName, name, description, markdown_description, status, priority } = parameters;
  
  let targetTaskId = taskId;
  
  // If no taskId but taskName is provided, look up the task ID
  if (!targetTaskId && taskName) {
    let listId: string | undefined;
    
    // If listName is provided, find the list ID first
    if (listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      listId = listInfo.id;
    }
    
    // Now find the task
    const tasks = await taskService.getTasks(listId || '');
    const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
    
    if (!foundTask) {
      throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
    }
    targetTaskId = foundTask.id;
  }
  
  if (!targetTaskId) {
    throw new Error("Either taskId or taskName must be provided");
  }

  // Prepare update data
  const updateData: UpdateTaskData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (markdown_description !== undefined) updateData.markdown_description = markdown_description;
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority as TaskPriority;

  // Update the task
  const task = await taskService.updateTask(targetTaskId, updateData);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        id: task.id,
        name: task.name,
        url: task.url,
        status: task.status?.status || "Unknown",
        updated: true,
        list: task.list.name,
        space: task.space.name,
        folder: task.folder?.name
      }, null, 2)
    }]
  };
}

/**
 * Handler for the move_task tool
 */
export async function handleMoveTask(parameters: any) {
  const { taskId, taskName, sourceListName, listId, listName } = parameters;
  
  let targetTaskId = taskId;
  let sourceListId: string | undefined;
  
  // If sourceListName is provided, find the source list ID
  if (sourceListName) {
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, sourceListName, 'list');
    
    if (!listInfo) {
      throw new Error(`Source list "${sourceListName}" not found`);
    }
    sourceListId = listInfo.id;
  }
  
  // If no taskId but taskName is provided, look up the task ID
  if (!targetTaskId && taskName) {
    // Find the task in the source list if specified, otherwise search all tasks
    if (sourceListId) {
      const tasks = await taskService.getTasks(sourceListId);
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found in list "${sourceListName}"`);
      }
      targetTaskId = foundTask.id;
    } else {
      // Without a source list, we need to search more broadly
      // This is less efficient but necessary if source list is unknown
      throw new Error("When using taskName, sourceListName must be provided to find the task");
    }
  }
  
  if (!targetTaskId) {
    throw new Error("Either taskId or taskName (with sourceListName) must be provided");
  }
  
  let targetListId = listId;
  
  // If no listId but listName is provided, look up the list ID
  if (!targetListId && listName) {
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
    
    if (!listInfo) {
      throw new Error(`Target list "${listName}" not found`);
    }
    targetListId = listInfo.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided for the target list");
  }

  // Move the task
  const task = await taskService.moveTask(targetTaskId, targetListId);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        id: task.id,
        name: task.name,
        url: task.url,
        moved: true,
        list: task.list.name,
        space: task.space.name,
        folder: task.folder?.name
      }, null, 2)
    }]
  };
}

/**
 * Handler for the duplicate_task tool
 */
export async function handleDuplicateTask(parameters: any) {
  const { taskId, taskName, sourceListName, listId, listName } = parameters;
  
  let targetTaskId = taskId;
  let sourceListId: string | undefined;
  
  // If sourceListName is provided, find the source list ID
  if (sourceListName) {
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, sourceListName, 'list');
    
    if (!listInfo) {
      throw new Error(`Source list "${sourceListName}" not found`);
    }
    sourceListId = listInfo.id;
  }
  
  // If no taskId but taskName is provided, look up the task ID
  if (!targetTaskId && taskName) {
    // Find the task in the source list if specified, otherwise search all tasks
    if (sourceListId) {
      const tasks = await taskService.getTasks(sourceListId);
      const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
      
      if (!foundTask) {
        throw new Error(`Task "${taskName}" not found in list "${sourceListName}"`);
      }
      targetTaskId = foundTask.id;
    } else {
      // Without a source list, we need to search more broadly
      throw new Error("When using taskName, sourceListName must be provided to find the task");
    }
  }
  
  if (!targetTaskId) {
    throw new Error("Either taskId or taskName (with sourceListName) must be provided");
  }
  
  let targetListId = listId;
  
  // If no listId but listName is provided, look up the list ID
  if (!targetListId && listName) {
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
    
    if (!listInfo) {
      throw new Error(`Target list "${listName}" not found`);
    }
    targetListId = listInfo.id;
  }
  
  // Duplicate the task
  const task = await taskService.duplicateTask(targetTaskId, targetListId);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        id: task.id,
        name: task.name,
        url: task.url,
        duplicated: true,
        list: task.list.name,
        space: task.space.name,
        folder: task.folder?.name
      }, null, 2)
    }]
  };
}

/**
 * Handler for the get_task tool
 */
export async function handleGetTask(parameters: any) {
  const { taskId, taskName, listName } = parameters;
  
  let targetTaskId = taskId;
  
  // If no taskId but taskName is provided, look up the task ID
  if (!targetTaskId && taskName) {
    let listId: string | undefined;
    
    // If listName is provided, find the list ID first
    if (listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      listId = listInfo.id;
    }
    
    // Now find the task
    const tasks = await taskService.getTasks(listId || '');
    const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
    
    if (!foundTask) {
      throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
    }
    targetTaskId = foundTask.id;
  }
  
  if (!targetTaskId) {
    throw new Error("Either taskId or taskName must be provided");
  }

  // Get the task
  const task = await taskService.getTask(targetTaskId);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify(task, null, 2)
    }]
  };
}

/**
 * Handler for the get_tasks tool
 */
export async function handleGetTasks(parameters: any) {
  const { 
    listId, listName, archived, page, order_by, reverse, 
    subtasks, statuses, include_closed, assignees, 
    due_date_gt, due_date_lt, date_created_gt, date_created_lt, 
    date_updated_gt, date_updated_lt, custom_fields 
  } = parameters;
  
  let targetListId = listId;
  
  // If no listId but listName is provided, look up the list ID
  if (!targetListId && listName) {
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
    
    if (!listInfo) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listInfo.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }

  // Prepare filter options - remove archived as it's not in TaskFilters
  const filters: TaskFilters = {
    page,
    order_by,
    reverse,
    subtasks,
    statuses,
    include_closed,
    assignees,
    due_date_gt,
    due_date_lt,
    date_created_gt,
    date_created_lt,
    date_updated_gt,
    date_updated_lt,
    custom_fields
  };

  // Get tasks with filters
  const tasks = await taskService.getTasks(targetListId, filters);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        list_id: targetListId,
        task_count: tasks.length,
        tasks: tasks.map((task: ClickUpTask) => ({
          id: task.id,
          name: task.name,
          status: task.status?.status || "Unknown",
          priority: task.priority,
          due_date: task.due_date,
          url: task.url
        }))
      }, null, 2)
    }]
  };
}

/**
 * Handler for the delete_task tool
 */
export async function handleDeleteTask(parameters: any) {
  const { taskId, taskName, listName } = parameters;
  
  let targetTaskId = taskId;
  
  // If no taskId but taskName is provided, look up the task ID
  if (!targetTaskId && taskName) {
    let listId: string | undefined;
    
    // If listName is provided, find the list ID first
    if (listName) {
      const hierarchy = await workspaceService.getWorkspaceHierarchy();
      const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
      
      if (!listInfo) {
        throw new Error(`List "${listName}" not found`);
      }
      listId = listInfo.id;
    }
    
    // Now find the task
    const tasks = await taskService.getTasks(listId || '');
    const foundTask = tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
    
    if (!foundTask) {
      throw new Error(`Task "${taskName}" not found${listName ? ` in list "${listName}"` : ""}`);
    }
    targetTaskId = foundTask.id;
  }
  
  if (!targetTaskId) {
    throw new Error("Either taskId or taskName must be provided");
  }

  // Get task info before deleting (for the response)
  let taskInfo;
  try {
    taskInfo = await taskService.getTask(targetTaskId);
  } catch (error) {
    // If we can't get the task info, we'll continue with deletion anyway
    console.error("Error fetching task before deletion:", error);
  }

  // Delete the task
  await taskService.deleteTask(targetTaskId);

  // Format response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        id: targetTaskId,
        name: taskInfo?.name || "Unknown",
        deleted: true,
        list: taskInfo?.list?.name || "Unknown",
        space: taskInfo?.space?.name || "Unknown"
      }, null, 2)
    }]
  };
} 