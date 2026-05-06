## ADDED Requirements

### Requirement: LLM service migration to main process
The system SHALL run the LLM service (LangChain + OpenAI) in the Electron main process, accessible to renderers via IPC.

#### Scenario: Chat completion via IPC
- **WHEN** the renderer process requests a chat completion via `window.electronAPI.llm.chat(messages)`
- **THEN** the main process SHALL invoke the LLM service and stream tokens back to the renderer via IPC events

#### Scenario: Streaming response
- **WHEN** a streaming LLM response is in progress
- **THEN** the main process SHALL emit incremental token events that the renderer can subscribe to

### Requirement: MCP bridge integration
The system SHALL run the MCP bridge server within the Electron main process or as a child process.

#### Scenario: MCP tool invocation
- **WHEN** the AI agent needs to invoke an MCP tool
- **THEN** the system SHALL route the request through the local MCP bridge without requiring external network access to the bridge

#### Scenario: MCP bridge lifecycle
- **WHEN** the Electron application starts
- **THEN** the MCP bridge process SHALL start automatically and be ready to handle tool calls

### Requirement: Code execution service
The system SHALL provide sandboxed code execution capability within the Electron environment.

#### Scenario: Execute code snippet
- **WHEN** the AI agent or user requests code execution
- **THEN** the system SHALL execute the code in a sandboxed environment and return stdout/stderr results

### Requirement: API route migration
The system SHALL replace Next.js API routes with Electron IPC handlers maintaining the same business logic.

#### Scenario: Auth endpoints
- **WHEN** the renderer needs authentication functionality
- **THEN** IPC handlers SHALL provide login, logout, and session management equivalent to the former `/api/auth/` routes

#### Scenario: Sync endpoints
- **WHEN** the renderer triggers a sync operation
- **THEN** IPC handlers SHALL provide push/pull functionality equivalent to the former `/api/sync/` route

#### Scenario: Memory endpoints
- **WHEN** the renderer needs to store or retrieve embeddings
- **THEN** IPC handlers SHALL provide memory operations equivalent to the former `/api/memory/` routes

### Requirement: Environment configuration
The system SHALL load configuration (API keys, database URLs, etc.) from a local config file in the app data directory.

#### Scenario: Config file loading
- **WHEN** the main process initializes
- **THEN** the system SHALL read configuration from `config.json` in the app data directory, with fallback to environment variables

#### Scenario: Sensitive data storage
- **WHEN** storing API keys or credentials
- **THEN** the system SHALL use the OS credential store (via keytar or Electron's safeStorage) instead of plain text files
