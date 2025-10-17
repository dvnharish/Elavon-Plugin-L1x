# GitHub Copilot Integration Implementation Plan

## Current State Analysis

### Existing Placeholder Location
- **File**: `src/panels/ScanPanel.ts`
- **Method**: `askGitHubCopilot(item: ScanTreeItem)`
- **Current Implementation**: Shows placeholder message "💬 GitHub Copilot integration feature coming soon!"
- **Command Handler**: `src/commands/index.ts` → `handleAskGitHubCopilot()`
- **Command ID**: `l1x.askGitHubCopilot`
- **Context Menu**: Registered in `package.json` for `viewItem == scanFile`

### Existing Infrastructure
✅ **Available Components**:
- File Standard Analyzer (`src/services/FileStandardAnalyzer.ts`)
- OpenAPI Specs (`openapi/Converge Open API.json`, `openapi/Elavon API Gateway Open API.json`)
- Context Menu Types (`src/types/contextMenu.ts`)
- DI Container (`src/di/container.ts`)
- Logger (`src/utils/logger.ts`)
- Enhanced Scan Results with file context

❌ **Missing Components**:
- Copilot API integration
- Context builder for file metadata
- OpenAPI cache loader
- Mapping engine for endpoint inference
- Diff/migration UI
- Redaction utility
- Consent modal

## Implementation Plan

### Phase 1: Core Infrastructure Setup

#### 1.1 Configuration Management
**File**: `src/config/CopilotConfig.ts` (NEW)
```typescript
export interface CopilotConfiguration {
  convergeSpecPath: string;
  elavonSpecPath: string;
  offlineMode: boolean;
  enableTelemetry: boolean;
  redactSecrets: boolean;
  maxPromptLength: number;
  timeoutMs: number;
}
```

**Configuration Keys** (add to `package.json`):
```json
"configuration": {
  "title": "L1X Copilot Integration",
  "properties": {
    "l1x.copilot.convergeSpecPath": {
      "type": "string",
      "default": "openapi/Converge Open API.json",
      "description": "Path to Converge OpenAPI specification"
    },
    "l1x.copilot.elavonSpecPath": {
      "type": "string", 
      "default": "openapi/Elavon API Gateway Open API.json",
      "description": "Path to Elavon L1 OpenAPI specification"
    },
    "l1x.copilot.offlineMode": {
      "type": "boolean",
      "default": false,
      "description": "Disable external API calls to GitHub Copilot"
    },
    "l1x.copilot.enableTelemetry": {
      "type": "boolean",
      "default": true,
      "description": "Enable usage telemetry for Copilot integration"
    }
  }
}
```

#### 1.2 Redaction Utility
**File**: `src/utils/RedactionUtil.ts` (NEW)
```typescript
export class RedactionUtil {
  static redactSecrets(content: string): RedactionResult;
  static redactApiKeys(content: string): string;
  static redactCredentials(content: string): string;
  static createRedactionReport(original: string, redacted: string): RedactionReport;
}
```

**Functions**:
- `redactSecrets()` - Remove API keys, tokens, passwords
- `redactApiKeys()` - Specifically target API key patterns
- `redactCredentials()` - Remove merchant IDs, secrets
- `createRedactionReport()` - Generate summary of redacted items

#### 1.3 OpenAPI Cache Loader
**File**: `src/services/OpenApiCacheService.ts` (NEW)
```typescript
export class OpenApiCacheService {
  async loadConvergeSpec(): Promise<OpenApiSpec>;
  async loadElavonSpec(): Promise<OpenApiSpec>;
  getRelevantSections(filePath: string, endpoints: DetectedEndpoint[]): Promise<OpenApiSpecSection[]>;
  findEndpointMappings(convergeEndpoint: string): Promise<FieldMapping[]>;
}
```

**Functions**:
- `loadConvergeSpec()` - Load and cache Converge OpenAPI spec
- `loadElavonSpec()` - Load and cache Elavon L1 OpenAPI spec  
- `getRelevantSections()` - Extract relevant spec sections for file context
- `findEndpointMappings()` - Map Converge endpoints to Elavon equivalents

### Phase 2: Context Builder and File Analysis

#### 2.1 File Context Builder
**File**: `src/services/FileContextBuilder.ts` (NEW)
```typescript
export class FileContextBuilder {
  async buildContext(filePath: string, item: ScanTreeItem): Promise<FileContext>;
  private extractSymbols(content: string, language: string): Promise<FileSymbol[]>;
  private extractVariables(content: string, language: string): Promise<FileVariable[]>;
  private inferEndpoints(content: string, detectedStandard: StandardDetectionResult): Promise<InferredEndpoint[]>;
  private getFrameworkContext(content: string, language: string): Promise<FrameworkContext>;
}
```

**New Types** (add to `src/types/contextMenu.ts`):
```typescript
export interface FileSymbol {
  name: string;
  type: 'class' | 'method' | 'function' | 'interface';
  lineNumber: number;
  signature: string;
}

export interface FileVariable {
  name: string;
  type: string;
  scope: 'global' | 'local' | 'parameter';
  lineNumber: number;
  value?: string;
}

export interface InferredEndpoint {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  confidence: number;
  mappedElavonEndpoint?: string;
}

export interface FrameworkContext {
  framework: string;
  version?: string;
  patterns: string[];
  migrationHints: string[];
}
```

#### 2.2 Mapping Engine
**File**: `src/services/MappingEngine.ts` (NEW)
```typescript
export class MappingEngine {
  async generateEndpointMappings(convergeEndpoints: InferredEndpoint[]): Promise<EndpointMapping[]>;
  async findFieldMappings(convergeSchema: any, elavonSchema: any): Promise<FieldMapping[]>;
  async generateMigrationHints(context: FileContext): Promise<MigrationHint[]>;
}
```

**New Types**:
```typescript
export interface EndpointMapping {
  convergeEndpoint: string;
  elavonEndpoint: string;
  confidence: number;
  transformationRules: TransformationRule[];
}

export interface TransformationRule {
  type: 'rename' | 'restructure' | 'remove' | 'add';
  description: string;
  example?: string;
}

export interface MigrationHint {
  category: 'endpoint' | 'authentication' | 'data-structure' | 'error-handling';
  description: string;
  priority: 'high' | 'medium' | 'low';
  codeExample?: string;
}
```

### Phase 3: GitHub Copilot Integration

#### 3.1 Copilot API Adapter
**File**: `src/services/CopilotAdapter.ts` (NEW)
```typescript
export class CopilotAdapter implements ICopilotIntegration {
  async isAvailable(): Promise<boolean>;
  async createMigrationPrompt(context: FileContext): Promise<CopilotPrompt>;
  async sendCustomPrompt(prompt: CopilotPrompt): Promise<CopilotResponse>;
  async continueConversation(conversationId: string, followUp: string): Promise<CopilotResponse>;
  getConversationHistory(filePath: string): Promise<CopilotConversation[]>;
  
  private buildPromptTemplate(context: FileContext): string;
  private invokeGitHubCopilotChat(prompt: string): Promise<string>;
  private parseResponse(response: string): CopilotResponse;
}
```

**Key Functions**:
- `isAvailable()` - Check if GitHub Copilot extension is installed and active
- `createMigrationPrompt()` - Build structured prompt with file context
- `sendCustomPrompt()` - Send prompt to `github.copilot.chat.ask` API
- `invokeGitHubCopilotChat()` - Direct integration with Copilot Chat API
- `parseResponse()` - Extract code suggestions and explanations

#### 3.2 Prompt Template Engine
**File**: `src/templates/CopilotPrompts.ts` (NEW)
```typescript
export class CopilotPrompts {
  static readonly MIGRATION_TEMPLATE = `
    # Converge to Elavon L1 Migration Request
    
    ## File Context
    - **File**: {{filePath}}
    - **Language**: {{language}}
    - **Framework**: {{framework}}
    - **Detected Standard**: {{detectedStandard}}
    
    ## Current Code
    \`\`\`{{language}}
    {{fileContent}}
    \`\`\`
    
    ## Detected Endpoints
    {{#each inferredEndpoints}}
    - {{method}} {{url}} ({{confidence}}% confidence)
    {{/each}}
    
    ## OpenAPI Context
    ### Converge Spec Excerpts
    {{convergeSpecExcerpts}}
    
    ### Elavon L1 Spec Excerpts  
    {{elavonSpecExcerpts}}
    
    ## Migration Request
    Please help migrate this {{language}} code from Converge API to Elavon L1 API:
    
    1. **Identify** all Converge API calls and patterns
    2. **Map** them to equivalent Elavon L1 endpoints
    3. **Transform** the code structure as needed
    4. **Preserve** business logic and error handling
    5. **Add** comments explaining key changes
    
    ## Custom Instructions
    {{customInstructions}}
    
    Please provide:
    - Complete migrated code
    - Explanation of changes made
    - Any manual steps required
    - Potential issues to review
  `;
  
  static buildPrompt(template: string, context: FileContext, customInstructions?: string): string;
}
```

### Phase 4: User Interface Components

#### 4.1 Consent Modal
**File**: `src/ui/ConsentModal.ts` (NEW)
```typescript
export class ConsentModal {
  static async showConsentDialog(payload: ConsentPayload): Promise<boolean>;
  private static buildPayloadPreview(payload: ConsentPayload): string;
  private static createConsentWebview(payload: ConsentPayload): vscode.WebviewPanel;
}
```

**Consent Dialog Features**:
- Show exactly what data will be sent to GitHub Copilot
- Display redacted payload preview
- Allow user to approve/deny
- Remember consent choice per session
- Clear explanation of data usage

#### 4.2 Copilot Dialog
**File**: `src/ui/CopilotDialog.ts` (NEW)
```typescript
export class CopilotDialog {
  static async showPromptCustomization(context: FileContext): Promise<CopilotPrompt | null>;
  private static createDialogWebview(context: FileContext): vscode.WebviewPanel;
  private static handleDialogMessages(message: any): void;
}
```

**Dialog Features**:
- Pre-populated prompt template with file context
- Editable custom instructions section
- Real-time preview of final prompt
- File context summary (symbols, variables, endpoints)
- OpenAPI spec excerpts display

#### 4.3 Diff Viewer Integration
**File**: `src/ui/MigrationDiffViewer.ts` (NEW)
```typescript
export class MigrationDiffViewer {
  static async showDiff(original: string, migrated: string, explanation: string): Promise<DiffViewResult>;
  private static createDiffWebview(original: string, migrated: string): vscode.WebviewPanel;
  private static setupDiffEditor(webview: vscode.Webview): void;
}
```

**Diff Viewer Features**:
- Side-by-side comparison using Monaco editor
- Syntax highlighting for both versions
- Inline explanations for changes
- Accept/reject workflow
- Export diff as patch file

### Phase 5: Integration and Workflow

#### 5.1 Enhanced ScanPanel Integration
**File**: `src/panels/ScanPanel.ts` (MODIFY)

**Replace `askGitHubCopilot()` method**:
```typescript
async askGitHubCopilot(item: ScanTreeItem): Promise<void> {
  Logger.buttonClicked('askGitHubCopilot');
  
  if (!item.filePath) {
    vscode.window.showWarningMessage('No file path available for Copilot assistance');
    return;
  }

  try {
    // Step 1: Check Copilot availability
    const copilotAdapter = container.resolve<CopilotAdapter>(SERVICE_TOKENS.COPILOT_ADAPTER);
    const isAvailable = await copilotAdapter.isAvailable();
    
    if (!isAvailable) {
      vscode.window.showErrorMessage('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
      return;
    }

    // Step 2: Build file context
    const contextBuilder = container.resolve<FileContextBuilder>(SERVICE_TOKENS.CONTEXT_BUILDER);
    const fileContext = await contextBuilder.buildContext(item.filePath, item);
    
    // Step 3: Show consent modal
    const consentPayload = this.buildConsentPayload(fileContext);
    const userConsent = await ConsentModal.showConsentDialog(consentPayload);
    
    if (!userConsent) {
      Logger.info('User declined Copilot consent');
      return;
    }

    // Step 4: Show prompt customization dialog
    const customPrompt = await CopilotDialog.showPromptCustomization(fileContext);
    
    if (!customPrompt) {
      return; // User cancelled
    }

    // Step 5: Send to Copilot
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Asking GitHub Copilot for migration assistance...',
      cancellable: true
    }, async (progress, token) => {
      const response = await copilotAdapter.sendCustomPrompt(customPrompt);
      
      // Step 6: Show diff viewer if code suggestions provided
      if (response.suggestions.length > 0) {
        const originalContent = fileContext.content;
        const migratedContent = this.applySuggestions(originalContent, response.suggestions);
        
        await MigrationDiffViewer.showDiff(originalContent, migratedContent, response.explanation);
      } else {
        // Show response in information message
        vscode.window.showInformationMessage(response.content);
      }
    });

    // Step 7: Log telemetry
    this.logCopilotUsage(fileContext, customPrompt);

  } catch (error) {
    Logger.error('Copilot integration failed', error as Error);
    vscode.window.showErrorMessage(`Copilot integration failed: ${error}`);
  }
}
```

#### 5.2 Service Registration
**File**: `src/di/container.ts` (MODIFY)

**Add new service tokens**:
```typescript
export const SERVICE_TOKENS = {
  // ... existing tokens
  COPILOT_ADAPTER: Symbol('CopilotAdapter'),
  CONTEXT_BUILDER: Symbol('FileContextBuilder'),
  OPENAPI_CACHE: Symbol('OpenApiCacheService'),
  MAPPING_ENGINE: Symbol('MappingEngine'),
  REDACTION_UTIL: Symbol('RedactionUtil')
};
```

**Register services in `src/extension.ts`**:
```typescript
container.register(SERVICE_TOKENS.COPILOT_ADAPTER, () => new CopilotAdapter());
container.register(SERVICE_TOKENS.CONTEXT_BUILDER, () => new FileContextBuilder());
container.register(SERVICE_TOKENS.OPENAPI_CACHE, () => new OpenApiCacheService());
container.register(SERVICE_TOKENS.MAPPING_ENGINE, () => new MappingEngine());
container.register(SERVICE_TOKENS.REDACTION_UTIL, () => new RedactionUtil());
```

### Phase 6: Testing and Validation

#### 6.1 Unit Tests
**Files to create**:
- `src/services/CopilotAdapter.test.ts`
- `src/services/FileContextBuilder.test.ts`
- `src/services/OpenApiCacheService.test.ts`
- `src/services/MappingEngine.test.ts`
- `src/utils/RedactionUtil.test.ts`

#### 6.2 Integration Tests
**File**: `src/integration/CopilotIntegration.test.ts`
- Test complete workflow from context menu to diff viewer
- Mock GitHub Copilot API responses
- Test error handling and fallback scenarios
- Validate redaction functionality

#### 6.3 End-to-End Tests
**File**: `src/e2e/CopilotWorkflow.test.ts`
- Test with real file samples
- Validate UI components and user interactions
- Test consent flow and dialog interactions

## Implementation Steps

### Step 1: Infrastructure (Week 1)
1. Create configuration management (`CopilotConfig.ts`)
2. Implement redaction utility (`RedactionUtil.ts`)
3. Build OpenAPI cache service (`OpenApiCacheService.ts`)
4. Add configuration to `package.json`

### Step 2: Context Building (Week 2)
1. Implement file context builder (`FileContextBuilder.ts`)
2. Create mapping engine (`MappingEngine.ts`)
3. Build prompt template engine (`CopilotPrompts.ts`)
4. Add new types to `contextMenu.ts`

### Step 3: Copilot Integration (Week 3)
1. Implement Copilot adapter (`CopilotAdapter.ts`)
2. Create consent modal (`ConsentModal.ts`)
3. Build prompt customization dialog (`CopilotDialog.ts`)
4. Integrate with GitHub Copilot Chat API

### Step 4: UI Components (Week 4)
1. Implement diff viewer (`MigrationDiffViewer.ts`)
2. Create webview components for dialogs
3. Add CSS styling and responsive design
4. Implement user interaction handlers

### Step 5: Integration (Week 5)
1. Replace placeholder in `ScanPanel.ts`
2. Register services in DI container
3. Update command handlers
4. Add telemetry and logging

### Step 6: Testing (Week 6)
1. Write comprehensive unit tests
2. Create integration tests
3. Build end-to-end test scenarios
4. Performance testing and optimization

## Risk Assessment and Mitigation

### High Risk
1. **GitHub Copilot API Changes**
   - **Risk**: API breaking changes or deprecation
   - **Mitigation**: Use stable API endpoints, implement version checking
   - **Rollback**: Graceful degradation to template-based suggestions

2. **Large File Performance**
   - **Risk**: Slow processing of large files or complex contexts
   - **Mitigation**: Implement file size limits, context truncation
   - **Rollback**: Fallback to simplified context building

### Medium Risk
1. **OpenAPI Spec Parsing**
   - **Risk**: Invalid or malformed OpenAPI specifications
   - **Mitigation**: Robust error handling, spec validation
   - **Rollback**: Continue without spec context

2. **User Consent Complexity**
   - **Risk**: Users confused by consent dialog
   - **Mitigation**: Clear explanations, progressive disclosure
   - **Rollback**: Simplified consent with basic approval

### Low Risk
1. **Redaction Accuracy**
   - **Risk**: Sensitive data not properly redacted
   - **Mitigation**: Comprehensive pattern matching, user review
   - **Rollback**: Conservative redaction with user override

## Rollback Plan

### Immediate Rollback (< 5 minutes)
1. Revert `ScanPanel.ts` to show placeholder message
2. Disable new commands in `package.json`
3. Remove service registrations from `extension.ts`

### Partial Rollback (< 30 minutes)
1. Keep infrastructure components (config, cache)
2. Disable Copilot integration only
3. Maintain file context building for future use

### Complete Rollback (< 2 hours)
1. Remove all new files and services
2. Revert all modified files to previous versions
3. Update package.json to remove new configurations
4. Run full test suite to ensure stability

## Success Metrics

### Functional Metrics
- ✅ Copilot integration works end-to-end
- ✅ File context accurately extracted (>90% accuracy)
- ✅ Redaction removes all sensitive data (100% coverage)
- ✅ Diff viewer displays changes correctly
- ✅ User consent flow completes successfully

### Performance Metrics
- ⏱️ Context building completes in <5 seconds
- ⏱️ Copilot response received in <30 seconds
- ⏱️ Diff viewer renders in <2 seconds
- 💾 Memory usage stays under 100MB additional

### User Experience Metrics
- 👥 User consent rate >80%
- 👥 Feature completion rate >70%
- 👥 User satisfaction score >4/5
- 🐛 Error rate <5%

## Telemetry and Monitoring

### Events to Track
```typescript
// Telemetry events
Logger.telemetry('copilot.consent.shown', { filePath, fileSize, language });
Logger.telemetry('copilot.consent.approved', { filePath, redactionCount });
Logger.telemetry('copilot.prompt.sent', { promptLength, contextSize });
Logger.telemetry('copilot.response.received', { responseTime, suggestionCount });
Logger.telemetry('copilot.diff.viewed', { changeCount, userAction });
Logger.telemetry('copilot.error', { errorType, errorMessage, filePath });
```

### User-Facing Messages
```typescript
// Success messages
"✅ GitHub Copilot provided migration suggestions"
"🔍 File context analyzed successfully"
"🛡️ Sensitive data redacted from request"

// Error messages  
"❌ GitHub Copilot is not available"
"⚠️ File too large for context analysis"
"🚫 User declined to share data with Copilot"

// Progress messages
"🔍 Analyzing file context..."
"🤖 Asking GitHub Copilot for assistance..."
"📊 Generating migration suggestions..."
```

This comprehensive plan provides a production-ready implementation that integrates seamlessly with the existing codebase while maintaining security, performance, and user experience standards.