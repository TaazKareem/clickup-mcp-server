/**
 * ClickUp MCP List Tools
 * 
 * This module defines list-related tools including creating, updating,
 * retrieving, and deleting lists. It supports creating lists both in spaces
 * and in folders.
 */

import { 
  CreateListData, 
  ClickUpList
} from '../services/clickup/types.js';
import { createClickUpServices } from '../services/clickup/index.js';
import config from '../config.js';

// Initialize ClickUp services using the factory function
const services = createClickUpServices({
  apiKey: config.clickupApiKey,
  teamId: config.clickupTeamId
});

// Extract the services we need for list operations
const { list: listService, workspace: workspaceService } = services;

/**
 * Tool definition for creating a list directly in a space
 */
export const createListTool = {
  name: "create_list",
  description: "Create a new list directly in a ClickUp space. Use this tool when you need a top-level list not nested inside a folder. Before calling, check if you already have the necessary space ID from previous responses in the conversation, as this avoids redundant lookups. For creating lists inside folders, use create_list_in_folder instead.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the list"
      },
      spaceId: {
        type: "string",
        description: "ID of the space to create the list in (optional if using spaceName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      spaceName: {
        type: "string",
        description: "Name of the space to create the list in - will automatically find the space by name (optional if using spaceId instead). Only use this if you don't already have the space ID from previous responses."
      },
      content: {
        type: "string",
        description: "Description or content of the list"
      },
      dueDate: {
        type: "string",
        description: "Due date for the list (Unix timestamp in milliseconds). Convert dates to this format before submitting."
      },
      priority: {
        type: "number",
        description: "Priority of the list (1-4), where 1 is urgent/highest priority and 4 is lowest priority. Only set when explicitly requested."
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
};

/**
 * Tool definition for creating a list within a folder
 */
export const createListInFolderTool = {
  name: "create_list_in_folder",
  description: "Create a new list within a ClickUp folder. Use this tool when you need to add a list to an existing folder structure. Before calling, check if you already have the necessary folder ID and space ID from previous responses in the conversation, as this avoids redundant lookups. For top-level lists not in folders, use create_list instead.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the list"
      },
      folderId: {
        type: "string",
        description: "ID of the folder to create the list in (optional if using folderName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      folderName: {
        type: "string",
        description: "Name of the folder to create the list in - will automatically find the folder by name (optional if using folderId instead). Only use this if you don't already have the folder ID from previous responses."
      },
      spaceId: {
        type: "string",
        description: "ID of the space containing the folder (optional if using spaceName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      spaceName: {
        type: "string", 
        description: "Name of the space containing the folder - will automatically find the space by name (optional if using spaceId instead). Only use this if you don't already have the space ID from previous responses."
      },
      content: {
        type: "string",
        description: "Description or content of the list"
      },
      status: {
        type: "string",
        description: "Status of the list (uses folder default if not specified)"
      }
    },
    required: ["name"]
  }
};

/**
 * Tool definition for retrieving list details
 */
export const getListTool = {
  name: "get_list",
  description: "Retrieve details about a specific ClickUp list including its name, content, status options, and other metadata. Before calling, check if you already have the necessary list ID from previous responses in the conversation history, as this avoids redundant lookups. Useful to understand list structure before creating or updating tasks.",
  inputSchema: {
    type: "object",
    properties: {
      listId: {
        type: "string",
        description: "ID of the list to retrieve (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to retrieve - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      }
    },
    required: []
  }
};

/**
 * Tool definition for updating a list
 */
export const updateListTool = {
  name: "update_list",
  description: "Modify an existing ClickUp list's properties, such as name, content, or status options. Before calling, check if you already have the necessary list ID from previous responses in the conversation history, as this avoids redundant lookups. Use when reorganizing or renaming workspace elements.",
  inputSchema: {
    type: "object",
    properties: {
      listId: {
        type: "string",
        description: "ID of the list to update (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to update - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      },
      name: {
        type: "string",
        description: "New name for the list"
      },
      content: {
        type: "string",
        description: "New description or content for the list"
      },
      status: {
        type: "string",
        description: "New status for the list"
      }
    },
    required: []
  }
};

/**
 * Tool definition for deleting a list
 */
export const deleteListTool = {
  name: "delete_list",
  description: "Permanently remove a list from your ClickUp workspace. Use with caution as deletion cannot be undone and will remove all tasks within the list. Before calling, check if you already have the necessary list ID from previous responses in the conversation history, as this avoids redundant lookups.",
  inputSchema: {
    type: "object",
    properties: {
      listId: {
        type: "string",
        description: "ID of the list to delete (optional if using listName instead). If you have this ID from a previous response, use it directly rather than looking up by name."
      },
      listName: {
        type: "string",
        description: "Name of the list to delete - will automatically find the list by name (optional if using listId instead). Only use this if you don't already have the list ID from previous responses."
      }
    },
    required: []
  }
};

/**
 * Helper function to find a list ID by name
 * Uses the ClickUp service's global list search functionality
 */
export async function findListIDByName(workspaceService: any, listName: string): Promise<{ id: string; name: string } | null> {
  // Use workspace service to find the list in the hierarchy
  const hierarchy = await workspaceService.getWorkspaceHierarchy();
  const listInfo = workspaceService.findIDByNameInHierarchy(hierarchy, listName, 'list');
  if (!listInfo) return null;
  return { id: listInfo.id, name: listName };
}

/**
 * Handler for the create_list tool
 * Creates a new list directly in a space
 */
export async function handleCreateList(parameters: any) {
  const { name, spaceId, spaceName, content, dueDate, priority, assignee, status } = parameters;
  
  // Validate required fields
  if (!name) {
    throw new Error("List name is required");
  }
  
  let targetSpaceId = spaceId;
  
  // If no spaceId but spaceName is provided, look up the space ID
  if (!targetSpaceId && spaceName) {
    const spaceIdResult = await workspaceService.findSpaceIDByName(spaceName);
    if (!spaceIdResult) {
      throw new Error(`Space "${spaceName}" not found`);
    }
    targetSpaceId = spaceIdResult;
  }
  
  if (!targetSpaceId) {
    throw new Error("Either spaceId or spaceName must be provided");
  }

  // Prepare list data
  const listData: CreateListData = {
    name
  };

  // Add optional fields if provided
  if (content) listData.content = content;
  if (dueDate) listData.due_date = parseInt(dueDate);
  if (priority) listData.priority = priority;
  if (assignee) listData.assignee = assignee;
  if (status) listData.status = status;

  try {
    // Create the list
    const newList = await listService.createList(targetSpaceId, listData);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          {
            id: newList.id,
            name: newList.name,
            content: newList.content,
            space: {
              id: newList.space.id,
              name: newList.space.name
            },
            message: `List "${newList.name}" created successfully`
          },
          null,
          2
        )
      }]
    };
  } catch (error: any) {
    throw new Error(`Failed to create list: ${error.message}`);
  }
}

/**
 * Handler for the create_list_in_folder tool
 * Creates a new list inside a folder
 */
export async function handleCreateListInFolder(parameters: any) {
  const { name, folderId, folderName, spaceId, spaceName, content, status } = parameters;
  
  // Validate required fields
  if (!name) {
    throw new Error("List name is required");
  }
  
  let targetFolderId = folderId;
  
  // If no folderId but folderName is provided, look up the folder ID
  if (!targetFolderId && folderName) {
    let targetSpaceId = spaceId;
    
    // If no spaceId provided but spaceName is, look up the space ID first
    if (!targetSpaceId && spaceName) {
      const spaceIdResult = await workspaceService.findSpaceByName(spaceName);
      if (!spaceIdResult) {
        throw new Error(`Space "${spaceName}" not found`);
      }
      targetSpaceId = spaceIdResult.id;
    }
    
    if (!targetSpaceId) {
      throw new Error("Either spaceId or spaceName must be provided when using folderName");
    }
    
    // Find the folder in the workspace hierarchy
    const hierarchy = await workspaceService.getWorkspaceHierarchy();
    const folderInfo = workspaceService.findIDByNameInHierarchy(hierarchy, folderName, 'folder');
    if (!folderInfo) {
      throw new Error(`Folder "${folderName}" not found in space`);
    }
    targetFolderId = folderInfo.id;
  }
  
  if (!targetFolderId) {
    throw new Error("Either folderId or folderName must be provided");
  }

  // Prepare list data
  const listData: CreateListData = {
    name
  };

  // Add optional fields if provided
  if (content) listData.content = content;
  if (status) listData.status = status;

  try {
    // Create the list in the folder
    const newList = await listService.createListInFolder(targetFolderId, listData);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          {
            id: newList.id,
            name: newList.name,
            content: newList.content,
            space: {
              id: newList.space.id,
              name: newList.space.name
            },
            message: `List "${newList.name}" created successfully in folder`
          },
          null,
          2
        )
      }]
    };
  } catch (error: any) {
    throw new Error(`Failed to create list in folder: ${error.message}`);
  }
}

/**
 * Handler for the get_list tool
 * Retrieves details about a specific list
 */
export async function handleGetList(parameters: any) {
  const { listId, listName } = parameters;
  
  let targetListId = listId;
  
  // If no listId provided but listName is, look up the list ID
  if (!targetListId && listName) {
    const listResult = await findListIDByName(workspaceService, listName);
    if (!listResult) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listResult.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }

  try {
    // Get the list
    const list = await listService.getList(targetListId);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          {
            id: list.id,
            name: list.name,
            content: list.content,
            space: {
              id: list.space.id,
              name: list.space.name
            },
            status: list.status,
            url: `https://app.clickup.com/${config.clickupTeamId}/v/l/${list.id}`
          },
          null,
          2
        )
      }]
    };
  } catch (error: any) {
    throw new Error(`Failed to retrieve list: ${error.message}`);
  }
}

/**
 * Handler for the update_list tool
 * Updates an existing list's properties
 */
export async function handleUpdateList(parameters: any) {
  const { listId, listName, name, content, status } = parameters;
  
  let targetListId = listId;
  
  // If no listId provided but listName is, look up the list ID
  if (!targetListId && listName) {
    const listResult = await findListIDByName(workspaceService, listName);
    if (!listResult) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listResult.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }
  
  // Ensure at least one update field is provided
  if (!name && !content && !status) {
    throw new Error("At least one of name, content, or status must be provided for update");
  }

  // Prepare update data
  const updateData: Partial<CreateListData> = {};
  if (name) updateData.name = name;
  if (content) updateData.content = content;
  if (status) updateData.status = status;

  try {
    // Update the list
    const updatedList = await listService.updateList(targetListId, updateData);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          {
            id: updatedList.id,
            name: updatedList.name,
            content: updatedList.content,
            space: {
              id: updatedList.space.id,
              name: updatedList.space.name
            },
            status: updatedList.status,
            url: `https://app.clickup.com/${config.clickupTeamId}/v/l/${updatedList.id}`,
            message: `List "${updatedList.name}" updated successfully`
          },
          null,
          2
        )
      }]
    };
  } catch (error: any) {
    throw new Error(`Failed to update list: ${error.message}`);
  }
}

/**
 * Handler for the delete_list tool
 * Permanently removes a list from the workspace
 */
export async function handleDeleteList(parameters: any) {
  const { listId, listName } = parameters;
  
  let targetListId = listId;
  
  // If no listId provided but listName is, look up the list ID
  if (!targetListId && listName) {
    const listResult = await findListIDByName(workspaceService, listName);
    if (!listResult) {
      throw new Error(`List "${listName}" not found`);
    }
    targetListId = listResult.id;
  }
  
  if (!targetListId) {
    throw new Error("Either listId or listName must be provided");
  }

  try {
    // Get list details before deletion for confirmation message
    const list = await listService.getList(targetListId);
    const listName = list.name;
    
    // Delete the list
    await listService.deleteList(targetListId);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          {
            message: `List "${listName}" deleted successfully`,
            url: `https://app.clickup.com/${config.clickupTeamId}/v/l/${targetListId}`
          },
          null,
          2
        )
      }]
    };
  } catch (error: any) {
    throw new Error(`Failed to delete list: ${error.message}`);
  }
} 