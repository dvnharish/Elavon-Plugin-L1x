/**
 * Enhanced Context Menu Types for Scan Panel
 * Supports 5 context menu options: Detect Standard, Migrate, Ask Copilot, Compare Specs, Validate
 */

// File Standard Detection Types
export interface IFileStandardAnalyzer {
  detectStandard(filePath: string): Promise<StandardDetectionResult>
  getCachedResult(filePath: string): StandardDetectionResult | null
  invalidateCache(filePath: string): void
  batchDetect(filePaths: string[]): Promise<Map<string, StandardDetectionResult>>
}

export interface StandardDetectionResult {
  filePath: string
  standard: 'converge' | 'elavon' | 'mixed' | 'unknown'
  confidence: number
  details: StandardDetails
  timestamp: Date
  cacheValid: boolean
}

export interface StandardDetails {
  convergePercentage: number
  elavonPercentage: number
  detectedEndpoints: DetectedEndpoint[]
  mixedIndicators?: MixedStandardIndicator[]
  analysisMethod: 'regex' | 'ast' | 'hybrid'
}

export interface DetectedEndpoint {
  name: string
  standard: 'converge' | 'elavon'
  confidence: number
  lineNumber: number
  snippet: string
}

export interface MixedStandardIndicator {
  type: 'endpoint' | 'pattern' | 'import'
  convergeCount: number
  elavonCount: number
  description: string
}

// Migration Workflow Types
export interface IMigrationWorkflow {
  migrateFile(request: MigrationRequest): Promise<MigrationResult>
  previewMigration(filePath: string): Promise<MigrationPreview>
  applyMigration(migrationId: string, approved: boolean): Promise<ApplyResult>
  rollbackMigration(migrationId: string): Promise<RollbackResult>
  getMigrationHistory(filePath: string): Promise<MigrationHistoryEntry[]>
}

export interface MigrationRequest {
  filePath: string
  sourceStandard: 'converge' | 'elavon'
  targetStandard: 'converge' | 'elavon'
  language: string
  framework?: string
  preserveComments: boolean
  backupOriginal: boolean
}

export interface MigrationResult {
  migrationId: string
  success: boolean
  originalContent: string
  migratedContent: string
  backupPath: string
  aiExplanation: string
  confidence: number
  warnings: string[]
  appliedAt?: Date
}

export interface MigrationPreview {
  migrationId: string
  diff: DiffResult
  explanation: string
  estimatedChanges: number
  riskAssessment: 'low' | 'medium' | 'high'
  requiredManualReview: string[]
}

export interface ApplyResult {
  success: boolean
  appliedAt: Date
  backupPath: string
  error?: string
}

export interface RollbackResult {
  success: boolean
  rolledBackAt: Date
  restoredFromBackup: string
  error?: string
}

export interface MigrationHistoryEntry {
  id: string
  filePath: string
  timestamp: Date
  operation: 'migrate' | 'rollback' | 'preview'
  sourceStandard: string
  targetStandard: string
  success: boolean
  backupPath?: string
  aiProvider: string
  confidence: number
  userApproved: boolean
  rollbackAvailable: boolean
}

export interface DiffResult {
  original: string
  modified: string
  changes: DiffChange[]
}

export interface DiffChange {
  type: 'add' | 'remove' | 'modify'
  lineNumber: number
  content: string
  explanation?: string
}

// Copilot Integration Types
export interface ICopilotIntegration {
  createMigrationPrompt(context: FileContext): Promise<CopilotPrompt>
  sendCustomPrompt(prompt: CopilotPrompt): Promise<CopilotResponse>
  continueConversation(conversationId: string, followUp: string): Promise<CopilotResponse>
  getConversationHistory(filePath: string): Promise<CopilotConversation[]>
  isAvailable(): Promise<boolean>
}

export interface FileContext {
  filePath: string
  content: string
  detectedStandard: StandardDetectionResult
  relevantSpecs: OpenApiSpecSection[]
  language: string
  framework?: string
}

export interface CopilotPrompt {
  id: string
  template: string
  context: FileContext
  customInstructions?: string
  includeSpecs: boolean
  conversationId?: string
}

export interface CopilotResponse {
  id: string
  content: string
  suggestions: CodeSuggestion[]
  explanation: string
  confidence: number
  followUpQuestions: string[]
  conversationId: string
}

export interface CodeSuggestion {
  description: string
  code: string
  startLine: number
  endLine: number
  type: 'replacement' | 'insertion' | 'deletion'
}

export interface CopilotConversation {
  id: string
  filePath: string
  startedAt: Date
  lastActivity: Date
  messages: CopilotMessage[]
  context: FileContext
  status: 'active' | 'completed' | 'abandoned'
}

export interface CopilotMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: CodeSuggestion[]
}

// Spec Comparison Types
export interface ISpecComparisonViewer {
  openComparison(filePath: string): Promise<ComparisonView>
  highlightRelevantSections(endpoints: DetectedEndpoint[]): void
  showFieldMappings(sourceField: string, targetField: string): void
  exportComparison(format: 'json' | 'markdown' | 'html'): Promise<string>
  getRelevantSections(filePath: string): Promise<SpecSection[]>
}

export interface ComparisonView {
  id: string
  convergeSpec: OpenApiSpec
  elavonSpec: OpenApiSpec
  relevantSections: SpecSection[]
  fieldMappings: FieldMapping[]
  differences: SpecDifference[]
}

export interface OpenApiSpec {
  version: string
  info: any
  paths: any
  components: any
  servers: any[]
}

export interface OpenApiSpecSection {
  path: string
  title: string
  content: any
  relevanceScore: number
  relatedEndpoints: string[]
}

export interface SpecSection {
  path: string
  title: string
  content: any
  relevanceScore: number
  relatedEndpoints: string[]
}

export interface SpecDifference {
  type: 'added' | 'removed' | 'modified'
  path: string
  oldValue?: any
  newValue?: any
  description: string
  impact: 'breaking' | 'non-breaking' | 'enhancement'
}

export interface FieldMapping {
  sourcePath: string
  targetPath: string
  sourceType: string
  targetType: string
  confidence: number
  rule?: string
  isManualOverride: boolean
}

// Validation Engine Types
export interface IValidationEngine {
  validateFile(filePath: string): Promise<ValidationResult>
  validateBatch(filePaths: string[]): Promise<Map<string, ValidationResult>>
  getValidationRules(): Promise<ValidationRule[]>
  suggestFixes(violations: ValidationViolation[]): Promise<FixSuggestion[]>
  runLinting(filePath: string, language: string): Promise<LintResult>
}

export interface ValidationResult {
  filePath: string
  isCompliant: boolean
  overallScore: number
  violations: ValidationViolation[]
  warnings: ValidationWarning[]
  lintResults?: LintResult
  validatedAt: Date
  validationDuration: number
}

export interface ValidationViolation {
  id: string
  rule: string
  severity: 'error' | 'warning' | 'info'
  message: string
  lineNumber: number
  columnNumber: number
  snippet: string
  suggestedFix?: string
  category: 'schema' | 'semantic' | 'style' | 'security'
}

export interface ValidationWarning {
  id: string
  rule: string
  message: string
  lineNumber: number
  category: string
}

export interface ValidationRule {
  id: string
  name: string
  description: string
  category: string
  severity: 'error' | 'warning' | 'info'
  pattern?: string
  schemaPath?: string
  customValidator?: string
}

export interface FixSuggestion {
  violationId: string
  description: string
  autoFixAvailable: boolean
  fixCode?: string
  manualSteps?: string[]
  confidence: number
}

export interface LintResult {
  filePath: string
  issues: LintIssue[]
  fixableIssues: number
  totalIssues: number
}

export interface LintIssue {
  line: number
  column: number
  severity: 'error' | 'warning' | 'info'
  message: string
  rule: string
  fixable: boolean
}

// Context Menu State Management
export interface EnhancedScanResult {
  id: string
  filePath: string
  line: number
  snippet: string
  matchedText: string
  confidence: number
  endpointType: string
  language: string
  standardDetection?: StandardDetectionResult
  migrationHistory: MigrationHistoryEntry[]
  validationStatus?: ValidationResult
  contextMenuState: ContextMenuState
}

export interface ContextMenuState {
  operationsInProgress: Set<string>
  cachedResults: Map<string, any>
  lastUpdated: Date
  availableOperations: ContextMenuOperation[]
}

export interface ContextMenuOperation {
  id: string
  label: string
  icon: string
  enabled: boolean
  visible: boolean
  requiresSetup?: string[]
  tooltip?: string
}

// Error Handling Types
export interface ContextMenuError extends Error {
  operation: string
  filePath: string
  category: 'detection' | 'migration' | 'validation' | 'ui'
  recoverable: boolean
  userAction?: string
}

export interface ErrorRecoveryStrategy {
  canRecover(error: ContextMenuError): boolean
  recover(error: ContextMenuError, context: OperationContext): Promise<RecoveryResult>
  getFallbackAction(operation: string): AlternativeAction[]
}

export interface OperationContext {
  filePath: string
  operation: string
  parameters: any
  retryCount: number
}

export interface RecoveryResult {
  success: boolean
  message: string
  data?: any
}

export interface AlternativeAction {
  id: string
  label: string
  description: string
  action: () => Promise<void>
}

// Cache Management Types
export interface ValidationCache {
  filePath: string
  fileHash: string
  result: ValidationResult
  cachedAt: Date
  expiresAt: Date
}

export interface FileStandardCache {
  filePath: string
  fileHash: string
  result: StandardDetectionResult
  cachedAt: Date
  expiresAt: Date
}