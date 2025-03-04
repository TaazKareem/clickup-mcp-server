/**
 * ClickUp Workspace Service Module
 * 
 * Handles workspace hierarchy and space-related operations
 */

import { BaseClickUpService, ClickUpServiceError, ErrorCode } from './base.js';
import { 
  ClickUpSpace, 
  WorkspaceTree, 
  WorkspaceNode
} from './types.js';

/**
 * Cache configuration for workspace data
 */
interface CacheConfig {
  enabled: boolean;
  ttlMs: number; // Time to live in milliseconds
}

/**
 * Service for workspace-related operations
 */
export class WorkspaceService extends BaseClickUpService {
  
  // Cache for workspace hierarchy data to reduce API calls
  private workspaceHierarchyCache: {
    data: WorkspaceTree | null;
    timestamp: number; // When the cache was last updated
  } = {
    data: null,
    timestamp: 0
  };

  // Default cache configuration
  private cacheConfig: CacheConfig = {
    enabled: true,
    ttlMs: 5 * 60 * 1000 // 5 minutes
  };

  /**
   * Creates an instance of WorkspaceService
   * @param apiKey - ClickUp API key
   * @param teamId - ClickUp team ID
   * @param baseUrl - Optional custom API URL
   * @param cacheConfig - Optional cache configuration
   */
  constructor(
    apiKey: string, 
    teamId: string, 
    baseUrl?: string,
    cacheConfig?: Partial<CacheConfig>
  ) {
    super(apiKey, teamId, baseUrl);
    
    // Apply custom cache configuration if provided
    if (cacheConfig) {
      this.cacheConfig = {
        ...this.cacheConfig,
        ...cacheConfig
      };
    }
  }

  /**
   * Gets all spaces in the team/workspace
   * @returns Promise resolving to an array of ClickUpSpace objects
   * @throws ClickUpServiceError if the API request fails
   */
  async getSpaces(): Promise<ClickUpSpace[]> {
    return this.makeRequest(async () => {
      const response = await this.client.get(`/team/${this.teamId}/space`);
      this.logOperation('getSpaces', { teamId: this.teamId });
      return response.data.spaces;
    });
  }

  /**
   * Gets a specific space by ID
   * @param spaceId - ID of the space to retrieve
   * @returns Promise resolving to a ClickUpSpace object
   * @throws ClickUpServiceError if the API request fails or space is not found
   */
  async getSpace(spaceId: string): Promise<ClickUpSpace> {
    return this.makeRequest(async () => {
      try {
        const response = await this.client.get(`/space/${spaceId}`);
        this.logOperation('getSpace', { spaceId });
        return response.data;
      } catch (error) {
        if (error instanceof ClickUpServiceError && error.code === ErrorCode.NOT_FOUND) {
          throw new ClickUpServiceError(
            `Space with ID ${spaceId} not found`, 
            ErrorCode.NOT_FOUND
          );
        }
        throw error;
      }
    });
  }

  /**
   * Finds a space by name (case-insensitive)
   * @param spaceName - Name of the space to find
   * @returns Promise resolving to the space or null if not found
   */
  async findSpaceByName(spaceName: string): Promise<ClickUpSpace | null> {
    const spaces = await this.getSpaces();
    return spaces.find(
      space => space.name.toLowerCase() === spaceName.toLowerCase()
    ) || null;
  }

  /**
   * Gets the complete workspace hierarchy as a tree structure.
   * Uses caching to reduce API calls if enabled.
   * 
   * The tree consists of:
   * - Root (Workspace)
   *   - Spaces
   *     - Lists (directly in space)
   *     - Folders
   *       - Lists (in folders)
   * 
   * @param forceRefresh - Whether to force a refresh of the cache
   * @returns Promise resolving to the complete workspace tree
   * @throws ClickUpServiceError if API requests fail
   */
  async getWorkspaceHierarchy(forceRefresh = false): Promise<WorkspaceTree> {
    // Check if we can use cached data
    const now = Date.now();
    const cacheAge = now - this.workspaceHierarchyCache.timestamp;
    const cacheValid = 
      this.cacheConfig.enabled && 
      !forceRefresh && 
      this.workspaceHierarchyCache.data && 
      cacheAge < this.cacheConfig.ttlMs;
    
    if (cacheValid) {
      return this.workspaceHierarchyCache.data!;
    }

    try {
      this.logOperation('getWorkspaceHierarchy', { forceRefresh });
      
      // Create basic workspace structure
      const root: WorkspaceTree['root'] = {
        id: this.teamId,
        name: 'Workspace',
        type: 'workspace',
        children: []
      };
      
      // Simple sequential implementation
      // 1. Get all spaces
      const spaces = await this.getSpaces();
      
      // 2. Process each space one by one
      for (const space of spaces) {
        const spaceNode: WorkspaceNode = {
          id: space.id,
          name: space.name,
          type: 'space',
          children: [],
          data: space
        };
        root.children.push(spaceNode);
        
        // 3. Get lists directly in the space
        try {
          const spaceLists = await this.getLists(space.id);
          for (const list of spaceLists) {
            spaceNode.children.push({
              id: list.id,
              name: list.name,
              type: 'list',
              parent: spaceNode,
              children: [],
              data: list
            });
          }
        } catch (error) {
          console.warn(`Error fetching lists for space ${space.id}:`, error);
        }
        
        // 4. Get folders in the space
        try {
          const folders = await this.getFolders(space.id);
          for (const folder of folders) {
            const folderNode: WorkspaceNode = {
              id: folder.id,
              name: folder.name,
              type: 'folder',
              parent: spaceNode,
              children: [],
              data: folder
            };
            spaceNode.children.push(folderNode);
            
            // 5. Process lists in the folder
            const folderLists = folder.lists || [];
            for (const list of folderLists) {
              folderNode.children.push({
                id: list.id,
                name: list.name,
                type: 'list',
                parent: folderNode,
                children: [],
                data: list
              });
            }
          }
        } catch (error) {
          console.warn(`Error fetching folders for space ${space.id}:`, error);
        }
      }
      
      const workspaceTree = { root };
      
      // Update cache
      if (this.cacheConfig.enabled) {
        this.workspaceHierarchyCache = {
          data: workspaceTree,
          timestamp: Date.now()
        };
      }
      
      return workspaceTree;
    } catch (error: any) {
      // Convert to ClickUpServiceError if needed
      if (error instanceof ClickUpServiceError) {
        throw error;
      }
      throw new ClickUpServiceError(
        `Failed to retrieve workspace hierarchy: ${error.message}`,
        ErrorCode.UNKNOWN,
        error
      );
    }
  }

  /**
   * Invalidates the workspace hierarchy cache
   * Forces the next call to getWorkspaceHierarchy to fetch fresh data
   */
  invalidateWorkspaceCache(): void {
    this.workspaceHierarchyCache = {
      data: null,
      timestamp: 0
    };
  }

  /**
   * Helper method to find a node in the workspace tree by name and type.
   * Performs a case-insensitive search through the tree structure.
   * 
   * @param node - The root node to start searching from
   * @param name - The name to search for (case-insensitive)
   * @param type - The type of node to find ('space', 'folder', or 'list')
   * @returns Object containing:
   *          - node: The found WorkspaceNode
   *          - path: Full path to the node (e.g., "Space > Folder > List")
   *          Or null if no matching node is found
   */
  private findNodeInTree(
    node: WorkspaceNode | WorkspaceTree['root'],
    name: string,
    type: 'space' | 'folder' | 'list'
  ): { node: WorkspaceNode; path: string } | null {
    // Check current node if it's a WorkspaceNode
    if ('type' in node && node.type === type && node.name.toLowerCase() === name.toLowerCase()) {
      return {
        node,
        path: node.name
      };
    }

    // Search children
    for (const child of node.children) {
      const result = this.findNodeInTree(child, name, type);
      if (result) {
        const path = node.type === 'workspace' ? result.path : `${node.name} > ${result.path}`;
        return { node: result.node, path };
      }
    }

    return null;
  }

  /**
   * Finds a node by name and type in the workspace hierarchy.
   * This is a high-level method that uses findNodeInTree internally.
   * 
   * @param hierarchy - The workspace tree to search in
   * @param name - Name of the space/folder/list to find (case-insensitive)
   * @param type - Type of node to find ('space', 'folder', or 'list')
   * @returns Object containing:
   *          - id: The ID of the found node
   *          - path: Full path to the node
   *          Or null if no matching node is found
   */
  findIDByNameInHierarchy(
    hierarchy: WorkspaceTree,
    name: string,
    type: 'space' | 'folder' | 'list'
  ): { id: string; path: string } | null {
    const result = this.findNodeInTree(hierarchy.root, name, type);
    if (!result) return null;
    return { id: result.node.id, path: result.path };
  }

  /**
   * Helper method to find a space ID by name.
   * Uses the tree structure for efficient lookup.
   * 
   * @param spaceName - Name of the space to find (case-insensitive)
   * @returns Promise resolving to the space ID or null if not found
   */
  async findSpaceIDByName(spaceName: string): Promise<string | null> {
    const hierarchy = await this.getWorkspaceHierarchy();
    const result = this.findIDByNameInHierarchy(hierarchy, spaceName, 'space');
    return result?.id || null;
  }

  /**
   * Placeholder for getLists - will be implemented by ListService.
   * This is included here to maintain the functionality needed by getWorkspaceHierarchy.
   * @param spaceId - ID of the space to get lists from
   * @returns Promise resolving to an array of ClickUpList objects
   */
  private async getLists(spaceId: string): Promise<any[]> {
    // This is a temporary implementation
    // Will be replaced by proper service calls in the final integration
    return this.makeRequest(async () => {
      const response = await this.client.get(`/space/${spaceId}/list`);
      return response.data.lists;
    });
  }

  /**
   * Placeholder for getFolders - will be implemented by FolderService.
   * This is included here to maintain the functionality needed by getWorkspaceHierarchy.
   * @param spaceId - ID of the space to get folders from
   * @returns Promise resolving to an array of ClickUpFolder objects
   */
  private async getFolders(spaceId: string): Promise<any[]> {
    // This is a temporary implementation
    // Will be replaced by proper service calls in the final integration
    return this.makeRequest(async () => {
      const response = await this.client.get(`/space/${spaceId}/folder`);
      return response.data.folders;
    });
  }
} 