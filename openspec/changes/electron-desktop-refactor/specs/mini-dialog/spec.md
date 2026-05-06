## ADDED Requirements

### Requirement: Global shortcut activation
The system SHALL register `Shift+Alt+Space` as a global keyboard shortcut to toggle the mini dialog window.

#### Scenario: Show mini dialog
- **WHEN** user presses `Shift+Alt+Space` and the mini dialog is hidden
- **THEN** the system SHALL display the mini dialog window centered horizontally and positioned in the upper third of the screen

#### Scenario: Hide mini dialog
- **WHEN** user presses `Shift+Alt+Space` and the mini dialog is visible
- **THEN** the system SHALL hide the mini dialog window

#### Scenario: Shortcut works globally
- **WHEN** user presses `Shift+Alt+Space` while any application is focused
- **THEN** the system SHALL capture the shortcut and toggle the mini dialog regardless of which application is in the foreground

### Requirement: Mini dialog window properties
The system SHALL create the mini dialog as an independent, frameless BrowserWindow with glassmorphism styling.

#### Scenario: Window appearance
- **WHEN** the mini dialog is displayed
- **THEN** the window SHALL have no frame, a transparent background with backdrop blur effect, fixed size of approximately 600x400 pixels, and always-on-top behavior

#### Scenario: Click outside to dismiss
- **WHEN** the mini dialog is visible and user clicks outside the window
- **THEN** the system SHALL hide the mini dialog

#### Scenario: Escape key dismissal
- **WHEN** the mini dialog is visible and user presses the Escape key
- **THEN** the system SHALL hide the mini dialog

### Requirement: AI chat input and streaming response
The mini dialog SHALL provide a text input field that sends messages to the LLM service and displays streaming responses.

#### Scenario: Send message
- **WHEN** user types a message in the input field and presses Enter
- **THEN** the system SHALL send the message to the LLM service and display the streaming response in the dialog

#### Scenario: Auto-focus on show
- **WHEN** the mini dialog becomes visible
- **THEN** the text input field SHALL receive focus automatically

#### Scenario: Conversation context
- **WHEN** user sends multiple messages in the same dialog session
- **THEN** the system SHALL maintain conversation context within the session

#### Scenario: Clear on dismiss
- **WHEN** the mini dialog is hidden and re-shown
- **THEN** the system SHALL start a fresh conversation (previous context cleared)

### Requirement: Mini dialog UI design
The mini dialog SHALL follow the Digital Sanctuary design system with glassmorphism aesthetics.

#### Scenario: Visual consistency
- **WHEN** the mini dialog is rendered
- **THEN** it SHALL use the Digital Sanctuary color palette, typography (Inter for body, Manrope for headers), and the glassmorphism effect (surface at 70% opacity + backdrop blur 12px)
