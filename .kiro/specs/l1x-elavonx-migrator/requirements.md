# Requirements Document

## Introduction

The L1X ElavonX Migrator is a VS Code extension designed to assist developers in migrating legacy Converge API integrations to modern Elavon L1 APIs. The extension follows a phase-wise development approach where each phase delivers independently functional capabilities. The extension provides four main panels (Scan, Credentials, Documentation, Migration) with AI-assisted code transformation, secure credential management, and auditable migration workflows.

## Requirements

### Requirement 1 - Phase 0: Extension Skeleton & Interactive UI

**User Story:** As a developer, I want a working VS Code extension with all four panels and interactive buttons, so that I can verify the extension structure and UI components are properly wired.

#### Acceptance Criteria

1. WHEN I install the extension THEN the system SHALL display an L1X icon in the VS Code Activity Bar
2. WHEN I click the L1X icon THEN the system SHALL show four panels: Project Scan, Credentials, Documentation, and Migration
3. WHEN I interact with the Scan Panel THEN the system SHALL provide buttons for "Scan Project", "Re-Scan", "Refresh", and "View Summary" that show alert notifications
4. WHEN I interact with the Credentials Panel THEN the system SHALL provide buttons for "Add Credential", "Test Connection", "Export", and "Import" that show alert notifications
5. WHEN I interact with the Documentation Panel THEN the system SHALL provide buttons for "Add Spec", "Compare Specs", and "Generate Mapping" that show alert notifications
6. WHEN I interact with the Migration Panel THEN the system SHALL provide buttons for "Generate Preview", "Apply", and "Rollback" that show alert notifications
7. WHEN any button is clicked THEN the system SHALL log the event to console with format "[L1X] l1x_button_clicked:<name>"
8. WHEN the extension activates THEN the system SHALL complete startup in < 100ms and log "l1x_activate" event

### Requirement 2 - Phase 1: Scan Panel & Code Discovery

**User Story:** As a developer migrating from Converge APIs, I want to scan my codebase to identify all Converge integration points with file context menus, so that I can understand the scope of migration work and initiate conversions.

#### Acceptance Criteria

1. WHEN I click "Scan Project" THEN the system SHALL discover Converge API calls, DTOs, and service references across multiple file types (JS/TS, Java, C#, Python, PHP, Ruby, VB)
2. WHEN scanning occurs THEN the system SHALL provide real-time progress indicators showing percentage complete, files processed, and estimated time remaining with cancel capability
3. WHEN scan completes THEN the system SHALL display results grouped by Endpoint → File → Occurrence with code snippets and line numbers
4. WHEN I right-click on a file node THEN the system SHALL show context menu options: "Convert Converge → Elavon (Preview)", "Migrate to Elavon style", "Migrate to Elavon using GitHub Copilot", "Analyze & Document"
5. WHEN I select "Migrate to Elavon using GitHub Copilot" THEN the system SHALL show a consent modal listing the data to be sent externally
6. WHEN I select "Analyze & Document" THEN the system SHALL open the Documentation panel with relevant API mappings
7. WHEN I want to focus results THEN the system SHALL allow filtering by language, endpoint type, confidence level, and text search

### Requirement 3 - Phase 2: Credentials Panel & API Connectivity

**User Story:** As a developer working with Elavon L1 APIs, I want to securely manage my API credentials with connectivity testing, so that I can authenticate API calls without exposing sensitive information.

#### Acceptance Criteria

1. WHEN I add credentials THEN the system SHALL use VS Code's SecretStorage and never display secrets in plaintext
2. WHEN I configure credentials THEN the system SHALL support separate UAT and Production environments with Merchant ID, API Key, and API Secret (masked input)
3. WHEN I click "Test Connection" THEN the system SHALL obtain an auth token and ping the health endpoint, displaying connection status and latency within 3 seconds
4. WHEN credentials are invalid THEN the system SHALL show actionable error messages for 401/403 responses
5. WHEN I export credentials THEN the system SHALL create an encrypted bundle with user-provided passphrase using AES-256
6. WHEN credential operations occur THEN the system SHALL log audit entries with timestamp, user, environment, and result (without exposing secrets)
7. WHEN credentials are inactive THEN the system SHALL auto-lock the interface after 5 minutes (configurable)

### Requirement 4 - Phase 3: Documentation Panel & API Mapping

**User Story:** As a developer comparing API schemas, I want to view Converge and Elavon L1 OpenAPI specifications side-by-side with automated field mappings, so that I can understand data transformation requirements.

#### Acceptance Criteria

1. WHEN I click "Add Spec" THEN the system SHALL allow loading Converge and L1 OpenAPI specifications from file or URL
2. WHEN specifications are loaded THEN the system SHALL display split-view trees showing types, required flags, and examples with version information
3. WHEN I click "Generate Mapping" THEN the system SHALL auto-generate field mappings using similarity algorithms and type checking with confidence scores ≥ 0.7 average
4. WHEN auto-mapping is insufficient THEN the system SHALL allow manual field mapping overrides that persist across sessions
5. WHEN viewing mappings THEN the system SHALL display visual connectors between related fields with hover highlighting and synchronized scrolling
6. WHEN I export mappings THEN the system SHALL generate mapping.json files that can be consumed by the Migration panel
7. WHEN specifications exceed 5MB THEN the system SHALL render initial view in < 2 seconds

### Requirement 5 - Phase 4: Migration Panel & Code Generation

**User Story:** As a developer generating migration code, I want AI-assisted code transformation with Monaco diff editor and approval workflows, so that I can safely modernize my integrations with full visibility into changes.

#### Acceptance Criteria

1. WHEN I click "Generate Preview" THEN the system SHALL display a Monaco diff editor showing original vs generated code with AI transformation explanations
2. WHEN generating code THEN the system SHALL support multiple AI backends (GitHub Copilot, Local LLM, or template-based) as configured
3. WHEN using external AI services THEN the system SHALL show a consent modal listing exactly what data will be sent externally with redacted payload preview
4. WHEN I click "Apply" THEN the system SHALL apply modifications atomically with automatic restoration on failure and create a signed commit "L1X: migrate <file>"
5. WHEN I click "Rollback" THEN the system SHALL restore byte-identical original code from the migration audit trail
6. WHEN any migration is applied THEN the system SHALL create an audit record with timestamp, endpoint ID, file path, original code, migrated code, user, and rollback blob
7. WHEN I need to share changes THEN the system SHALL export migration patches in standard diff format

### Requirement 6 - Cross-Phase: Security & Performance

**User Story:** As a security-conscious developer, I want the extension to operate with strict security controls and efficient performance across all phases, so that sensitive data is protected and development productivity is maintained.

#### Acceptance Criteria

1. WHEN handling any network communication THEN the system SHALL use TLS ≥ 1.2 and never log secrets or sensitive data
2. WHEN operating in secure environments THEN the system SHALL support offline mode configuration that disables all external network calls
3. WHEN using AI services THEN the system SHALL redact sensitive information from payloads sent to external services
4. WHEN processing large codebases THEN the system SHALL handle ≥10,000 scan results using virtualized trees with input lag < 100ms
5. WHEN rendering diffs THEN the system SHALL display comparisons in < 500ms for files up to 2,000 lines
6. WHEN any operation fails THEN the system SHALL implement retries with exponential backoff and graceful offline fallback
7. WHEN telemetry is enabled THEN the system SHALL provide opt-in usage analytics while sanitizing all sensitive data