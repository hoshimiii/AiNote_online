## ADDED Requirements

### Requirement: SQLite database initialization
The system SHALL create and initialize a SQLite database file in the user's app data directory on first launch, with all required tables.

#### Scenario: First launch database creation
- **WHEN** the application starts for the first time
- **THEN** the system SHALL create `ainote.db` in the platform-specific app data path and run all migration scripts

#### Scenario: Schema migration on update
- **WHEN** the application updates to a version with new schema changes
- **THEN** the system SHALL run pending migrations automatically without data loss

### Requirement: Local data schema
The system SHALL maintain the following tables in SQLite: `workspaces`, `missions`, `boards`, `tasks`, `subtasks`, `notes`, `note_blocks`, `conversations`, `messages`, `settings`, `sync_meta`.

#### Scenario: Note CRUD operations
- **WHEN** user creates, reads, updates, or deletes a note
- **THEN** the system SHALL persist the change to the local SQLite `notes` table with `localUpdatedAt` timestamp

#### Scenario: Kanban board operations
- **WHEN** user modifies board/task/subtask structure
- **THEN** the system SHALL persist changes to the corresponding SQLite tables maintaining referential integrity

### Requirement: Zustand store SQLite adapter
The system SHALL provide a Zustand middleware that reads initial state from SQLite and writes state changes back to SQLite.

#### Scenario: Store hydration from SQLite
- **WHEN** the React app initializes a Zustand store
- **THEN** the store SHALL hydrate its state from the local SQLite database via IPC

#### Scenario: Store mutation persistence
- **WHEN** a Zustand store mutation occurs
- **THEN** the middleware SHALL asynchronously persist the changed records to SQLite via IPC within 500ms

### Requirement: Data access layer (DAO)
The system SHALL provide a type-safe DAO layer wrapping better-sqlite3 for all CRUD operations.

#### Scenario: Type-safe query execution
- **WHEN** the DAO layer executes a query
- **THEN** the result SHALL be typed according to the TypeScript interfaces matching the SQLite schema

#### Scenario: Transaction support
- **WHEN** multiple related mutations need to execute atomically
- **THEN** the DAO layer SHALL wrap them in a SQLite transaction
