import { ClickUpService } from '../services/clickup.js';
import { getAllTasks } from '../utils/resolvers.js';

export async function handleSummarizeTasks(clickup: ClickUpService, teamId: string): Promise<string> {
  const { tasks } = await getAllTasks(clickup, teamId);
  
  let output = "Summarized Tasks:\n\n";
  for (const task of tasks) {
    output += `- ${task.name}: ${task.description}\n`;
  }
  
  return output;
}

export async function handleAnalyzeTaskPriorities(clickup: ClickUpService, teamId: string): Promise<string> {
  const { tasks } = await getAllTasks(clickup, teamId);
  
  const priorities = tasks.map(task => task.priority?.priority);
  const uniquePriorities = [...new Set(priorities.filter(p => p !== undefined))];
  const priorityCounts = uniquePriorities.map(priority => ({
    priority,
    count: priorities.filter(p => p === priority).length
  }));

  let output = "Task Priorities Analysis:\n\n";
  output += "Available Priorities: " + uniquePriorities.join(', ') + "\n\n";
  output += "Priority Counts:\n";
  for (const priority of priorityCounts) {
    output += `- Priority ${priority.priority}: ${priority.count}\n`;
  }

  return output;
} 