# ClickUp MCP Server
[![smithery badge](https://smithery.ai/badge/@TaazKareem/clickup-mcp-server)](https://smithery.ai/server/@TaazKareem/clickup-mcp-server)

A Model Context Protocol (MCP) server for integrating ClickUp tasks with AI applications. This server allows AI agents to interact with ClickUp tasks, spaces, lists, and folders through a standardized protocol.

## Features

- 🔄 **Resource Management**
  - List and read ClickUp tasks as resources
  - View task details, status, and assignments
  - Access task history and relationships

- 📂 **Workspace Organization**
  - Create and manage spaces
  - Create, update, and delete folders
  - Create and manage lists (in spaces or folders)
  - Flexible identification using IDs or names

- ✨ **Task Operations**
  - Create and update tasks
  - Move tasks between lists
  - Duplicate tasks
  - Set priorities and due dates
  - Assign team members

- 📊 **Information Retrieval**
  - Get spaces and lists with their IDs
  - List available statuses
  - Find items by name (case-insensitive)
  - View task relationships

- 📝 **AI Integration**
  - Generate task descriptions with AI
  - Summarize tasks and analyze priorities
  - Get AI-powered task recommendations

- 🔒 **Security**
  - Secure API key management
  - Environment-based configuration

## Installation

### Installing via Smithery

To install ClickUp MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@TaazKareem/clickup-mcp-server):

```bash
npx -y @smithery/cli install @TaazKareem/clickup-mcp-server --client claude
```

### Using npx (Recommended)
```bash
npx @taazkareem/clickup-mcp-server
```

### Global Installation
```bash
npm install -g @taazkareem/clickup-mcp-server
```

## Configuration

1. Get your ClickUp API key from [ClickUp Settings](https://app.clickup.com/settings/apps)
2. Create a `.env` file:
```env
CLICKUP_API_KEY=your_api_key_here
TEAM_ID=your_team_id_here
```

## Using with Cursor AI Composer

To add this server to Cursor AI Composer, follow these steps:

1. Go to the Features section in the settings.
2. Add the following command under MCP Servers:

```bash
npx -y @taazkareem/clickup-mcp-server \
  --env CLICKUP_API_KEY=your_api_key_here \
  --env TEAM_ID=your_team_id_here
```
3. Replace `your_api_key_here` and `your_team_id_here` with your actual ClickUp credentials.
4. Click on 'Save' to add the server.

You can get these values from:
- `CLICKUP_API_KEY`: Get from [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
- `TEAM_ID`: Your ClickUp Team ID (found in the URL when viewing your workspace or via API)

> **Security Note**: Your API key will be stored securely and will not be exposed to AI models.

### Available Tools

1. **list_spaces**
   - Lists all spaces and their lists with IDs
   - Shows available statuses for each list
   - No parameters required

2. **create_task**
   - Creates a new task in ClickUp
   - Required parameters:
     - `listId`: ID of the list to create the task in
     - `name`: Name of the task
   - Optional parameters:
     - `description`: Task description
     - `status`: Task status
     - `priority`: Priority level (1-4)
     - `dueDate`: Due date (ISO string)
     - `assignees`: Array of user IDs

3. **create_bulk_tasks**
   - Creates multiple tasks simultaneously in a list
   - Required parameters:
     - `listId`: ID of the list to create the tasks in
     - `tasks`: Array of task objects, each containing:
       - `name`: Name of the task (required)
       - `description`: Task description (optional)
       - `status`: Task status (optional)
       - `priority`: Priority level 1-4 (optional)
       - `dueDate`: Due date ISO string (optional)
       - `assignees`: Array of user IDs (optional)

4. **create_list**
   - Creates a new list in a space
   - Required parameters:
     - `name`: Name of the list
   - Optional parameters:
     - `spaceId`: ID of the space (optional if spaceName provided)
     - `spaceName`: Name of the space (optional if spaceId provided)
     - `content`: List description
     - `status`: List status
     - `priority`: Priority level (1-4)
     - `dueDate`: Due date (ISO string)

5. **create_folder**
   - Creates a new folder in a space
   - Required parameters:
     - `name`: Name of the folder
   - Optional parameters:
     - `spaceId`: ID of the space (optional if spaceName provided)
     - `spaceName`: Name of the space (optional if spaceId provided)
     - `override_statuses`: Whether to override space statuses

6. **create_list_in_folder**
   - Creates a new list within a folder
   - Required parameters:
     - `name`: Name of the list
   - Optional parameters:
     - `folderId`: ID of the folder (optional if using folderName)
     - `folderName`: Name of the folder
     - `spaceId`: ID of the space (required if using folderName)
     - `spaceName`: Name of the space (alternative to spaceId)
     - `content`: List description
     - `status`: List status

7. **move_task**
   - Moves a task to a different list
   - Required parameters:
     - `taskId`: ID of the task to move
     - `listId`: ID of the destination list

8. **duplicate_task**
   - Creates a copy of a task in a specified list
   - Required parameters:
     - `taskId`: ID of the task to duplicate
     - `listId`: ID of the destination list

9. **update_task**
   - Updates an existing task
   - Required parameters:
     - `taskId`: ID of the task to update
   - Optional parameters:
     - `name`: New task name
     - `description`: New description
     - `status`: New status
     - `priority`: New priority level (1-4)
     - `dueDate`: New due date (ISO string)

### Available Prompts

1. **summarize_tasks**
   - Provides a comprehensive summary of tasks
   - Groups tasks by status
   - Highlights priorities and deadlines
   - Suggests task relationships

2. **analyze_priorities**
   - Analyzes task priority distribution
   - Identifies misaligned priorities
   - Suggests priority adjustments
   - Recommends task sequencing

3. **generate_description**
   - Helps generate detailed task descriptions
   - Includes:
     - Clear objectives
     - Success criteria
     - Required resources
     - Dependencies
     - Potential risks

## Name Resolution

Most tools support finding items by either ID or name:
- Spaces can be referenced by `spaceId` or `spaceName`
- Folders can be referenced by `folderId` or `folderName` (with space information)
- Lists can be referenced by `listId` or found within spaces/folders

Name matching is case-insensitive for convenience.

## Error Handling

The server provides clear error messages for common scenarios:
- Missing required parameters
- Invalid IDs or names
- Items not found
- Permission issues
- API errors

## Development

1. Clone the repository:
```bash
git clone https://github.com/taazkareem/clickup-mcp-server.git
cd clickup-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Start in development mode:
```bash
npm run dev
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 
