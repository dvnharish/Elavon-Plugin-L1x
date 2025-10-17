# Implementation Plan

- [x] 1. Phase 0: Project Setup & Infrastructure



  - Create VS Code extension project structure with TypeScript configuration
  - Set up build system with webpack bundling and ESLint linting
  - Configure package.json with extension manifest, dependencies, and build scripts
  - _Requirements: Phase 0 setup requirements_



- [ ] 1.1 Initialize project scaffolding
  - Create package.json with extension metadata, activation events, and contribution points
  - Set up tsconfig.json with strict TypeScript configuration
  - Configure webpack.config.js for extension bundling
  - Add ESLint configuration for code quality


  - _Requirements: Phase 0 setup requirements_

- [ ] 1.2 Create basic folder structure
  - Create src/ directory with extension.ts entry point
  - Set up media/ directory and copy the provided L1X icon (image.png) as icon.png


  - Create webview/ directory for panel HTML files
  - Initialize basic README with installation instructions
  - _Requirements: Phase 0 setup requirements_



- [ ] 1.3 Set up development and build scripts
  - Add npm scripts for compile, package, lint, and watch modes
  - Configure vsce packaging for extension distribution



  - Set up development workflow documentation
  - _Requirements: Phase 0 setup requirements_

- [ ] 1.4 Set up testing infrastructure
  - Configure Jest testing framework with TypeScript support


  - Add test scripts and coverage reporting
  - Create test utilities and mock helpers
  - Set up VS Code extension testing environment
  - _Requirements: Phase 0 setup requirements_



- [ ] 2. Phase 1: Extension Skeleton + Interactive UI
  - Implement working VS Code extension with L1X activity bar and four panels
  - Create interactive buttons in each panel that show alert notifications
  - Set up basic dependency injection container and logging infrastructure


  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.1 Implement extension activation and lifecycle
  - Create extension.ts with activation events and lifecycle management
  - Implement DI container initialization and service registration


  - Set up telemetry logging with l1x_activate event
  - Configure extension context and global state management
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2.2 Create activity bar container and panel structure


  - Configure package.json contribution points for L1X activity bar container
  - Define four panel views: scanPanel, credentialsPanel, docsPanel, migrationPanel
  - Set up panel activation events and command contributions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_



- [ ] 2.3 Implement Scan Panel with TreeDataProvider
  - Create ScanPanel.ts as TreeDataProvider with hierarchical structure
  - Add four clickable commands: Scan Project, Re-Scan, Refresh, View Summary
  - Implement tree node rendering with mock scan results
  - Set up command handlers that show information message alerts


  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.4 Create Credentials Panel WebView
  - Implement CredentialsPanel.ts with WebView provider
  - Create credentials.html with tabbed interface (UAT/Production)


  - Add four buttons: Add Credential, Test Connection, Export, Import
  - Set up WebView message handling for button clicks with alerts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_



- [ ] 2.5 Create Documentation Panel WebView
  - Implement DocsPanel.ts with split-pane WebView layout
  - Create docs.html with dual specification viewer placeholder
  - Add three buttons: Add Spec, Compare Specs, Generate Mapping
  - Implement WebView communication for button interactions with alerts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.6 Create Migration Panel WebView
  - Implement MigrationPanel.ts with Monaco editor placeholder



  - Create migration.html with diff editor layout and action buttons
  - Add three buttons: Generate Preview, Apply, Rollback
  - Set up WebView messaging for button clicks showing alert notifications
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.7 Implement command registry and DI container
  - Create commands/index.ts with all button command handlers
  - Implement di/container.ts with basic service registration and resolution
  - Create utils/logger.ts with console logging and [L1X] prefix format
  - Register all commands and set up panel-to-command bindings
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.8 Add basic styling and accessibility
  - Style WebView panels with VS Code theme integration
  - Add ARIA labels and keyboard navigation support
  - Implement responsive layouts for different panel sizes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2.9 Create unit tests for Phase 1 components
  - Write unit tests for DI container service registration and resolution
  - Test command registry and button click handlers
  - Create mock tests for panel providers and WebView communication
  - Add tests for logger utility and telemetry events
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 3. Phase 2: Scan Panel + Code Discovery
  - Implement functional code scanning with regex and AST parsing
  - Add progress tracking, cancellation, and file context menus
  - Create scan result management with persistence and filtering
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.1 Implement Code Scanner Service
  - Create CodeScannerService.ts with regex and AST parsing capabilities
  - Add support for multiple languages (JS/TS, Java, C#, Python, PHP, Ruby, VB)
  - Implement Business-logic mode (regex + AST) and Quick mode (regex only)
  - Set up progress tracking with ScanProgress interface and cancellation tokens
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.2 Add file system integration and exclusion patterns
  - Implement file discovery with configurable include/exclude patterns
  - Add ignore list management for false positives
  - Create file modification tracking for incremental scanning
  - Set up workspace-relative path handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.3 Enhance Scan Panel with real functionality
  - Replace mock data with actual CodeScannerService integration
  - Implement hierarchical tree display: Endpoint → File → Occurrence


  - Add real-time progress indicators with cancel capability
  - Create filtering system (language, endpoint type, confidence, text search)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3.4 Implement file context menu integration


  - Add context menu contributions for file nodes in scan results
  - Create four context actions: Convert Preview, Migrate Style, Migrate Copilot, Analyze Document
  - Implement deep-linking to Migration and Documentation panels
  - Set up consent modal placeholder for Copilot integration
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_


- [ ] 3.5 Add scan result persistence and caching
  - Implement scan result serialization to workspace .l1x/scan-cache.json
  - Create cache invalidation based on file modification times
  - Add result restoration on extension activation
  - Set up workspace cleanup on extension deactivation

  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.6 Implement virtualized rendering for large result sets
  - Add virtual scrolling for tree views with 10k+ results
  - Optimize rendering performance with lazy loading
  - Implement debounced search and filtering

  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.7 Create unit tests for Phase 2 components
  - Write unit tests for CodeScannerService with mock file system
  - Test regex and AST parsing logic with sample code files
  - Create tests for scan result persistence and caching

  - Add tests for file context menu integration and filtering
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 4. Phase 3: Credentials Panel + API Authentication
  - Implement secure credential management with VS Code SecretStorage
  - Add API connectivity testing with Elavon L1 health checks

  - Create encrypted export/import functionality with auto-lock mechanism
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.1 Implement Credential Manager Service
  - Create CredentialManager.ts with SecretStorage integration


  - Add support for UAT and Production environment separation
  - Implement secure credential storage without exposing secrets in global state
  - Set up credential validation and sanitization
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_


- [ ] 4.2 Add API connectivity testing
  - Implement Elavon L1 authentication flow with token fetch
  - Create health endpoint connectivity testing with latency measurement
  - Add connection result handling with success/failure states


  - Set up retry logic with exponential backoff for transient failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.3 Enhance Credentials Panel with real functionality
  - Replace placeholder buttons with actual credential management


  - Implement tabbed interface for UAT/Production environments
  - Add masked input fields for API Key and Secret with validation
  - Create real-time connection status display with latency indicators
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.4 Implement encrypted export/import functionality
  - Add AES-256 encryption for credential export with user passphrase
  - Create secure import functionality with decryption and validation
  - Implement file dialog integration for export/import operations
  - Set up error handling for encryption/decryption failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.5 Add auto-lock mechanism and security features
  - Implement configurable auto-lock timeout with countdown display
  - Create credential redaction for all logging and telemetry
  - Add secure cleanup on extension deactivation
  - Set up audit logging for credential operations (without exposing secrets)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.6 Add comprehensive error handling for API operations
  - Implement specific error handling for 401/403 authentication failures
  - Create actionable error messages for network connectivity issues
  - Add timeout handling with user-friendly feedback
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.7 Create unit tests for Phase 3 components
  - Write unit tests for CredentialManager with mock SecretStorage
  - Test API connectivity and authentication flows with mock responses
  - Create tests for encryption/decryption functionality
  - Add tests for auto-lock mechanism and security features
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Phase 4: Documentation Panel + OpenAPI Mapping
  - Implement OpenAPI specification parsing and dual-pane viewer
  - Create automated field mapping engine with confidence scoring
  - Add manual override system with visual connectors and export functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.1 Implement OpenAPI Cache Service
  - Create OpenApiCache.ts with specification loading from file/URL
  - Add OpenAPI 3.0+ parsing and validation capabilities
  - Implement caching with version tracking and update detection
  - Set up support for both Converge and Elavon L1 specifications
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.2 Create Mapping Engine Service
  - Implement MappingEngine.ts with automated field mapping algorithms
  - Add similarity-based matching using Levenshtein distance and semantic analysis
  - Create confidence scoring system based on name similarity and type matching
  - Set up manual override system with workspace persistence
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.3 Enhance Documentation Panel with OpenAPI viewer
  - Replace placeholder content with actual OpenAPI specification rendering
  - Implement split-pane layout with synchronized scrolling
  - Add interactive tree views showing types, required flags, and examples
  - Create specification loading interface with file/URL input
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.4 Implement visual field mapping interface
  - Add visual connectors between related fields in dual specifications
  - Create hover highlighting and click-to-focus functionality
  - Implement manual mapping override editor with validation
  - Set up confidence score display and manual adjustment capabilities
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.5 Add mapping export and search functionality
  - Implement mapping export to JSON and Markdown formats
  - Create search and filter capabilities within specifications
  - Add mapping configuration persistence in workspace settings
  - Set up mapping validation and error reporting
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.6 Optimize performance for large specifications
  - Implement virtual scrolling for specifications exceeding 5MB
  - Add lazy loading of specification sections
  - Create debounced search with result highlighting
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.7 Create unit tests for Phase 4 components
  - Write unit tests for OpenApiCache with mock specification loading
  - Test MappingEngine algorithms with sample API specifications
  - Create tests for field mapping confidence scoring and overrides
  - Add tests for specification parsing and validation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Phase 5: Migration Panel + AI Code Generation
  - Implement AI integration layer with multiple backend support
  - Create Monaco diff editor integration with code generation workflows
  - Add migration audit trail, rollback capabilities, and review system
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.1 Implement AI Integration Layer
  - Create AIAdapter.ts abstract interface for multiple AI backends
  - Add consent management system with payload preview and redaction
  - Implement backend selection logic based on configuration
  - Set up offline mode enforcement and external service communication logging
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.2 Create AI backend adapters
  - Implement CopilotAdapter.ts for GitHub Copilot API integration
  - Create LocalLLMAdapter.ts for local LLM server connections
  - Add TemplateAdapter.ts for rule-based fallback code generation
  - Set up adapter availability detection and graceful fallbacks
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.3 Implement Apply/Patch Service
  - Create ApplyService.ts with atomic code application capabilities
  - Add Git integration for signed commits with "L1X: migrate <file>" format
  - Implement rollback functionality with byte-identical restoration
  - Set up patch generation and export in standard diff format
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.4 Enhance Migration Panel with Monaco editor
  - Replace placeholder with actual Monaco diff editor integration
  - Implement code generation workflow with original vs generated comparison
  - Add AI explanation panel showing transformation details and reasoning
  - Create backend selection interface (Copilot/Local/Template)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.5 Implement consent and review workflow
  - Create consent modal with external service data transmission preview
  - Add review workflow with approve/reject/comment capabilities
  - Implement action buttons: Generate Preview, Apply, Rollback, Export Patch
  - Set up review state tracking and comment persistence
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.6 Add migration audit trail and rollback system
  - Create AuditService.ts with complete migration history tracking
  - Implement rollback blob storage for exact code restoration
  - Add audit log export functionality with sanitized data
  - Set up migration audit record creation for all applied changes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.7 Implement comprehensive error handling and recovery
  - Add error handling for AI service failures with fallback options
  - Create recovery mechanisms for patch application conflicts
  - Implement validation for generated code before application
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.8 Create unit tests for Phase 5 components
  - Write unit tests for AI adapter interfaces with mock backends
  - Test ApplyService with mock Git operations and rollback functionality
  - Create tests for consent management and payload redaction
  - Add tests for migration audit trail and review workflows
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Cross-Phase Integration and Polish
  - Implement deep-linking between panels and comprehensive error handling
  - Add final performance optimizations and security hardening
  - Create comprehensive testing and documentation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.1 Implement cross-panel integration
  - Set up deep-linking from Scan Panel context menus to Migration Panel
  - Create credential sharing from Credentials Panel to Migration Panel for API testing
  - Implement mapping data flow from Documentation Panel to Migration Panel
  - Add unified telemetry and audit logging across all panels
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.2 Add comprehensive error handling and recovery
  - Implement global error boundary with user-friendly error reporting
  - Create recovery strategies for network failures, file conflicts, and service unavailability
  - Add graceful degradation for offline scenarios
  - Set up error telemetry with sanitized data collection
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.3 Performance optimization and security hardening
  - Optimize memory usage and resource cleanup across all services
  - Implement security audit for credential handling and external communications
  - Add performance monitoring and optimization for large codebase scenarios
  - Create final security review and penetration testing
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.4 Create integration and end-to-end tests
  - Create integration tests for panel communication and workflows
  - Implement end-to-end tests for complete migration scenarios
  - Add performance tests for large codebase scanning
  - Test cross-panel integration and deep-linking functionality
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.5 Finalize documentation and deployment
  - Create comprehensive README with installation and usage instructions
  - Add developer documentation for extension architecture and APIs
  - Set up CI/CD pipeline for automated testing and packaging
  - Create user guide and troubleshooting documentation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_