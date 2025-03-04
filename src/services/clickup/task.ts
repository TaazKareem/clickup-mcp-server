/**
 * ClickUp Task Service
 * 
 * Handles all operations related to tasks in ClickUp, including:
 * - Creating tasks (single and bulk)
 * - Retrieving tasks (single or multiple)
 * - Updating tasks
 * - Deleting tasks
 * - Finding tasks by name
 */

import { AxiosError } from 'axios';
import { BaseClickUpService, ErrorCode, ClickUpServiceError, ServiceResponse } from './base.js';
import { 
  ClickUpTask, 
  CreateTaskData, 
  UpdateTaskData, 
  TaskFilters, 
  TasksResponse,
  BulkCreateTasksData
} from './types.js';
import { BulkProcessor, BulkOperationOptions, BulkOperationResult, ProgressInfo } from './bulk.js';
import { ListService } from './list.js';

export class TaskService extends BaseClickUpService {
  // Bulk processor for handling batch operations
  private bulkProcessor: BulkProcessor;
  private listService: ListService;
  
  constructor(apiKey: string, teamId: string, baseUrl?: string) {
    super(apiKey, teamId, baseUrl);
    this.bulkProcessor = new BulkProcessor();
    this.listService = new ListService(apiKey, teamId);
  }

  /**
   * Create a new task in the specified list
   * @param listId The ID of the list to create the task in
   * @param taskData The data for the new task
   * @returns The created task
   */
  async createTask(listId: string, taskData: CreateTaskData): Promise<ClickUpTask> {
    this.logOperation('createTask', { listId, ...taskData });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.post<ClickUpTask>(
          `/list/${listId}/task`,
          taskData
        );
        return response.data;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      throw new ClickUpServiceError(
        `Failed to create task: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Get all tasks in a list with optional filtering
   * @param listId The ID of the list to get tasks from
   * @param filters Optional filters to apply
   * @returns List of tasks matching the filters
   */
  async getTasks(listId: string, filters: TaskFilters = {}): Promise<ClickUpTask[]> {
    this.logOperation('getTasks', { listId, filters });
    
    try {
      return await this.makeRequest(async () => {
        const params = new URLSearchParams();
        
        // Add all filters to the query parameters
        if (filters.include_closed) params.append('include_closed', String(filters.include_closed));
        if (filters.subtasks) params.append('subtasks', String(filters.subtasks));
        if (filters.page) params.append('page', String(filters.page));
        if (filters.order_by) params.append('order_by', filters.order_by);
        if (filters.reverse) params.append('reverse', String(filters.reverse));
        if (filters.statuses && filters.statuses.length > 0) {
          filters.statuses.forEach(status => params.append('statuses[]', status));
        }
        if (filters.assignees && filters.assignees.length > 0) {
          filters.assignees.forEach(assignee => params.append('assignees[]', assignee));
        }
        if (filters.due_date_gt) params.append('due_date_gt', String(filters.due_date_gt));
        if (filters.due_date_lt) params.append('due_date_lt', String(filters.due_date_lt));
        if (filters.date_created_gt) params.append('date_created_gt', String(filters.date_created_gt));
        if (filters.date_created_lt) params.append('date_created_lt', String(filters.date_created_lt));
        if (filters.date_updated_gt) params.append('date_updated_gt', String(filters.date_updated_gt));
        if (filters.date_updated_lt) params.append('date_updated_lt', String(filters.date_updated_lt));
        
        // Handle custom fields if present
        if (filters.custom_fields) {
          Object.entries(filters.custom_fields).forEach(([key, value]) => {
            params.append(`custom_fields[${key}]`, String(value));
          });
        }
        
        const response = await this.client.get<TasksResponse>(
          `/list/${listId}/task?${params.toString()}`
        );
        
        return response.data.tasks;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      throw new ClickUpServiceError(
        `Failed to get tasks: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Get a specific task by ID
   * @param taskId The ID of the task to retrieve
   * @returns The task details
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    this.logOperation('getTask', { taskId });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.get<ClickUpTask>(`/task/${taskId}`);
        return response.data;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      
      // Handle 404 specifically for better error messaging
      if (axiosError.response?.status === 404) {
        throw new ClickUpServiceError(
          `Task not found with ID: ${taskId}`,
          ErrorCode.NOT_FOUND,
          axiosError.response.data,
          404
        );
      }
      
      throw new ClickUpServiceError(
        `Failed to get task: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Update an existing task
   * @param taskId The ID of the task to update
   * @param updateData The data to update on the task
   * @returns The updated task
   */
  async updateTask(taskId: string, updateData: UpdateTaskData): Promise<ClickUpTask> {
    this.logOperation('updateTask', { taskId, ...updateData });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.put<ClickUpTask>(
          `/task/${taskId}`,
          updateData
        );
        return response.data;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      
      // Handle 404 specifically for better error messaging
      if (axiosError.response?.status === 404) {
        throw new ClickUpServiceError(
          `Task not found with ID: ${taskId}`,
          ErrorCode.NOT_FOUND,
          axiosError.response.data,
          404
        );
      }
      
      throw new ClickUpServiceError(
        `Failed to update task: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Delete a task
   * @param taskId The ID of the task to delete
   * @returns Success indicator
   */
  async deleteTask(taskId: string): Promise<ServiceResponse<void>> {
    this.logOperation('deleteTask', { taskId });
    
    try {
      await this.makeRequest(async () => {
        await this.client.delete(`/task/${taskId}`);
      });
      
      return {
        success: true
      };
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.data
          }
        };
      }
      
      const axiosError = error as AxiosError;
      
      return {
        success: false,
        error: {
          message: `Failed to delete task: ${axiosError.message}`,
          code: ErrorCode.UNKNOWN,
          details: axiosError.response?.data
        }
      };
    }
  }

  /**
   * Find a task by its name in a specific list
   * @param listId The list ID to search within
   * @param taskName The name of the task to find
   * @returns The task if found, otherwise null
   */
  async findTaskByName(listId: string, taskName: string): Promise<ClickUpTask | null> {
    this.logOperation('findTaskByName', { listId, taskName });
    
    try {
      const tasks = await this.getTasks(listId);
      const matchingTask = tasks.find(task => 
        task.name.toLowerCase() === taskName.toLowerCase()
      );
      
      return matchingTask || null;
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      throw new ClickUpServiceError(
        `Failed to find task by name: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.UNKNOWN
      );
    }
  }

  /**
   * Move a task to a different list
   * @param taskId The ID of the task to move
   * @param destinationListId The ID of the list to move the task to
   * @returns The updated task
   */
  async moveTask(taskId: string, destinationListId: string): Promise<ClickUpTask> {
    this.logOperation('moveTask', { taskId, destinationListId });
    
    try {
      // First, get both the task and list info in parallel to save time
      const [originalTask, destinationList] = await Promise.all([
        this.getTask(taskId),
        this.listService.getList(destinationListId)
      ]);

      const currentStatus = originalTask.status?.status;
      const availableStatuses = destinationList.statuses?.map(s => s.status) || [];

      // Determine the appropriate status for the destination list
      let newStatus = availableStatuses.includes(currentStatus || '')
        ? currentStatus // Keep the same status if available in destination list
        : destinationList.statuses?.[0]?.status; // Otherwise use the default (first) status

      // Prepare the task data for the new list
      const taskData: CreateTaskData = {
        name: originalTask.name,
        description: originalTask.description,
        status: newStatus,
        priority: originalTask.priority?.priority as any,
        due_date: originalTask.due_date ? Number(originalTask.due_date) : undefined,
        assignees: originalTask.assignees?.map(a => a.id) || [],
        // Add any other relevant fields from the original task
      };

      // Create new task and delete old one in a single makeRequest call
      return await this.makeRequest(async () => {
        // First create the new task
        const response = await this.client.post<ClickUpTask>(
          `/list/${destinationListId}/task`,
          taskData
        );

        // Then delete the original task
        await this.client.delete(`/task/${taskId}`);

        // Add a property to indicate the task was moved
        const newTask = {
          ...response.data,
          moved: true,
          originalId: taskId
        };

        return newTask;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      throw new ClickUpServiceError(
        `Failed to move task: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Create a duplicate of an existing task
   * @param taskId The ID of the task to duplicate
   * @param listId Optional destination list ID (defaults to the same list)
   * @returns The newly created duplicate task
   */
  async duplicateTask(taskId: string, listId?: string): Promise<ClickUpTask> {
    this.logOperation('duplicateTask', { taskId, listId });
    
    try {
      // First, get the original task
      const originalTask = await this.getTask(taskId);
      
      // Prepare data for the new task
      const newTaskData: CreateTaskData = {
        name: `${originalTask.name} (Copy)`,
        description: originalTask.description,
        status: originalTask.status?.status,
        priority: originalTask.priority?.priority as any,
        due_date: originalTask.due_date ? new Date(originalTask.due_date).getTime() : undefined,
        assignees: originalTask.assignees?.map(a => a.id) || []
      };
      
      // Create the new task in the specified list or original list
      const targetListId = listId || originalTask.list.id;
      return await this.createTask(targetListId, newTaskData);
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      throw new ClickUpServiceError(
        `Failed to duplicate task: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.UNKNOWN
      );
    }
  }

  /**
   * Create multiple tasks in a list with advanced batching options
   * 
   * @param listId The ID of the list to create tasks in
   * @param data Object containing array of tasks to create
   * @param options Configuration options for the bulk operation
   * @param progressCallback Optional callback for tracking progress
   * @returns Result containing both successful and failed operations
   */
  async createBulkTasks(
    listId: string,
    data: { tasks: Array<CreateTaskData> }, 
    options?: BulkOperationOptions,
    progressCallback?: (progress: ProgressInfo) => void
  ): Promise<BulkOperationResult<ClickUpTask>> {
    this.logOperation('createBulkTasks', { 
      listId, 
      taskCount: data.tasks.length,
      batchSize: options?.batchSize,
      concurrency: options?.concurrency
    });
    
    try {
      // Validate list exists before proceeding
      const list = await this.listService.getList(listId).catch(() => null);
      if (!list) {
        throw new ClickUpServiceError(
          `List not found with ID: ${listId}`,
          ErrorCode.NOT_FOUND
        );
      }

      // Set default options for better performance
      const bulkOptions: BulkOperationOptions = {
        batchSize: options?.batchSize ?? 5, // Smaller batch size for better rate limit handling
        concurrency: options?.concurrency ?? 2, // Lower concurrency to avoid rate limits
        continueOnError: options?.continueOnError ?? true, // Continue on individual task failures
        retryCount: options?.retryCount ?? 3, // Retry failed operations
        ...options
      };

      // Add list validation to progress tracking
      const wrappedCallback = progressCallback ? 
        (progress: ProgressInfo) => {
          progress.context = { listId, listName: list.name };
          progressCallback(progress);
        } : undefined;

      return await this.bulkProcessor.processBulk(
        data.tasks,
        async (taskData) => {
          try {
            // Ensure task data is properly formatted
            const sanitizedData = {
              ...taskData,
              // Remove any accidentally included list IDs in task data
              list: undefined,
              // Ensure name has emoji if missing
              name: taskData.name.match(/^\p{Emoji}/u) ? 
                taskData.name : 
                '📋 ' + taskData.name
            };

            return await this.createTask(listId, sanitizedData);
          } catch (error) {
            // Enhance error context for better debugging
            if (error instanceof ClickUpServiceError) {
              error.context = {
                ...error.context,
                taskName: taskData.name,
                listId,
                listName: list.name
              };
            }
            throw error;
          }
        },
        bulkOptions
      );
    } catch (error: any) {
      const errorMessage = error instanceof ClickUpServiceError ?
        error.message :
        `Failed to create tasks in bulk: ${error.message}`;

      throw new ClickUpServiceError(
        errorMessage,
        error instanceof ClickUpServiceError ? error.code : ErrorCode.UNKNOWN,
        {
          listId,
          taskCount: data.tasks.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
  
  /**
   * Update multiple tasks in bulk with advanced batching options
   * 
   * @param tasks Array of task IDs and update data
   * @param options Configuration options for the bulk operation
   * @param progressCallback Optional callback for tracking progress
   * @returns Result containing both successful and failed operations
   */
  async updateBulkTasks(
    tasks: Array<{ id: string, data: UpdateTaskData }>,
    options?: BulkOperationOptions,
    progressCallback?: (progress: ProgressInfo) => void
  ): Promise<BulkOperationResult<ClickUpTask>> {
    this.logOperation('updateBulkTasks', { 
      taskCount: tasks.length,
      batchSize: options?.batchSize,
      concurrency: options?.concurrency
    });
    
    try {
      return await this.bulkProcessor.processBulk(
        tasks,
        ({ id, data }) => this.updateTask(id, data),
        options
      );
    } catch (error: any) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      throw new ClickUpServiceError(
        `Failed to update tasks in bulk: ${error.message}`,
        ErrorCode.UNKNOWN,
        error
      );
    }
  }
  
  /**
   * Move multiple tasks to a different list in bulk
   * 
   * @param tasks Array of task IDs to move
   * @param targetListId ID of the list to move tasks to
   * @param options Configuration options for the bulk operation
   * @param progressCallback Optional callback for tracking progress
   * @returns Result containing both successful and failed operations
   */
  async moveBulkTasks(
    tasks: string[],
    targetListId: string,
    options?: BulkOperationOptions,
    progressCallback?: (progress: ProgressInfo) => void
  ): Promise<BulkOperationResult<ClickUpTask>> {
    this.logOperation('moveBulkTasks', { 
      taskCount: tasks.length,
      targetListId,
      batchSize: options?.batchSize,
      concurrency: options?.concurrency
    });
    
    try {
      // First verify destination list exists
      const destinationList = await this.listService.getList(targetListId);
      if (!destinationList) {
        throw new ClickUpServiceError(
          `Destination list not found with ID: ${targetListId}`,
          ErrorCode.NOT_FOUND
        );
      }

      // Set default options for better performance
      const bulkOptions: BulkOperationOptions = {
        batchSize: options?.batchSize ?? 5, // Smaller batch size for better rate limit handling
        concurrency: options?.concurrency ?? 2, // Lower concurrency to avoid rate limits
        continueOnError: options?.continueOnError ?? true, // Continue on individual task failures
        retryCount: options?.retryCount ?? 3, // Retry failed operations
        ...options
      };

      return await this.bulkProcessor.processBulk(
        tasks,
        async (taskId) => {
          try {
            // Get the original task
            const originalTask = await this.getTask(taskId);
            const currentStatus = originalTask.status?.status;
            const availableStatuses = destinationList.statuses?.map(s => s.status) || [];

            // Determine the appropriate status for the destination list
            let newStatus = availableStatuses.includes(currentStatus || '')
              ? currentStatus // Keep the same status if available in destination list
              : destinationList.statuses?.[0]?.status; // Otherwise use the default (first) status

            // Prepare the task data for the new list
            const taskData: CreateTaskData = {
              name: originalTask.name,
              description: originalTask.description,
              status: newStatus,
              priority: originalTask.priority?.priority as any,
              due_date: originalTask.due_date ? Number(originalTask.due_date) : undefined,
              assignees: originalTask.assignees?.map(a => a.id) || []
            };

            // Create new task and delete old one in a single makeRequest call
            return await this.makeRequest(async () => {
              // First create the new task
              const response = await this.client.post<ClickUpTask>(
                `/list/${targetListId}/task`,
                taskData
              );

              // Then delete the original task
              await this.client.delete(`/task/${taskId}`);

              // Add a property to indicate the task was moved
              const newTask = {
                ...response.data,
                moved: true,
                originalId: taskId
              };

              return newTask;
            });
          } catch (error) {
            // Enhance error context for better debugging
            if (error instanceof ClickUpServiceError) {
              error.context = {
                ...error.context,
                taskId,
                targetListId,
                targetListName: destinationList.name
              };
            }
            throw error;
          }
        },
        bulkOptions
      );
    } catch (error: any) {
      const errorMessage = error instanceof ClickUpServiceError ?
        error.message :
        `Failed to move tasks in bulk: ${error.message}`;

      throw new ClickUpServiceError(
        errorMessage,
        error instanceof ClickUpServiceError ? error.code : ErrorCode.UNKNOWN,
        {
          targetListId,
          taskCount: tasks.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Delete multiple tasks in bulk with advanced batching options
   * 
   * @param taskIds Array of task IDs to delete
   * @param options Configuration options for the bulk operation
   * @returns Result containing both successful and failed operations
   */
  async deleteBulkTasks(
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult<string>> {
    this.logOperation('deleteBulkTasks', { 
      taskCount: taskIds.length,
      batchSize: options?.batchSize,
      concurrency: options?.concurrency
    });
    
    try {
      return await this.bulkProcessor.processBulk(
        taskIds,
        async (taskId) => {
          await this.deleteTask(taskId);
          return taskId;
        },
        options
      );
    } catch (error: any) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      throw new ClickUpServiceError(
        `Failed to delete tasks in bulk: ${error.message}`,
        ErrorCode.UNKNOWN,
        error
      );
    }
  }
} 