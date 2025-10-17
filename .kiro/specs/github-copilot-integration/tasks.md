# Implementation Plan

- [ ] 1. Set up core infrastructure and service foundation
  - Create new service interfaces and base implementations
  - Register services in DI container following existing patterns
  - Add configuration settings to package.json for OpenAPI spec paths
  - _Requirements: 1.1, 1.2, 10.1, 10.2_

- [ ] 1.1 Create CopilotService with GitHub Copilot availability checking
  - Implement ICopilotService interface with checkAvailability method
  - Add logic to detect github.copilot-chat extension installation and activation
  - Create error handling for when Copilot is not available
  - _Requirements: 1.2, 1.3, 8.1_

- [ ] 1.2 Implement RedactionService for sensitive data protection
  - Create RedactionService class with pattern-based sensitive data detection
  - Implement redaction for API keys, tokens, merchant IDs, and credentials
  - Add redaction reporting functionality to track what was redacted
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 1.3 Create OpenApiService for specification management
  - Implement OpenAPI spec loading from existing openapi/ directory files
  - Add caching mechanism for loaded specifications
  - Create method to extract relevant spec sections based on detected endpoints
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2. Build file context analysis and prompt generation
  - Create comprehensive file context building functionality
  - Implement intelligent prompt generation for migration requests
  - Integrate with existing FileStandardAnalyzer for detected patterns
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2_

- [ ] 2.1 Implement FileContextBuilder service
  - Create FileContextBuilder class that reads file content and metadata
  - Integrate with existing FileStandardAnalyzer to include detected standard results
  - Add file size limits and content truncation for large files
  - Implement language detection based on file extension
  - _Requirements: 2.1, 2.5, 2.6_

- [ ] 2.2 Create PromptBuilder for structured migration prompts
  - Implement template-based prompt generation using migration-specific template
  - Add context variable substitution for file information and detected patterns
  - Include relevant OpenAPI spec sections in prompts when available
  - Create clear migration instructions for Converge to Elavon L1 conversion
  - _Requirements: 5.1, 5.3, 5.4, 5.6_

- [ ] 2.3 Integrate context building with existing scan results
  - Modify FileContextBuilder to leverage existing ScanTreeItem data
  - Use cached standard detection results when available from FileStandardAnalyzer
  - Add fallback logic when standard detection is not available
  - _Requirements: 2.2, 10.5_

- [ ] 3. Implement user consent and data sharing workflow
  - Create user consent dialog for data sharing approval
  - Implement data preview functionality showing what will be shared
  - Add session-based consent management
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [ ] 3.1 Create ConsentDialog for user approval workflow
  - Implement modal dialog showing file path, redaction summary, and spec sections
  - Add clear explanation of what data will be shared with GitHub Copilot
  - Create approve/decline options with proper user feedback
  - _Requirements: 3.1, 3.2_

- [ ] 3.2 Add consent payload building and preview functionality
  - Create ConsentPayload interface and building logic
  - Implement redacted content preview for user review
  - Add summary of OpenAPI spec sections that will be included
  - _Requirements: 3.5, 4.4_

- [ ] 4. Integrate GitHub Copilot Chat API and response handling
  - Implement direct integration with github.copilot.chat.ask command
  - Add response parsing and error handling
  - Create optional diff viewer for code suggestions
  - _Requirements: 1.4, 1.5, 6.1, 6.2_

- [ ] 4.1 Complete CopilotService with chat integration
  - Implement sendMigrationRequest method using vscode.commands.executeCommand
  - Add proper error handling for API timeouts and failures
  - Create response parsing logic for Copilot chat responses
  - _Requirements: 1.4, 1.5, 8.3_

- [ ] 4.2 Add diff viewer integration for code suggestions
  - Implement logic to detect code suggestions in Copilot responses
  - Create diff viewer using VS Code's built-in diff functionality
  - Add user options to view side-by-side comparison of original vs suggested code
  - _Requirements: 6.3, 6.4_

- [ ] 5. Replace placeholder implementation in ScanPanel
  - Update askGitHubCopilot method to use new services
  - Implement complete workflow from context menu to Copilot response
  - Add progress indicators and user feedback
  - _Requirements: 1.1, 9.1, 9.4_

- [ ] 5.1 Update ScanPanel.askGitHubCopilot method implementation
  - Replace placeholder message with full Copilot integration workflow
  - Add service dependency injection using existing DI container
  - Implement error handling following existing extension patterns
  - Add progress notifications for long-running operations
  - _Requirements: 1.1, 9.2, 9.6_

- [ ] 5.2 Add telemetry and logging for Copilot interactions
  - Implement telemetry events for consent, requests, and responses
  - Use existing Logger utility for consistent logging patterns
  - Add error tracking and performance metrics
  - _Requirements: 6.6, 10.3_

- [ ] 6. Register services and update extension configuration
  - Add new services to DI container registration
  - Update package.json with configuration settings
  - Ensure proper service lifecycle management
  - _Requirements: 10.1, 10.2, 10.6_

- [ ] 6.1 Register new services in DI container
  - Add service tokens for CopilotService, FileContextBuilder, RedactionService, etc.
  - Register service factories in extension.ts following existing patterns
  - Ensure proper dependency injection for service dependencies
  - _Requirements: 10.2, 10.3_

- [ ] 6.2 Add configuration settings to package.json
  - Add settings for convergeSpecPath and elavonSpecPath with defaults
  - Include offlineMode and enableTelemetry configuration options
  - Add redactSecrets and timeout configuration settings
  - _Requirements: 10.1, 10.6_

- [ ] 7. Add comprehensive error handling and recovery
  - Implement error categories and appropriate user messages
  - Add retry logic for recoverable errors
  - Create fallback behavior when services are unavailable
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 7.1 Create CopilotErrorHandler for centralized error management
  - Implement error categorization and appropriate user messages
  - Add specific handling for Copilot unavailable, file access, and API errors
  - Create retry logic with exponential backoff for network errors
  - _Requirements: 8.1, 8.3, 8.6_

- [ ] 7.2 Add graceful degradation when dependencies are unavailable
  - Implement fallback behavior when GitHub Copilot extension is not installed
  - Add partial functionality when OpenAPI specs are not available
  - Create informative error messages with actionable guidance
  - _Requirements: 8.2, 7.4, 7.5_

- [ ]* 8. Write comprehensive unit tests for new services
  - Create unit tests for CopilotService, FileContextBuilder, RedactionService
  - Add mock implementations for GitHub Copilot extension
  - Test error scenarios and edge cases
  - _Requirements: All requirements validation_

- [ ]* 8.1 Write unit tests for CopilotService
  - Test availability checking with mocked extension states
  - Mock GitHub Copilot API responses and test response handling
  - Test error scenarios including timeouts and API failures
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ]* 8.2 Write unit tests for RedactionService
  - Test pattern matching accuracy for various sensitive data types
  - Validate redaction replacement logic and reporting
  - Test edge cases and false positive scenarios
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 8.3 Write unit tests for FileContextBuilder and PromptBuilder
  - Test file content reading and context building logic
  - Validate template rendering and variable substitution
  - Test integration with FileStandardAnalyzer results
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2_

- [ ]* 8.4 Create integration tests for complete workflow
  - Test end-to-end flow from context menu to Copilot response
  - Mock user consent interactions and validate workflow
  - Test error recovery and fallback scenarios
  - _Requirements: 9.1, 9.4, 9.5_