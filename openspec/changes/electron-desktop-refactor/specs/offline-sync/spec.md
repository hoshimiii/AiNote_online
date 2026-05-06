## ADDED Requirements

### Requirement: Automatic background sync
The system SHALL automatically synchronize local SQLite data with the cloud PostgreSQL database when network connectivity is available.

#### Scenario: Online sync trigger
- **WHEN** the application detects network connectivity AND there are unsynced local changes
- **THEN** the sync engine SHALL push local changes to the cloud within 30 seconds

#### Scenario: Offline operation
- **WHEN** the application has no network connectivity
- **THEN** all operations SHALL continue using the local SQLite database without errors or blocking

### Requirement: Incremental sync based on timestamps
The system SHALL use `localUpdatedAt` and `cloudUpdatedAt` timestamps to determine which records need synchronization.

#### Scenario: Upload local changes
- **WHEN** a record has `localUpdatedAt > cloudUpdatedAt`
- **THEN** the sync engine SHALL push that record to the cloud PostgreSQL via Prisma and update `cloudUpdatedAt`

#### Scenario: Download cloud changes
- **WHEN** a cloud record has `updatedAt > localUpdatedAt` for the corresponding local record
- **THEN** the sync engine SHALL pull that record and update the local SQLite database

### Requirement: Conflict resolution with Last-Write-Wins
The system SHALL resolve sync conflicts using a Last-Write-Wins strategy based on timestamps.

#### Scenario: Concurrent edit conflict
- **WHEN** both local and cloud have changes to the same record since last sync
- **THEN** the system SHALL keep the version with the more recent timestamp and overwrite the other

### Requirement: Sync status indicator
The system SHALL display the current sync status in the UI.

#### Scenario: Sync in progress
- **WHEN** the sync engine is actively synchronizing
- **THEN** the UI SHALL display a sync-in-progress indicator

#### Scenario: Sync complete
- **WHEN** all local changes have been synchronized
- **THEN** the UI SHALL display a "synced" indicator with the last sync timestamp

#### Scenario: Sync error
- **WHEN** the sync engine encounters an error
- **THEN** the UI SHALL display an error indicator with retry option

### Requirement: User authentication for sync
The system SHALL require user authentication before enabling cloud sync features.

#### Scenario: Unauthenticated local usage
- **WHEN** user is not logged in
- **THEN** the application SHALL function fully with local SQLite storage only, sync features disabled

#### Scenario: Login enables sync
- **WHEN** user logs in with valid credentials
- **THEN** the system SHALL initiate a full sync and enable automatic background sync

### Requirement: First-time data migration
The system SHALL provide a one-time migration tool to import existing cloud data into the local SQLite database.

#### Scenario: Initial data pull
- **WHEN** user logs in for the first time on a new device
- **THEN** the system SHALL download all user data from the cloud and populate the local SQLite database
