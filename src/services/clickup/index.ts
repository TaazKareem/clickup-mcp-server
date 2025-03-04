/**
 * ClickUp Service Entry Point
 * 
 * This file re-exports all service modules for the ClickUp API integration.
 * It also provides a convenient factory method to create instances of all services.
 */

// Export base service components
export { 
  BaseClickUpService, 
  ClickUpServiceError, 
  ErrorCode,
  ServiceResponse 
} from './base.js';

// Export type definitions
export * from './types.js';

// Export service modules
export { WorkspaceService } from './workspace.js';
export { TaskService } from './task.js';
export { ListService } from './list.js';
export { FolderService } from './folder.js';

// Import service classes for the factory function
import { WorkspaceService } from './workspace.js';
import { TaskService } from './task.js';
import { ListService } from './list.js';
import { FolderService } from './folder.js';

/**
 * Configuration options for ClickUp services
 */
export interface ClickUpServiceConfig {
  apiKey: string;
  teamId: string;
  baseUrl?: string;
  caching?: {
    enabled: boolean;
    ttlMs?: number;
  };
}

/**
 * Collection of all ClickUp service instances
 */
export interface ClickUpServices {
  workspace: WorkspaceService;
  task: TaskService;
  list: ListService;
  folder: FolderService;
}

/**
 * Factory function to create instances of all ClickUp services
 * @param config Configuration for the services
 * @returns Object containing all service instances
 */
export function createClickUpServices(config: ClickUpServiceConfig): ClickUpServices {
  const { apiKey, teamId, baseUrl, caching } = config;

  return {
    workspace: new WorkspaceService(apiKey, teamId, baseUrl, { 
      enabled: caching?.enabled ?? true,
      ttlMs: caching?.ttlMs ?? 5 * 60 * 1000 // 5 minutes default
    }),
    task: new TaskService(apiKey, teamId, baseUrl),
    list: new ListService(apiKey, teamId, baseUrl),
    folder: new FolderService(apiKey, teamId, baseUrl)
  };
} 