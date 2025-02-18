import axios, { AxiosInstance } from 'axios';
import { 
  ClickUpTask, 
  ClickUpList, 
  ClickUpSpace,
  ClickUpFolder,
  CreateTaskData,
  UpdateTaskData,
  CreateListData,
  CreateFolderData,
  BulkCreateTasksData,
  CreateSubtaskData
} from '../types/clickup.js';

export class ClickUpService {
  private client: AxiosInstance;
  private static instance: ClickUpService;

  private constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.clickup.com/api/v2',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  public static initialize(apiKey: string): ClickUpService {
    if (!ClickUpService.instance) {
      ClickUpService.instance = new ClickUpService(apiKey);
    }
    return ClickUpService.instance;
  }

  public static getInstance(): ClickUpService {
    if (!ClickUpService.instance) {
      throw new Error('ClickUpService not initialized. Call initialize() first.');
    }
    return ClickUpService.instance;
  }

  // Tasks
  async getTasks(listId: string): Promise<{ tasks: ClickUpTask[], statuses: string[] }> {
    const response = await this.client.get(`/list/${listId}/task`);
    const tasks = response.data.tasks;
    const statuses = [...new Set(tasks.map((task: ClickUpTask) => task.status.status))] as string[];
    return { tasks, statuses };
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    const response = await this.client.get(`/task/${taskId}`);
    return response.data;
  }

  async createTask(listId: string, data: CreateTaskData): Promise<ClickUpTask> {
    const response = await this.client.post(`/list/${listId}/task`, data);
    return response.data;
  }

  async createSubTask(listId: string, data: CreateSubtaskData): Promise<ClickUpTask> {
    const response = await this.client.post(`/list/${listId}/task`, data);
    return response.data;
  }

  async createBulkTasks(listId: string, data: BulkCreateTasksData): Promise<ClickUpTask[]> {
    const tasks = await Promise.all(
      data.tasks.map(taskData => this.createTask(listId, taskData))
    );
    return tasks;
  }

  async updateTask(taskId: string, data: UpdateTaskData): Promise<ClickUpTask> {
    const response = await this.client.put(`/task/${taskId}`, data);
    return response.data;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.client.delete(`/task/${taskId}`);
  }

  // Lists
  async getLists(spaceId: string): Promise<ClickUpList[]> {
    const response = await this.client.get(`/space/${spaceId}/list`);
    return response.data.lists;
  }

  async getAllLists(teamId: string): Promise<ClickUpList[]> {
    const response = await this.client.get(`/team/${teamId}/list`);
    return response.data.lists;
  }

  async getList(listId: string): Promise<ClickUpList> {
    const response = await this.client.get(`/list/${listId}`);
    return response.data;
  }

  // Spaces
  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const response = await this.client.get(`/team/${teamId}/space`);
    return response.data.spaces;
  }

  async getSpace(spaceId: string): Promise<ClickUpSpace> {
    const response = await this.client.get(`/space/${spaceId}`);
    return response.data;
  }

  async findSpaceByName(teamId: string, spaceName: string): Promise<ClickUpSpace | null> {
    const spaces = await this.getSpaces(teamId);
    return spaces.find(space => space.name.toLowerCase() === spaceName.toLowerCase()) || null;
  }

  async createList(spaceId: string, data: CreateListData): Promise<ClickUpList> {
    const response = await this.client.post(`/space/${spaceId}/list`, data);
    return response.data;
  }

  // Folders
  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const response = await this.client.get(`/space/${spaceId}/folder`);
    return response.data.folders;
  }

  async getFolder(folderId: string): Promise<ClickUpFolder> {
    const response = await this.client.get(`/folder/${folderId}`);
    return response.data;
  }

  async createFolder(spaceId: string, data: CreateFolderData): Promise<ClickUpFolder> {
    const response = await this.client.post(`/space/${spaceId}/folder`, data);
    return response.data;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.client.delete(`/folder/${folderId}`);
  }

  async createListInFolder(folderId: string, data: CreateListData): Promise<ClickUpList> {
    const response = await this.client.post(`/folder/${folderId}/list`, data);
    return response.data;
  }

  async findFolderByName(spaceId: string, folderName: string): Promise<ClickUpFolder | null> {
    const folders = await this.getFolders(spaceId);
    return folders.find(folder => folder.name.toLowerCase() === folderName.toLowerCase()) || null;
  }

  // Additional helper methods
  async moveTask(taskId: string, listId: string): Promise<ClickUpTask> {
    const response = await this.client.post(`/task/${taskId}`, {
      list: listId
    });
    return response.data;
  }

  async findListByNameGlobally(teamId: string, listName: string): Promise<{ list: ClickUpList, space?: ClickUpSpace, folder?: ClickUpFolder } | null> {
    const spaces = await this.getSpaces(teamId);
    
    for (const space of spaces) {
      // Check lists in folders
      const folders = await this.getFolders(space.id);
      for (const folder of folders) {
        const folderList = folder.lists?.find(list => list.name.toLowerCase() === listName.toLowerCase());
        if (folderList) {
          return { list: folderList, space, folder };
        }
      }
      
      // Check lists directly in space
      const spaceLists = await this.getLists(space.id);
      const spaceList = spaceLists.find(list => list.name.toLowerCase() === listName.toLowerCase());
      if (spaceList) {
        return { list: spaceList, space };
      }
    }

    // Check lists without spaces
    const allLists = await this.getAllLists(teamId);
    const list = allLists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    if (list) {
      return { list };
    }

    return null;
  }

  async findFolderByNameGlobally(teamId: string, folderName: string): Promise<{ folder: ClickUpFolder, space: ClickUpSpace } | null> {
    const spaces = await this.getSpaces(teamId);
    
    for (const space of spaces) {
      const folders = await this.getFolders(space.id);
      const folder = folders.find(folder => folder.name.toLowerCase() === folderName.toLowerCase());
      if (folder) {
        return { folder, space };
      }
    }

    return null;
  }

  async duplicateTask(taskId: string, listId: string): Promise<ClickUpTask> {
    const response = await this.client.post(`/task/${taskId}/duplicate`, {
      list: listId
    });
    return response.data;
  }

  async deleteList(listId: string): Promise<void> {
    await this.client.delete(`/list/${listId}`);
  }

  async updateList(listId: string, data: Partial<CreateListData>): Promise<ClickUpList> {
    const response = await this.client.put(`/list/${listId}`, data);
    return response.data;
  }
} 