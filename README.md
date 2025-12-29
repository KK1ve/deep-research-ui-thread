# Deep Research Viewer

A React-based visualization interface for deep research agents. This application renders a real-time, hierarchical view of agent interactions, tool executions, and final research reports.

## Features

- **Hierarchical Visualization**: Renders agent thoughts and tool calls as a nested tree structure.
- **Real-time Streaming**: Connects to a backend `threading` endpoint to stream tokens and tool updates via Server-Sent Events (SSE).
- **Final Report Generation**: Automatically parses and displays a polished "Final Research Report" when the agent concludes its task (marked by `type: final`).
- **Source Linking**: parses custom `<source: url>` tags in reports into clickable citations.
- **Conversation History**: Full history management (Create, Read, Rename, Delete) with session persistence.
- **Auto-Resume**: Detects incomplete threads in history and attempts to resume the stream.

## Architecture

### Tech Stack
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Markdown**: ByteMD (GitHub Flavor)

### Data Flow

1.  **Initiation**: User sends a prompt via `fetchCompletion` (/chat/completion).
2.  **Handshake**: Backend returns a `message_uuid`.
3.  **Streaming**: Frontend connects to `streamThreading` (/chat/threading) using the `message_uuid`.
4.  **Tree Construction**: 
    - Incoming chunks contain `id`, `parent_id`, and `role`.
    - `Visualization.tsx` maintains a `Map<string, ResearchNode>`.
    - Chunks with `type: new` create nodes.
    - Chunks with `type: append` update content/toolArgs.
    - Nodes are linked via `children` arrays based on `parent_id`.

### Final Report Logic
The "Final Research Report" card is a special UI element.
- It is **only** displayed if a `ResearchNode` has `isFinal: true`.
- This flag is set strictly when the backend sends a chunk (or history item) with `type: "final"`.
- This prevents intermediate tool outputs from cluttering the view as final reports.

## Project Structure

- **`components/`**
  - `Visualization.tsx`: Main controller, handles state, API calls, and stream processing.
  - `ResearchNode.tsx`: Recursive component that renders a single node and its children.
  - `FinalReport.tsx`: Specialized component for rendering the markdown report with source parsing.
  - `Sidebar.tsx`: Manages conversation history.
- **`services/`**
  - `api.ts`: API interaction layer. Handles SSE parsing manually to support the specific line-delimited JSON format.
- **`types.ts`**: TypeScript definitions for API DTOs and internal state.

## Setup & Development

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start Development Server**
    ```bash
    npm run dev
    ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

## Environment Variables

- `VITE_API_BASE_URL`: (Optional) Base URL for the backend API. Defaults to `http://localhost:8000`.

## Maintenance Guide

### Adding New Roles
1.  Update `Role` enum in `types.ts`.
2.  Update `ResearchNode.tsx` to assign colors/icons for the new role.

### Customizing Markdown
The Markdown styles are defined in `index.html` under `.markdown-body` overrides to ensure they look good in the dark theme. Update these styles to change the report appearance.
