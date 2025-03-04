/**
 * ClickUp Bulk Operations Service
 * 
 * Provides infrastructure for processing bulk operations with:
 * - Batching capabilities
 * - Rate limit handling
 * - Proper error collection
 * - Progress tracking
 * - Configurable concurrency
 */

import { ClickUpServiceError, ErrorCode } from './base.js';
import { AxiosError } from 'axios';

/**
 * Configuration options for bulk operations
 */
export interface BulkOperationOptions {
  /**
   * Number of items to process in a single batch
   * @default 10
   */
  batchSize?: number;
  
  /**
   * Number of concurrent operations to run within a batch
   * @default 3
   */
  concurrency?: number;
  
  /**
   * Whether to continue processing if an operation fails
   * @default false
   */
  continueOnError?: boolean;
  
  /**
   * Number of times to retry failed operations
   * @default 3
   */
  retryCount?: number;
  
  /**
   * Delay between retries in milliseconds
   * @default 1000
   */
  retryDelay?: number;
  
  /**
   * Whether to use exponential backoff for retries
   * @default true
   */
  exponentialBackoff?: boolean;
  
  /**
   * Progress callback function
   */
  onProgress?: (completed: number, total: number, success: number, failed: number) => void;
}

/**
 * Progress information for tracking long-running operations
 */
export interface ProgressInfo {
  totalItems: number;
  completedItems: number;
  failedItems: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  context?: Record<string, any>;
}

/**
 * Result of a bulk operation
 */
export interface BulkOperationResult<T> {
  /**
   * Operation status
   */
  success: boolean;
  
  /**
   * Successfully processed items
   */
  successfulItems: T[];
  
  /**
   * Failed items with their errors
   */
  failedItems: Array<{
    item: any;
    index: number;
    error: Error;
  }>;
  
  /**
   * Total number of items processed
   */
  totalItems: number;
  
  /**
   * Number of successful operations
   */
  successCount: number;
  
  /**
   * Number of failed operations
   */
  failureCount: number;
}

/**
 * Service for processing bulk operations efficiently
 */
export class BulkProcessor {
  /**
   * Process items in batches with configurable options
   */
  public async processBulk<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult<R>> {
    const opts: Required<BulkOperationOptions> = {
      batchSize: options?.batchSize ?? 10,
      concurrency: options?.concurrency ?? 3,
      continueOnError: options?.continueOnError ?? false,
      retryCount: options?.retryCount ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
      exponentialBackoff: options?.exponentialBackoff ?? true,
      onProgress: options?.onProgress ?? (() => {})
    };

    const result: BulkOperationResult<R> = {
      success: true,
      successfulItems: [],
      failedItems: [],
      totalItems: items.length,
      successCount: 0,
      failureCount: 0
    };

    if (items.length === 0) {
      return result;
    }

    try {
      const totalBatches = Math.ceil(items.length / opts.batchSize);
      let processedItems = 0;
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * opts.batchSize;
        const endIdx = Math.min(startIdx + opts.batchSize, items.length);
        const batch = items.slice(startIdx, endIdx);
        
        // Process the current batch
        const batchResults = await this.processBatch(
          batch,
          processor,
          startIdx,
          opts
        );
        
        // Update results
        result.successfulItems.push(...batchResults.successfulItems);
        result.failedItems.push(...batchResults.failedItems);
        result.successCount += batchResults.successCount;
        result.failureCount += batchResults.failureCount;
        
        // If any failed and we're not continuing on error, exit
        if (batchResults.failureCount > 0 && !opts.continueOnError) {
          result.success = false;
          return result;
        }
        
        // Update progress
        processedItems += batch.length;
        opts.onProgress(
          processedItems,
          items.length,
          result.successCount,
          result.failureCount
        );
      }
      
      // Set overall success flag
      result.success = result.failedItems.length === 0;
      
      return result;
    } catch (error) {
      const err = error as Error;
      console.error(
        'Failed to process bulk operation:',
        err.message || String(error)
      );
      
      result.success = false;
      return result;
    }
  }
  
  /**
   * Process a single batch of items
   */
  private async processBatch<T, R>(
    batch: T[],
    processor: (item: T, index: number) => Promise<R>,
    startIndex: number,
    opts: Required<BulkOperationOptions>
  ): Promise<BulkOperationResult<R>> {
    const result: BulkOperationResult<R> = {
      success: true,
      successfulItems: [],
      failedItems: [],
      totalItems: batch.length,
      successCount: 0,
      failureCount: 0
    };
    
    try {
      // Process batches with concurrency control
      for (let i = 0; i < batch.length; i += opts.concurrency) {
        const concurrentBatch = batch.slice(i, Math.min(i + opts.concurrency, batch.length));
        
        // Process items concurrently
        const promises = concurrentBatch.map((item, idx) => {
          const index = startIndex + i + idx;
          
          return this.processWithRetry(
            () => processor(item, index),
            index,
            item,
            opts
          );
        });
        
        // Wait for all concurrent operations to complete
        const results = await Promise.allSettled(promises);
        
        // Handle results
        results.forEach((promiseResult, idx) => {
          const index = startIndex + i + idx;
          const item = batch[i + idx];
          
          if (promiseResult.status === 'fulfilled') {
            result.successfulItems.push(promiseResult.value);
            result.successCount++;
          } else if (promiseResult.status === 'rejected') {
            const error = promiseResult.reason as Error;
            result.failedItems.push({
              item,
              index,
              error
            });
            result.failureCount++;
            
            // If not continuing on error, throw
            if (!opts.continueOnError) {
              result.success = false;
              throw new Error(
                `Bulk operation failed at index ${index}: ${error.message || String(error)}`
              );
            }
          }
        });
      }
      
      return result;
    } catch (error) {
      const err = error as Error;
      console.error(
        `Bulk operation failed: ${err.message || String(error)}`,
        error
      );
      
      result.success = false;
      return result;
    }
  }
  
  /**
   * Process a single item with retry logic
   */
  private async processWithRetry<R>(
    operation: () => Promise<R>,
    index: number,
    item: any,
    options: Required<BulkOperationOptions>
  ): Promise<R> {
    let attempts = 1;
    let lastError: Error = new Error('Unknown error');
    
    while (attempts <= options.retryCount) {
      try {
        // Attempt the operation
        return await operation();
      } catch (error) {
        const err = error as Error;
        console.warn(
          `Operation failed for item at index ${index}, attempt ${attempts}/${options.retryCount}: ${err.message || String(error)}`
        );
        
        lastError = err;
        
        // If we've reached max retries, throw the error
        if (attempts >= options.retryCount) {
          break;
        }
        
        // Calculate delay for next retry
        const delay = options.exponentialBackoff
          ? options.retryDelay * Math.pow(2, attempts) + Math.random() * 1000
          : options.retryDelay * Math.pow(1.5, attempts - 1);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attempts++;
      }
    }
    
    // If we get here, all retries failed
    throw new Error(
      `Operation failed after ${attempts} attempts for item at index ${index}: ${lastError?.message || 'Unknown error'}`
    );
  }
} 