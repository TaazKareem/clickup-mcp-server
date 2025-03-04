/**
 * ClickUp Folder Service
 * 
 * Handles all operations related to folders in ClickUp, including:
 * - Creating folders
 * - Retrieving folders
 * - Updating folders
 * - Deleting folders
 * - Finding folders by name
 */

import { AxiosError } from 'axios';
import { BaseClickUpService, ErrorCode, ClickUpServiceError, ServiceResponse } from './base.js';
import { 
  ClickUpFolder,
  CreateFolderData
} from './types.js';

export class FolderService extends BaseClickUpService {
  /**
   * Create a new folder in a space
   * @param spaceId The ID of the space to create the folder in
   * @param folderData The data for the new folder
   * @returns The created folder
   */
  async createFolder(spaceId: string, folderData: CreateFolderData): Promise<ClickUpFolder> {
    this.logOperation('createFolder', { spaceId, ...folderData });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.post<ClickUpFolder>(
          `/space/${spaceId}/folder`,
          folderData
        );
        return response.data;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      throw new ClickUpServiceError(
        `Failed to create folder: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        {
          spaceId,
          name: folderData.name,
          details: axiosError.response?.data
        }
      );
    }
  }

  /**
   * Get a folder by its ID
   * @param folderId The ID of the folder to retrieve
   * @returns The folder details
   */
  async getFolder(folderId: string): Promise<ClickUpFolder> {
    this.logOperation('getFolder', { folderId });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.get<ClickUpFolder>(`/folder/${folderId}`);
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
          `Folder not found with ID: ${folderId}`,
          ErrorCode.NOT_FOUND,
          axiosError.response.data,
          404
        );
      }
      
      throw new ClickUpServiceError(
        `Failed to get folder: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Update an existing folder
   * @param folderId The ID of the folder to update
   * @param updateData The data to update on the folder
   * @returns The updated folder
   */
  async updateFolder(folderId: string, updateData: Partial<CreateFolderData>): Promise<ClickUpFolder> {
    this.logOperation('updateFolder', { folderId, ...updateData });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.put<ClickUpFolder>(
          `/folder/${folderId}`,
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
          `Folder not found with ID: ${folderId}`,
          ErrorCode.NOT_FOUND,
          axiosError.response.data,
          404
        );
      }
      
      throw new ClickUpServiceError(
        `Failed to update folder: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Delete a folder
   * @param folderId The ID of the folder to delete
   * @returns Success indicator
   */
  async deleteFolder(folderId: string): Promise<ServiceResponse<void>> {
    this.logOperation('deleteFolder', { folderId });
    
    try {
      await this.makeRequest(async () => {
        await this.client.delete(`/folder/${folderId}`);
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
          message: `Failed to delete folder: ${axiosError.message}`,
          code: ErrorCode.UNKNOWN,
          details: axiosError.response?.data
        }
      };
    }
  }

  /**
   * Get all folders in a space
   * @param spaceId The ID of the space to get folders from
   * @returns Array of folders in the space
   */
  async getFoldersInSpace(spaceId: string): Promise<ClickUpFolder[]> {
    this.logOperation('getFoldersInSpace', { spaceId });
    
    try {
      return await this.makeRequest(async () => {
        const response = await this.client.get<{ folders: ClickUpFolder[] }>(
          `/space/${spaceId}/folder`
        );
        return response.data.folders;
      });
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      const axiosError = error as AxiosError;
      throw new ClickUpServiceError(
        `Failed to get folders in space: ${axiosError.message}`,
        ErrorCode.UNKNOWN,
        axiosError.response?.data,
        axiosError.response?.status
      );
    }
  }

  /**
   * Find a folder by its name in a space
   * @param spaceId The ID of the space to search in
   * @param folderName The name of the folder to find
   * @returns The folder if found, otherwise null
   */
  async findFolderByName(spaceId: string, folderName: string): Promise<ClickUpFolder | null> {
    this.logOperation('findFolderByName', { spaceId, folderName });
    
    try {
      const folders = await this.getFoldersInSpace(spaceId);
      const matchingFolder = folders.find(folder => 
        folder.name.toLowerCase() === folderName.toLowerCase()
      );
      
      return matchingFolder || null;
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      
      throw new ClickUpServiceError(
        `Failed to find folder by name: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.UNKNOWN
      );
    }
  }
} 