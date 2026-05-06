## ADDED Requirements

### Requirement: Electron main process initialization
The system SHALL create an Electron main process that initializes the application, creates the main BrowserWindow, and manages the application lifecycle.

#### Scenario: Application cold start
- **WHEN** user double-clicks the application icon
- **THEN** the main process SHALL create a BrowserWindow loading the Vite-built React app within 3 seconds

#### Scenario: Single instance lock
- **WHEN** user attempts to open a second instance of the application
- **THEN** the system SHALL focus the existing window instead of creating a new instance

### Requirement: IPC communication bridge
The system SHALL provide a secure IPC bridge between main process and renderer process using contextBridge and preload scripts.

#### Scenario: Renderer invokes main process API
- **WHEN** renderer process calls an exposed IPC method (e.g., `window.electronAPI.db.query()`)
- **THEN** the main process SHALL handle the request and return the result via IPC

#### Scenario: IPC security isolation
- **WHEN** renderer process attempts to access Node.js APIs directly
- **THEN** the system SHALL block the access (nodeIntegration: false, contextIsolation: true)

### Requirement: System tray integration
The system SHALL display a system tray icon with a context menu for quick actions.

#### Scenario: Minimize to tray
- **WHEN** user closes the main window
- **THEN** the application SHALL minimize to the system tray instead of quitting

#### Scenario: Tray context menu
- **WHEN** user right-clicks the tray icon
- **THEN** the system SHALL display a menu with options: "Show Window", "Quick Chat (Shift+Alt+Space)", "Quit"

### Requirement: Window state persistence
The system SHALL remember and restore the main window's position, size, and maximized state across sessions.

#### Scenario: Window state saved on close
- **WHEN** user closes or minimizes the main window
- **THEN** the system SHALL persist window bounds and state to local storage

#### Scenario: Window state restored on launch
- **WHEN** application starts
- **THEN** the main window SHALL restore to the previously saved position and size

### Requirement: Application packaging and distribution
The system SHALL be packaged using electron-builder for Windows (NSIS installer) and macOS (DMG).

#### Scenario: Windows build
- **WHEN** developer runs the build command
- **THEN** electron-builder SHALL produce a Windows NSIS installer with auto-update support

### Requirement: Auto-update mechanism
The system SHALL check for updates on startup and notify the user when a new version is available.

#### Scenario: Update available
- **WHEN** the app detects a newer version on the update server
- **THEN** the system SHALL display a non-intrusive notification with "Update Now" and "Later" options
