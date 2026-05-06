## ADDED Requirements

### Requirement: Desktop separates persistable snapshots from transient recovery views
The desktop sync flow SHALL distinguish between a canonical snapshot that is safe to persist and a sanitized recovery view that is safe only for the current session. Raw payloads containing invalid entities MUST NOT be written to local persistent storage.

#### Scenario: Canonical snapshot is persisted locally
- **WHEN** the desktop client receives a cloud snapshot that satisfies the integrity contract after normalization
- **THEN** it SHALL write that snapshot to local persistent storage and trigger the normal rehydrate flow

#### Scenario: Partially invalid snapshot is only applied transiently
- **WHEN** the desktop client can derive a legal subset from a cloud snapshot but the original payload still contains dropped or rejected entities
- **THEN** it SHALL expose only the legal subset for the current session and SHALL NOT persist the raw invalid payload to local storage

### Requirement: Desktop exposes user-visible diagnostics for dropped or rejected cloud data
The desktop client SHALL surface diagnostics whenever cloud data is rejected or partially recovered. The message MUST explain whether data was blocked, dropped, or kept only in a temporary recovery view.

#### Scenario: Rejected snapshot is explained to the user
- **WHEN** the desktop client rejects a cloud snapshot because it cannot be safely repaired
- **THEN** it SHALL show an error describing the integrity failure and the affected relationship categories

#### Scenario: Temporary recovery view is explained to the user
- **WHEN** the desktop client applies only a legal subset from a partially invalid cloud snapshot
- **THEN** it SHALL show a warning that invalid entities were excluded and were not saved to local persistence
