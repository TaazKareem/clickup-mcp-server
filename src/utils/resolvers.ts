import { ClickUpService } from '../services/clickup.js';
import { ClickUpList, ClickUpFolder, ClickUpSpace, ClickUpTask } from '../types/clickup.js';

export async function resolveListId(
  clickup: ClickUpService,
  teamId: string,
  listId?: string,
  listName?: string
): Promise<string> {
  if (listId) return listId;
  
  if (!listName) {
    throw new Error("Either listId or listName is required");
  }

  const result = await clickup.findListByNameGlobally(teamId, listName);
  if (!result) {
    throw new Error(`List with name "${listName}" not found`);
  }
  
  return result.list.id;
}

export async function resolveSpaceId(
  clickup: ClickUpService,
  teamId: string,
  spaceId?: string,
  spaceName?: string
): Promise<string> {
  if (spaceId) return spaceId;
  
  if (!spaceName) {
    throw new Error("Either spaceId or spaceName is required");
  }

  const space = await clickup.findSpaceByName(teamId, spaceName);
  if (!space) {
    throw new Error(`Space with name "${spaceName}" not found`);
  }
  
  return space.id;
}

export async function resolveFolderId(
  clickup: ClickUpService,
  teamId: string,
  folderId?: string,
  folderName?: string
): Promise<string> {
  if (folderId) return folderId;
  
  if (!folderName) {
    throw new Error("Either folderId or folderName is required");
  }

  const result = await clickup.findFolderByNameGlobally(teamId, folderName);
  if (!result) {
    throw new Error(`Folder with name "${folderName}" not found`);
  }
  
  return result.folder.id;
}

export async function getAllTasks(
  clickup: ClickUpService,
  teamId: string
): Promise<{ tasks: ClickUpTask[], spaces: ClickUpSpace[] }> {
  const spaces = await clickup.getSpaces(teamId);
  
  const spacePromises = spaces.map(async (space) => {
    const lists = await clickup.getLists(space.id);
    const listPromises = lists.map(list => clickup.getTasks(list.id));
    const listResults = await Promise.all(listPromises);
    return listResults.flatMap(result => result.tasks);
  });

  const tasksPerSpace = await Promise.all(spacePromises);
  const allTasks = tasksPerSpace.flat();

  return { tasks: allTasks, spaces };
} 