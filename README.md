<img src="https://clickup.com/assets/brand/logo-v3-clickup-dark.svg" alt="ClickUp" height="40" style="vertical-align: middle; margin-top: -4px;">

# MCP Server
A Model Context Protocol (MCP) server for integrating ClickUp tasks with AI applications. This server allows AI agents to interact with ClickUp tasks, spaces, lists, and folders through a standardized protocol.

> 🚧 **Status Update:** -The code refactoring has been completed. -Enhanced due date functionality now supports relative time expressions like "2 hours from now" with proper time display in ClickUp.  -npx command updated to use @latest which should automatically update the server when a new version is released. -Server has been listed on Smithery, Glama, and Pulse MCP.

<a href="https://glama.ai/mcp/servers/iwjvs2zy63">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/iwjvs2zy63/badge" alt="ClickUp Server MCP server" />
</a>

## Quick Start

Directions for use with Cursor Composer Agent:

1. Get your credentials:
   - ClickUp API key from [ClickUp Settings](https://app.clickup.com/settings/apps)
   - Team ID from your ClickUp workspace URL
2. Go to Features in settings (or MCP Servers depending on version)
3. Add under MCP Servers:
```bash
npx -y @taazkareem/clickup-mcp-server@latest \
  --env CLICKUP_API_KEY=your_api_key_here \
  --env CLICKUP_TEAM_ID=your_team_id_here
```
4. Replace the credentials and click Save
5. Use Natural Language to interact with your ClickUp Workspace!


## Smithery Installation

[![smithery badge](https://smithery.ai/badge/@TaazKareem/clickup-mcp-server)](https://smithery.ai/server/@TaazKareem/clickup-mcp-server)

The server is also hosted on Smithery. There, you can preview the available tools or copy the commands to run on your specific client app.

## Features

- 🎯 **Task Management**
  - Create, update, and delete individual tasks
  - Move and duplicate tasks between lists, spaces, and folders
  - Create, update, move,and delete multiple tasks in bulk
  - View and modify task details and properties
  - Set due dates using natural language and relative time expressions

- 📂 **Workspace Organization**
  - Complete workspace hierarchy (spaces, folders, lists)
  - Tree structure with clear relationships
  - Full CRUD operations for workspace components
  - Efficient path-based navigation

- 🔄 **Integration Features**
  - Name or ID-based item lookup
  - Case-insensitive name matching
  - Markdown formatting support
  - Built-in API rate limiting

## Available Tools

| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| [get_workspace_hierarchy](docs/api-reference.md#workspace-navigation) | Get workspace structure | None |
| [create_task](docs/api-reference.md#task-management) | Create a task | `name`, (`listId`/`listName`) |
| [create_bulk_tasks](docs/api-reference.md#task-management) | Create multiple tasks | `tasks[]` |
| [update_task](docs/api-reference.md#task-management) | Modify task | `taskId`/`taskName` |
| [update_bulk_tasks](docs/api-reference.md#task-management) | Update multiple tasks | `tasks[]` with IDs or names |
| [get_tasks](docs/api-reference.md#task-retrieval) | Get tasks from list | `listId`/`listName` |
| [get_task](docs/api-reference.md#task-retrieval) | Get task details | `taskId`/`taskName` |
| [delete_task](docs/api-reference.md#task-management) | Remove task | `taskId`/`taskName` |
| [delete_bulk_tasks](docs/api-reference.md#task-management) | Remove multiple tasks | `tasks[]` with IDs or names |
| [move_task](docs/api-reference.md#task-management) | Move task | `taskId`/`taskName`, `listId`/`listName` |
| [move_bulk_tasks](docs/api-reference.md#task-management) | Move multiple tasks | `tasks[]` with IDs or names, target list |
| [duplicate_task](docs/api-reference.md#task-management) | Copy task | `taskId`/`taskName`, `listId`/`listName` |
| [create_list](docs/api-reference.md#list-management) | Create list in space | `name`, `spaceId`/`spaceName` |
| [create_folder](docs/api-reference.md#folder-management) | Create folder | `name`, `spaceId`/`spaceName` |
| [create_list_in_folder](docs/api-reference.md#list-management) | Create list in folder | `name`, `folderId`/`folderName` |
| [get_folder](docs/api-reference.md#folder-management) | Get folder details | `folderId`/`folderName` |
| [update_folder](docs/api-reference.md#folder-management) | Update folder properties | `folderId`/`folderName` |
| [delete_folder](docs/api-reference.md#folder-management) | Delete folder | `folderId`/`folderName` |
| [get_list](docs/api-reference.md#list-management) | Get list details | `listId`/`listName` |
| [update_list](docs/api-reference.md#list-management) | Update list properties | `listId`/`listName` |
| [delete_list](docs/api-reference.md#list-management) | Delete list | `listId`/`listName` |

See [full documentation](docs/api-reference.md) for optional parameters and advanced usage.

## Available Prompts
Not yet implemented (or needed) For now, you can send a follow up prompt after the tool result.

| Prompt | Purpose | Features |
|--------|---------|----------|
| [summarize_tasks](docs/api-reference.md#prompts) | Task overview | Status summary, priorities, relationships |
| [analyze_priorities](docs/api-reference.md#prompts) | Priority optimization | Distribution analysis, sequencing |
| [generate_description](docs/api-reference.md#prompts) | Task description creation | Objectives, criteria, dependencies |

## Error Handling

The server provides clear error messages for:
- Missing required parameters
- Invalid IDs or names
- Items not found
- Permission issues
- API errors
- Rate limiting

## Support the Developer

If you find this project useful, please consider supporting

[![Sponsor TaazKareem](https://img.shields.io/badge/Sponsor-TaazKareem-orange?logo=github)](https://github.com/sponsors/TaazKareem)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

Disclaimer: This software makes use of third-party APIs and may reference trademarks
or brands owned by third parties. The use of such APIs or references does not imply 
any affiliation with or endorsement by the respective companies. All trademarks and 
brand names are the property of their respective owners. This project is an independent
work and is not officially associated with or sponsored by any third-party company mentioned.

