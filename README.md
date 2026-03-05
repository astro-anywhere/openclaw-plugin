# @astroanywhere/openclaw-plugin

OpenClaw plugin that exposes [Astro](https://github.com/fuxialexander/astro) project/plan/task management as gateway tools.

## Tools

| Tool | Gateway Method | Description |
|------|---------------|-------------|
| `astro_list_projects` | `astro.projects.list` | List all Astro projects |
| `astro_get_plan` | `astro.projects.getPlan` | Get the plan graph for a project |
| `astro_run_task` | `astro.dispatch.task` | Dispatch a task for execution |
| `astro_task_status` | `astro.dispatch.taskStatus` | Get execution status |

## Usage

```typescript
import { createPlugin } from '@astroanywhere/openclaw-plugin'

const plugin = createPlugin({
  serverUrl: 'http://localhost:3001',
  authToken: '',
})

const result = await plugin.invoke('astro_list_projects', {})
```

## Configuration

Place `openclaw.plugin.json` in your OpenClaw gateway plugins directory. Configure:

- `serverUrl` — Base URL of the Astro backend API (default: `http://localhost:3001`)
- `authToken` — Bearer token for API authentication (optional in local mode)
- `teamId` — Team ID to scope API requests (optional)
