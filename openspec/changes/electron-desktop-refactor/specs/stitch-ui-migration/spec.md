## ADDED Requirements

### Requirement: Design token extraction and Tailwind theme
The system SHALL extract all design tokens from the stitch HTML prototype and configure them as a Tailwind CSS theme extension.

#### Scenario: Color tokens configured
- **WHEN** the Tailwind configuration is loaded
- **THEN** all Digital Sanctuary colors (surface hierarchy, primary, secondary, tertiary, error) SHALL be available as Tailwind utility classes

#### Scenario: Typography tokens configured
- **WHEN** the Tailwind configuration is loaded
- **THEN** Manrope (display/headlines) and Inter (body) font families with the editorial scale sizes SHALL be available as Tailwind utilities

### Requirement: Core layout components
The system SHALL provide React components for the main application layout matching the stitch prototype structure.

#### Scenario: Sidebar component
- **WHEN** the main layout renders
- **THEN** a Sidebar component SHALL display workspace name, navigation items (Library, Tasks, Archive, Settings, Support), and user profile, following the Digital Sanctuary asymmetric layout principle

#### Scenario: Note list component
- **WHEN** the user navigates to the Library view
- **THEN** a NoteList component SHALL display notes with title, preview text, timestamp, and optional tags, using vertical whitespace separation (no dividers per the No-Line Rule)

#### Scenario: Task board component
- **WHEN** the user navigates to the Tasks view
- **THEN** a TaskBoard component SHALL display kanban columns (To Do, In Progress, Done) with draggable task cards

### Requirement: Component styling follows No-Line Rule
All components SHALL define boundaries through background color shifts instead of borders.

#### Scenario: Section boundaries
- **WHEN** two adjacent sections are rendered
- **THEN** the boundary SHALL be defined by surface color hierarchy (e.g., surface-container-low vs background) with NO 1px borders

#### Scenario: List item separation
- **WHEN** a list of items is rendered
- **THEN** items SHALL be separated by vertical whitespace (2rem minimum) with no horizontal rules

### Requirement: Interactive states and animations
Components SHALL implement hover, focus, and press states following Digital Sanctuary conventions.

#### Scenario: List item hover
- **WHEN** user hovers over a list item
- **THEN** the item background SHALL transition to `surface-container` with `xl` corner radius (0.75rem)

#### Scenario: Button press
- **WHEN** user presses a primary button
- **THEN** the button SHALL scale down to 98% and use `primary-dim` background color

### Requirement: Floating action button
The system SHALL provide a floating action button (FAB) for creating new items, styled with gradient per Digital Sanctuary spec.

#### Scenario: FAB display
- **WHEN** the main view is active
- **THEN** a circular FAB SHALL be positioned in the bottom-right corner with a primary color gradient from top-left to bottom-right

#### Scenario: FAB action
- **WHEN** user clicks the FAB
- **THEN** a creation dialog SHALL appear (New Note, New Task, etc.)
