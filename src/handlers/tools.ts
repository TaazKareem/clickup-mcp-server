import { ClickUpService } from '../services/clickup.js';
import { resolveListId, resolveSpaceId, resolveFolderId, getAllTasks } from '../utils/resolvers.js';
import { CreateTaskData, UpdateTaskData, CreateListData, CreateFolderData, BulkCreateTasksData, CreateSubtaskData } from '../types/clickup.js';

export async function handleWorkspaceHierarchy(clickup: ClickUpService, teamId: string) {
  const spaces = await clickup.getSpaces(teamId);
  const allLists = await clickup.getAllLists(teamId);
  let output = "ClickUp Workspace Hierarchy:\n\n";

  for (const space of spaces) {
    output += `Space: ${space.name} (ID: ${space.id})\n`;
    
    const folders = await clickup.getFolders(space.id);
    for (const folder of folders) {
      output += `  ├─ Folder: ${folder.name} (ID: ${folder.id})\n`;
      const folderLists = folder.lists || [];
      for (const list of folderLists) {
        const { statuses } = await clickup.getTasks(list.id);
        output += `  │  └─ List: ${list.name} (ID: ${list.id})\n`;
        output += `  │     Available Statuses: ${statuses.join(', ')}\n`;
      }
    }
    
    const spaceLists = allLists.filter(list => 
      list.space && 
      list.space.id === space.id && 
      !folders.some(folder => folder.lists?.some(fl => fl.id === list.id))
    );
    
    if (spaceLists.length > 0) {
      output += "  ├─ Lists (not in folders):\n";
      for (const list of spaceLists) {
        const { statuses } = await clickup.getTasks(list.id);
        output += `  │  └─ List: ${list.name} (ID: ${list.id})\n`;
        output += `  │     Available Statuses: ${statuses.join(', ')}\n`;
      }
    }
    output += "\n";
  }

  return output;
}

export async function handleCreateTask(
  clickup: ClickUpService,
  teamId: string,
  args: CreateTaskData & { listId?: string; listName?: string }
) {
  const listId = await resolveListId(clickup, teamId, args.listId, args.listName);
  const { listId: _, listName: __, ...taskData } = args;
  return await clickup.createTask(listId, taskData);
}

export async function handleCreateSubtask(
  clickup: ClickUpService,
  teamId: string,
  args: CreateSubtaskData & { parentTaskId?: string; listId?: string; listName?: string }
) {
  const listId = await resolveListId(clickup, teamId, args.listId, args.listName);
  const { parentTaskId: _, listId: __, listName: ___, ...taskData } = args;
  return await clickup.createSubTask(listId, { ...taskData, parentTaskId: args.parentTaskId });
}

// Add other handler functions for each tool... 