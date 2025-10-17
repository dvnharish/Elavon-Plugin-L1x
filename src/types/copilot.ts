/**
 * GitHub Copilot Integration Types
 * Types for the GitHub Copilot integration feature
 */

export interface CopilotResponse {
  success: boolean;
  conversationId?: string;
  error?: string;
}

export interface FileContext {
  filePath: string;
  fileName: string;
  language: string;
  content: string;
  detectedStandard?: import('./contextMenu').StandardDetectionResult | undefined;
  relevantSpecs: OpenApiSpecSection[];
  fileSize: number;
  truncated: boolean;
}

export interface OpenApiSpecSection {
  title: string;
  path: string;
  content: any;
  relevanceScore: number;
}

export interface RedactionResult {
  redactedContent: string;
  redactionCount: number;
  redactedItems: RedactedItem[];
}

export interface RedactedItem {
  type: 'api_key' | 'token' | 'credential' | 'merchant_id';
  originalValue: string;
  redactedValue: string;
  lineNumber: number;
}

export interface ConsentPayload {
  filePath: string;
  contentPreview: string;
  redactionSummary: RedactionResult;
  specSections: OpenApiSpecSection[];
}

export interface MigrationContext {
  fileContext: FileContext;
  redactionResult: RedactionResult;
  userConsent: boolean;
  timestamp: Date;
}

export interface CopilotTelemetry {
  operation: 'consent_shown' | 'consent_approved' | 'consent_declined' | 'prompt_sent' | 'response_received' | 'error';
  filePath: string;
  fileSize: number;
  language: string;
  redactionCount: number;
  detectedStandard?: string;
  confidence?: number;
  timestamp: Date;
  error?: string;
}

export interface CopilotConfiguration {
  convergeSpecPath: string;
  elavonSpecPath: string;
  offlineMode: boolean;
  enableTelemetry: boolean;
  redactSecrets: boolean;
  maxPromptLength: number;
  timeoutMs: number;
}