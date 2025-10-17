# Requirements Document

## Introduction

The Enhanced Scan Context Menu feature extends the existing L1X ElavonX Migrator extension with advanced file analysis and migration capabilities. When users right-click on scanned files in the Scan Panel, they will have access to 5 new context menu options that provide intelligent file standard detection, automated migration workflows, GitHub Copilot integration, OpenAPI spec comparison, and compliance validation. This feature builds upon the existing scan functionality to provide a comprehensive migration toolkit directly accessible from scan results.

## Requirements

### Requirement 1 - Auto File Standard Detection

**User Story:** As a developer reviewing scan results, I want the system to automatically detect whether a file follows Converge or Elavon standards, so that I can quickly understand the current state of each file without manual analysis.

#### Acceptance Criteria

1. WHEN I right-click on a scanned file THEN the system SHALL show "Detect File Standard (Auto-Check)" as the first context menu option with a ✅ icon
2. WHEN I select "Detect File Standard" THEN the system SHALL parse the file content and compare against known OpenAPI specs within 2 seconds
3. WHEN detection completes THEN the system SHALL display a notification showing "File detected as: [Converge/Elavon/Unknown] standard" with confidence percentage
4. WHEN the file contains mixed standards THEN the system SHALL show "Mixed standards detected: X% Converge, Y% Elavon" with detailed breakdown
5. WHEN detection fails THEN the system SHALL show "Unable to determine standard" with suggested manual review actions
6. WHEN detection succeeds THEN the system SHALL cache the result and update the file's display in the scan tree with a standard indicator badge
7. WHEN the file is modified THEN the system SHALL invalidate the cached detection result and show "Detection outdated" indicator

### Requirement 2 - Migrate to Elavon Workflow

**User Story:** As a developer working with Converge files, I want a streamlined migration option that transforms my file to Elavon L1 standard using GitHub Copilot, so that I can modernize my code with AI assistance and full transparency.

#### Acceptance Criteria

1. WHEN I right-click on a file detected as Converge format THEN the system SHALL show "Migrate to Elavon" option with 🔄 icon
2. WHEN the file is not Converge format THEN the system SHALL hide the "Migrate to Elavon" option from the context menu
3. WHEN I select "Migrate to Elavon" THEN the system SHALL identify the file's language, framework, and context automatically
4. WHEN migration starts THEN the system SHALL load both Converge and Elavon OpenAPI JSON specs from the configured spec locations
5. WHEN specs are loaded THEN the system SHALL send a structured prompt to GitHub Copilot including file content, source spec, target spec, and transformation instructions
6. WHEN Copilot responds THEN the system SHALL replace or generate the new file in Elavon format with a backup of the original
7. WHEN migration completes THEN the system SHALL show a diff view comparing original vs migrated code with option to accept or reject changes
8. WHEN migration fails THEN the system SHALL restore the original file and show detailed error information with suggested manual steps

### Requirement 3 - Ask GitHub Copilot for Migration

**User Story:** As a developer who wants more control over the migration process, I want to send a custom prompt to GitHub Copilot with full context about my file and migration requirements, so that I can get tailored migration assistance.

#### Acceptance Criteria

1. WHEN I right-click on any scanned file THEN the system SHALL show "Ask GitHub Copilot" option with 💬 icon
2. WHEN I select "Ask GitHub Copilot" THEN the system SHALL open a dialog with a pre-populated prompt template including file content and context
3. WHEN the dialog opens THEN the system SHALL include current file content, detected standard information, and relevant OpenAPI spec excerpts
4. WHEN I customize the prompt THEN the system SHALL allow editing the template while preserving essential context information
5. WHEN I submit the prompt THEN the system SHALL send the request to GitHub Copilot with full file context and migration instructions
6. WHEN Copilot responds THEN the system SHALL display the response in a dedicated panel with options to apply suggestions or ask follow-up questions
7. WHEN I choose to apply suggestions THEN the system SHALL integrate the changes using the same diff review workflow as the automated migration
8. WHEN the session is active THEN the system SHALL maintain conversation context for follow-up questions about the same file

### Requirement 4 - View/Compare OpenAPI Specs

**User Story:** As a developer understanding migration requirements, I want to view side-by-side differences between Converge and Elavon OpenAPI schemas, so that I can understand the transformation requirements and verify migration accuracy.

#### Acceptance Criteria

1. WHEN I right-click on any scanned file THEN the system SHALL show "Compare Converge and Elavon Specs" option with 📂 icon
2. WHEN I select "Compare Specs" THEN the system SHALL open a split-view panel showing both OpenAPI specifications side by side
3. WHEN the specs load THEN the system SHALL highlight relevant sections based on the endpoints detected in the selected file
4. WHEN viewing specs THEN the system SHALL provide synchronized scrolling and hover highlighting between related sections
5. WHEN I navigate the specs THEN the system SHALL show field mappings and transformation rules relevant to the selected file's endpoints
6. WHEN differences exist THEN the system SHALL visually indicate added, removed, and modified fields with color coding and annotations
7. WHEN I want to focus on specific endpoints THEN the system SHALL provide filtering to show only sections relevant to the scanned file's API calls
8. WHEN specs are large THEN the system SHALL implement virtual scrolling and lazy loading to maintain performance under 2 seconds initial load

### Requirement 5 - Validate Elavon Standard Compliance

**User Story:** As a developer who has completed migration, I want to validate that my file complies with Elavon L1 standards, so that I can ensure the migration was successful and the code meets all requirements.

#### Acceptance Criteria

1. WHEN I right-click on any scanned file THEN the system SHALL show "Validate Elavon Compliance" option with 🧪 icon
2. WHEN I select "Validate Elavon Compliance" THEN the system SHALL perform comprehensive validation against the Elavon OpenAPI JSON spec within 5 seconds
3. WHEN validation runs THEN the system SHALL check schema compliance, semantic correctness, and required field presence
4. WHEN validation completes successfully THEN the system SHALL show "✅ File is Elavon L1 compliant" with detailed compliance report
5. WHEN validation finds issues THEN the system SHALL show "❌ Compliance issues found" with specific line numbers, error descriptions, and suggested fixes
6. WHEN linting is available THEN the system SHALL run language-specific linting rules for Elavon patterns and best practices
7. WHEN semantic checks are possible THEN the system SHALL validate API endpoint usage, parameter formats, and response handling patterns
8. WHEN validation includes warnings THEN the system SHALL categorize issues as "Errors" (must fix) and "Warnings" (should fix) with priority indicators

### Requirement 6 - Context Menu Integration and User Experience

**User Story:** As a developer using the scan panel, I want the context menu to be intuitive, performant, and contextually aware, so that I can efficiently access the right tools for each file's current state.

#### Acceptance Criteria

1. WHEN I right-click on a scanned file THEN the system SHALL show the context menu within 100ms with all 5 options visible
2. WHEN a file has been analyzed THEN the system SHALL show cached results and status indicators next to relevant menu options
3. WHEN an operation is in progress THEN the system SHALL disable the relevant menu option and show a progress indicator
4. WHEN multiple files are selected THEN the system SHALL show batch operation options where applicable (e.g., "Validate All Selected Files")
5. WHEN the workspace lacks required configurations THEN the system SHALL show setup guidance instead of non-functional options
6. WHEN GitHub Copilot is unavailable THEN the system SHALL disable Copilot-related options and show alternative suggestions
7. WHEN OpenAPI specs are not configured THEN the system SHALL prompt for spec file locations before proceeding with spec-dependent operations
8. WHEN operations complete THEN the system SHALL update the scan tree display with result indicators and refresh the file's status badges