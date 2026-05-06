## ADDED Requirements

### Requirement: Online kanban mutations preserve referential closure
The system SHALL keep the kanban snapshot referentially closed after workspace, mission, or board mutations. Deleting a parent entity MUST remove or update all dependent entities, ordering indexes, and relation fields that would otherwise become orphaned.

#### Scenario: Deleting a workspace removes descendant missions and boards
- **WHEN** a user deletes a workspace in the online client
- **THEN** all missions, boards, notes, ordering entries, and derived references owned by that workspace SHALL be removed from the next snapshot before any cloud upload occurs

#### Scenario: Deleting a mission removes descendant boards and notes
- **WHEN** a user deletes a mission in the online client
- **THEN** all boards, notes, ordering entries, and derived references owned by that mission SHALL be removed from the next snapshot before any cloud upload occurs

### Requirement: Sync payloads are normalized before cloud persistence
The system SHALL normalize kanban snapshot payloads before they are persisted to cloud storage. Safe orphan cleanup MUST remove entities whose parent references are missing, and unsafe or ambiguous payloads MUST be rejected without overwriting the stored snapshot.

#### Scenario: Safe orphan cleanup during PUT
- **WHEN** `/api/sync` receives a snapshot containing boards or missions whose parents no longer exist but can be safely dropped
- **THEN** the server SHALL persist a sanitized snapshot with those orphan entities and stale ordering references removed

#### Scenario: Ambiguous parent ownership is rejected
- **WHEN** `/api/sync` receives a snapshot missing required parent ownership and multiple valid parents exist so ownership cannot be safely inferred
- **THEN** the server SHALL reject the request with a validation error and SHALL NOT replace the existing stored snapshot

### Requirement: Sync responses include repair diagnostics
The system SHALL return a structured repair summary whenever normalization changes a snapshot or rejects it. The summary MUST identify the problem categories and the affected entity classes so clients can display meaningful diagnostics.

#### Scenario: GET returns repair summary for a repaired historical snapshot
- **WHEN** a stored snapshot is sanitized during a cloud read
- **THEN** the response SHALL include a repair summary describing which entity classes were dropped or normalized before the data was returned

#### Scenario: PUT returns validation summary for a rejected snapshot
- **WHEN** an uploaded snapshot is rejected as unsafe
- **THEN** the response SHALL include diagnostic details describing why the payload could not be safely repaired
