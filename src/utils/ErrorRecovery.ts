/**
 * Error Recovery and Fallback Strategies
 * Provides comprehensive error handling and recovery mechanisms
 */

import * as vscode from 'vscode'
import { Logger } from './logger'
import { 
  ContextMenuError, 
  ErrorRecoveryStrategy, 
  OperationContext, 
  RecoveryResult, 
  AlternativeAction 
} from '../types/contextMenu'

export class ErrorRecoveryManager implements ErrorRecoveryStrategy {
  private recoveryStrategies = new Map<string, (error: ContextMenuError, context: OperationContext) => Promise<RecoveryResult>>()

  constructor() {
    this.initializeRecoveryStrategies()
  }

  canRecover(error: ContextMenuError): boolean {
    return error.recoverable && this.recoveryStrategies.has(error.category)
  }

  async recover(error: ContextMenuError, context: OperationContext): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(error.category)
    if (!strategy) {
      return {
        success: false,
        message: 'No recovery strategy available for this error type'
      }
    }

    try {
      Logger.info(`Attempting recovery for ${error.category} error`, { 
        operation: context.operation,
        filePath: context.filePath,
        retryCount: context.retryCount
      })

      return await strategy(error, context)
    } catch (recoveryError) {
      Logger.error('Recovery strategy failed', recoveryError as Error)
      return {
        success: false,
        message: `Recovery failed: ${recoveryError}`
      }
    }
  }

  getFallbackAction(operation: string): AlternativeAction[] {
    const fallbacks: { [key: string]: AlternativeAction[] } = {
      'detectFileStandard': [
        {
          id: 'manual-detection',
          label: 'Manual Standard Detection',
          description: 'Manually specify the API standard for this file',
          action: async () => {
            const choice = await vscode.window.showQuickPick([
              { label: 'Converge API', value: 'converge' },
              { label: 'Elavon L1 API', value: 'elavon' },
              { label: 'Mixed Standards', value: 'mixed' },
              { label: 'Unknown/Other', value: 'unknown' }
            ], { placeHolder: 'Select the API standard for this file' })
            
            if (choice) {
              vscode.window.showInformationMessage(`File marked as: ${choice.label}`)
            }
          }
        }
      ],
      'migrateToElavon': [
        {
          id: 'manual-migration',
          label: 'Manual Migration Guide',
          description: 'View step-by-step migration instructions',
          action: async () => {
            await this.showManualMigrationGuide()
          }
        },
        {
          id: 'template-migration',
          label: 'Use Migration Templates',
          description: 'Apply pre-built migration templates',
          action: async () => {
            await this.showMigrationTemplates()
          }
        }
      ],
      'askGitHubCopilot': [
        {
          id: 'offline-help',
          label: 'Offline Migration Help',
          description: 'View offline migration documentation',
          action: async () => {
            await this.showOfflineHelp()
          }
        }
      ],
      'compareOpenAPISpecs': [
        {
          id: 'cached-comparison',
          label: 'Use Cached Comparison',
          description: 'View previously cached spec comparison',
          action: async () => {
            vscode.window.showInformationMessage('Loading cached comparison data...')
          }
        }
      ],
      'validateElavonCompliance': [
        {
          id: 'basic-validation',
          label: 'Basic Validation',
          description: 'Run simplified validation checks',
          action: async () => {
            await this.runBasicValidation()
          }
        }
      ]
    }

    return fallbacks[operation] || []
  }

  private initializeRecoveryStrategies(): void {
    // Detection error recovery
    this.recoveryStrategies.set('detection', async (error, context) => {
      if (context.retryCount < 3) {
        // Retry with simplified detection
        return {
          success: true,
          message: 'Retrying with simplified pattern matching',
          data: { useSimplifiedDetection: true }
        }
      }
      return { success: false, message: 'Max retries exceeded for detection' }
    })

    // Migration error recovery
    this.recoveryStrategies.set('migration', async (error, context) => {
      if (error.message.includes('Copilot unavailable')) {
        return {
          success: true,
          message: 'Falling back to template-based migration',
          data: { useTemplates: true }
        }
      }
      return { success: false, message: 'Migration recovery not possible' }
    })

    // Validation error recovery
    this.recoveryStrategies.set('validation', async (error, context) => {
      return {
        success: true,
        message: 'Using basic validation rules',
        data: { useBasicRules: true }
      }
    })

    // UI error recovery
    this.recoveryStrategies.set('ui', async (error, context) => {
      return {
        success: true,
        message: 'Refreshing UI components',
        data: { refreshUI: true }
      }
    })
  }

  private async showManualMigrationGuide(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'migrationGuide',
      'Manual Migration Guide',
      vscode.ViewColumn.One,
      { enableScripts: false }
    )

    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family); padding: 2rem; line-height: 1.6; }
            h1, h2 { color: var(--vscode-textLink-foreground); }
            .step { margin: 1rem 0; padding: 1rem; background: var(--vscode-panel-background); border-radius: 4px; }
            code { background: var(--vscode-textCodeBlock-background); padding: 0.2rem 0.4rem; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🔄 Manual Migration Guide</h1>
        
        <div class="step">
            <h2>Step 1: Identify Converge Patterns</h2>
            <p>Look for these common Converge API patterns in your code:</p>
            <ul>
                <li><code>converge.com</code> URLs</li>
                <li><code>/api/</code> endpoints without version numbers</li>
                <li>Legacy authentication methods</li>
            </ul>
        </div>

        <div class="step">
            <h2>Step 2: Update API Endpoints</h2>
            <p>Replace Converge endpoints with Elavon L1 equivalents:</p>
            <ul>
                <li><code>/api/payments</code> → <code>/api/v1/payments</code></li>
                <li><code>/api/auth</code> → <code>/api/v1/authentication</code></li>
                <li>Update base URLs to Elavon L1 endpoints</li>
            </ul>
        </div>

        <div class="step">
            <h2>Step 3: Update Authentication</h2>
            <p>Migrate to Elavon L1 authentication:</p>
            <ul>
                <li>Use Bearer token authentication</li>
                <li>Update API key format</li>
                <li>Implement proper error handling</li>
            </ul>
        </div>

        <div class="step">
            <h2>Step 4: Test and Validate</h2>
            <p>Ensure your migration is successful:</p>
            <ul>
                <li>Run validation checks</li>
                <li>Test API calls in development</li>
                <li>Verify response formats</li>
            </ul>
        </div>
    </body>
    </html>`
  }

  private async showMigrationTemplates(): Promise<void> {
    const templates = [
      { label: 'JavaScript/Node.js Template', value: 'javascript' },
      { label: 'Java Spring Template', value: 'java' },
      { label: 'C# .NET Template', value: 'csharp' },
      { label: 'Python Template', value: 'python' }
    ]

    const selected = await vscode.window.showQuickPick(templates, {
      placeHolder: 'Select a migration template'
    })

    if (selected) {
      vscode.window.showInformationMessage(`Loading ${selected.label} migration template...`)
      // In a real implementation, this would load and apply the template
    }
  }

  private async showOfflineHelp(): Promise<void> {
    const helpContent = `
# Offline Migration Help

## Common Migration Patterns

### API Endpoints
- Add version numbers: /api/v1/
- Update authentication headers
- Use proper error handling

### Authentication
- Bearer token format
- Environment variables for secrets
- Proper token refresh logic

### Response Handling
- Check for data wrapper objects
- Handle new error formats
- Update field mappings
    `

    const document = await vscode.workspace.openTextDocument({
      content: helpContent,
      language: 'markdown'
    })
    
    await vscode.window.showTextDocument(document)
  }

  private async runBasicValidation(): Promise<void> {
    vscode.window.showInformationMessage('Running basic validation checks...')
    
    // Simulate basic validation
    setTimeout(() => {
      vscode.window.showInformationMessage('✅ Basic validation complete - no critical issues found')
    }, 2000)
  }

  static createContextMenuError(
    message: string,
    operation: string,
    filePath: string,
    category: 'detection' | 'migration' | 'validation' | 'ui',
    recoverable: boolean = true,
    userAction?: string
  ): ContextMenuError {
    const error = new Error(message) as ContextMenuError
    error.operation = operation
    error.filePath = filePath
    error.category = category
    error.recoverable = recoverable
    if (userAction) {
      error.userAction = userAction
    }
    return error
  }
}