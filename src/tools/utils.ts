/**
 * Utility functions for ClickUp MCP tools
 */

/**
 * Parse a due date string into a timestamp
 * Supports ISO 8601 format or natural language like "tomorrow"
 * 
 * @param dateString Date string to parse
 * @returns Timestamp in milliseconds or undefined if parsing fails
 */
export function parseDueDate(dateString: string): number | undefined {
  if (!dateString) return undefined;
  
  try {
    // Handle natural language dates
    const lowerDate = dateString.toLowerCase();
    const now = new Date();
    
    if (lowerDate === 'today') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return today.getTime();
    }
    
    if (lowerDate === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return tomorrow.getTime();
    }
    
    if (lowerDate.includes('next week')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);
      return nextWeek.getTime();
    }
    
    if (lowerDate.includes('next month')) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setHours(23, 59, 59, 999);
      return nextMonth.getTime();
    }
    
    // Try to parse as a date string
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    
    // If all parsing fails, return undefined
    return undefined;
  } catch (error) {
    console.warn(`Failed to parse due date: ${dateString}`, error);
    return undefined;
  }
} 