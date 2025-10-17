// Core data models for the L1X ElavonX Migrator extension

export interface ScanResult {
  id: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  matchedText: string;
  confidence: number;
  endpointType: 'transaction' | 'payment' | 'refund' | 'auth' | 'unknown';
  language: string;
  framework?: string;
  createdAt: Date;
}

export interface ScanOptions {
  mode: 'business-logic' | 'quick';
  languages: string[];
  excludePatterns: string[];
  includePatterns: string[];
}

export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  percentage: number;
  estimatedTimeRemaining: number;
  isComplete: boolean;
  isCancelled: boolean;
}

export interface EndpointMapping {
  id: string;
  sourceOperation: string;
  l1Operation: string;
  fieldMappings: FieldMapping[];
  confidence: number;
  overrides: FieldMapping[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldMapping {
  sourcePath: string;
  targetPath: string;
  sourceType: string;
  targetType: string;
  confidence: number;
  rule?: 'exact-match' | 'type-coercion' | 'semantic-similarity';
  isManualOverride: boolean;
  notes?: string;
}

export interface MigrationAudit {
  id: string;
  timestamp: Date;
  endpointId: string;
  filePath: string;
  originalCode: string;
  migratedCode: string;
  appliedBy: string;
  aiBackend: string;
  confidence: number;
  rollbackBlob: string;
  reviewState: 'pending' | 'approved' | 'rejected';
  reviewComments?: string;
}

export interface ApiCredentials {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
}

export interface ConnectionResult {
  success: boolean;
  latency: number;
  error?: string;
  tokenValid: boolean;
}

export interface ExtensionConfig {
  offlineMode: boolean;
  aiBackend: 'copilot' | 'local' | 'none';
  scanExcludePatterns: string[];
  credentialLockTimeout: number;
  telemetryEnabled: boolean;
  autoSaveInterval: number;
}

export type Environment = 'uat' | 'production';

export interface CodeGenerationRequest {
  originalCode: string;
  sourceMapping: EndpointMapping;
  targetFramework: string;
  language: string;
  context: CodeContext;
}

export interface CodeGenerationResponse {
  generatedCode: string;
  explanation: string;
  confidence: number;
  warnings: string[];
}

export interface CodeContext {
  filePath: string;
  imports: string[];
  dependencies: string[];
  framework?: string;
}

export interface ConsentPayload {
  dataTypes: string[];
  externalService: string;
  redactedPayload: string;
  retentionPolicy: string;
}