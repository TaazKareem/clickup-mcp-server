/**
 * Base ClickUp Service Class
 * 
 * This class provides core functionality for all ClickUp service modules:
 * - Axios client configuration
 * - Rate limiting and request throttling
 * - Error handling
 * - Common request methods
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Basic service response interface
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  }
}

/**
 * Error types for better error handling
 */
export enum ErrorCode {
  RATE_LIMIT = 'rate_limit_exceeded',
  NOT_FOUND = 'resource_not_found',
  UNAUTHORIZED = 'unauthorized',
  VALIDATION = 'validation_error',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown_error'
}

/**
 * Custom error class for ClickUp API errors
 */
export class ClickUpServiceError extends Error {
  readonly code: ErrorCode;
  readonly data?: any;
  readonly status?: number;
  context?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    data?: any,
    status?: number,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ClickUpServiceError';
    this.code = code;
    this.data = data;
    this.status = status;
    this.context = context;
  }
}

/**
 * Rate limit response headers from ClickUp API
 */
interface RateLimitHeaders {
  'x-ratelimit-limit': number;
  'x-ratelimit-remaining': number;
  'x-ratelimit-reset': number;
}

/**
 * Base ClickUp service class that handles common functionality
 */
export class BaseClickUpService {
  protected readonly apiKey: string;
  protected readonly teamId: string;
  protected readonly client: AxiosInstance;
  
  protected readonly defaultRequestSpacing = 600; // Default milliseconds between requests
  protected readonly rateLimit = 100; // Maximum requests per minute (Free Forever plan)
  protected requestSpacing: number; // Current request spacing, can be adjusted
  protected readonly timeout = 65000; // 65 seconds (safely under the 1-minute window)
  protected requestQueue: (() => Promise<any>)[] = [];
  protected processingQueue = false;
  protected lastRateLimitReset: number = 0;

  /**
   * Creates an instance of BaseClickUpService.
   * @param apiKey - ClickUp API key for authentication
   * @param teamId - ClickUp team ID for targeting the correct workspace
   * @param baseUrl - Optional custom base URL for the ClickUp API
   */
  constructor(apiKey: string, teamId: string, baseUrl: string = 'https://api.clickup.com/api/v2') {
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.requestSpacing = this.defaultRequestSpacing;

    // Configure the Axios client with default settings
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: this.timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleRequestError(error)
    );
  }

  /**
   * Handles API request errors and transforms them into standardized ClickUpServiceError
   * @private
   * @param error - The error from Axios
   * @throws ClickUpServiceError with appropriate error code and message
   */
  private handleRequestError(error: any): never {
    let message = 'Unknown error occurred';
    let code = ErrorCode.UNKNOWN;
    let details = null;
    let status = null;

    if (error.response) {
      // Server responded with an error status code
      status = error.response.status;
      details = error.response.data;
      
      switch (status) {
        case 401:
          message = 'Unauthorized: Invalid API key';
          code = ErrorCode.UNAUTHORIZED;
          break;
        case 403:
          message = 'Forbidden: Insufficient permissions';
          code = ErrorCode.UNAUTHORIZED;
          break;
        case 404:
          message = 'Resource not found';
          code = ErrorCode.NOT_FOUND;
          break;
        case 429:
          message = 'Rate limit exceeded';
          code = ErrorCode.RATE_LIMIT;
          break;
        case 400:
          message = 'Invalid request: ' + (error.response.data?.err || 'Validation error');
          code = ErrorCode.VALIDATION;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          message = 'ClickUp server error';
          code = ErrorCode.SERVER_ERROR;
          break;
        default:
          message = `ClickUp API error (${status}): ${error.response.data?.err || 'Unknown error'}`;
      }
    } else if (error.request) {
      // Request was made but no response received
      message = 'Network error: No response received from ClickUp';
      code = ErrorCode.NETWORK_ERROR;
      details = { request: error.request };
    } else {
      // Error setting up the request
      message = `Request setup error: ${error.message}`;
      details = { message: error.message };
    }

    throw new ClickUpServiceError(message, code, details, status);
  }

  /**
   * Process the request queue, respecting rate limits by spacing out requests
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (request) {
          try {
            await request();
          } catch (error) {
            console.error('Request failed:', error);
            // Continue processing queue even if one request fails
          }
          
          // Space out requests to stay within rate limit
          if (this.requestQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.requestSpacing));
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Handle rate limit headers from ClickUp API
   * @private
   * @param headers Response headers from ClickUp
   */
  private handleRateLimitHeaders(headers: any): void {
    const limit = parseInt(headers['x-ratelimit-limit'], 10);
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    const reset = parseInt(headers['x-ratelimit-reset'], 10);

    if (!isNaN(reset)) {
      this.lastRateLimitReset = reset;
    }

    // If we're running low on remaining requests, increase spacing
    if (!isNaN(remaining) && remaining < 10) {
      const timeUntilReset = (this.lastRateLimitReset * 1000) - Date.now();
      if (timeUntilReset > 0) {
        this.requestSpacing = Math.max(this.defaultRequestSpacing, Math.floor(timeUntilReset / remaining));
      }
    } else {
      this.requestSpacing = this.defaultRequestSpacing; // Reset to default spacing
    }
  }

  /**
   * Makes an API request with rate limiting.
   * @protected
   * @param fn - Function that executes the API request
   * @returns Promise that resolves with the result of the API request
   */
  protected async makeRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          // Handle rate limit headers if present
          if (result && typeof result === 'object' && 'headers' in result) {
            this.handleRateLimitHeaders(result.headers);
          }
          resolve(result);
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
            const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0', 10);
            
            // Use the more precise reset time if available
            const waitTime = resetTime > 0 ? 
              (resetTime * 1000) - Date.now() : 
              retryAfter * 1000;

            await new Promise(resolve => setTimeout(resolve, waitTime));
            try {
              // Retry the request once after waiting
              const result = await fn();
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(error);
          }
        }
      });

      this.processQueue().catch(reject);
    });
  }

  /**
   * Gets the ClickUp team ID associated with this service instance
   * @returns The team ID
   */
  getTeamId(): string {
    return this.teamId;
  }

  /**
   * Helper method to log API operations
   * @protected
   * @param operation - Name of the operation being performed
   * @param details - Details about the operation
   */
  protected logOperation(operation: string, details: any): void {
    // This could be enhanced to use a proper logging framework
    console.log(`[ClickUpService] ${operation}:`, details);
  }
} 