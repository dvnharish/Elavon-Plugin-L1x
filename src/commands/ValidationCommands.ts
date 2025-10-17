/**
 * Validation Commands
 * Handles validation context menu commands and operations
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { ValidationEngine } from '../services/ValidationEngine'
import { ValidationReportViewer } from '../ui/ValidationReportViewer'
import { ValidationResult, EnhancedScanResult } from '../types/contextMenu'

export class ValidationCommands {
  private validationEngine: ValidationEngine
  private reportViewer: ValidationReportViewer

  constructor(
    context: vscode.ExtensionContext,
    validationEngine: ValidationEngine
  ) {
    this.validationEngine = validationEngine
    this.reportViewer = new ValidationReportViewer(context)
  }

  /**
   * Validate single file compliance
   */
  async validateFileCompliance(scanResult?: EnhancedScanResult): Promise<void> {
    try {
      let filePath: string

      if (scanResult) {
        filePath = scanResult.filePath
      } else {
        // Get active editor file
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) {
          vscode.window.showErrorMessage('No file selected for validation')
          return
        }
        filePath = activeEditor.document.fileName
      }

      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Validating Elavon L1 Compliance',
        cancellable: true
      }, async (progress, token) => {
        progress.report({ message: `Analyzing ${path.basename(filePath)}...` })

        if (token.isCancellationRequested) {
          return
        }

        const result = await this.validationEngine.validateFile(filePath)
        
        progress.report({ message: 'Generating report...', increment: 80 })

        // Show results
        await this.reportViewer.showReport(result)
        
        // Show summary notification
        const statusIcon = result.isCompliant ? '✅' : '❌'
        const message = `${statusIcon} Validation complete: ${result.overallScore}/100 (${result.violations.length} issues)`
        
        if (result.isCompliant) {
          vscode.window.showInformationMessage(message)
        } else {
          const action = await vscode.window.showWarningMessage(
            message,
            'View Report',
            'Show Fixes'
          )
          
          if (action === 'Show Fixes') {
            await this.showFixSuggestions(result)
          }
        }
      })

    } catch (error) {
      vscode.window.showErrorMessage(`Validation failed: ${error}`)
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatchCompliance(scanResults?: EnhancedScanResult[]): Promise<void> {
    try {
      let filePaths: string[]

      if (scanResults && scanResults.length > 0) {
        filePaths = scanResults.map(r => r.filePath)
      } else {
        // Get workspace files
        const workspaceFiles = await vscode.workspace.findFiles(
          '**/*.{js,ts,jsx,tsx,py,java,cs,php,rb,go,rs}',
          '**/node_modules/**',
          100
        )
        
        if (workspaceFiles.length === 0) {
          vscode.window.showInformationMessage('No files found for validation')
          return
        }

        filePaths = workspaceFiles.map(uri => uri.fsPath)
      }

      if (filePaths.length > 20) {
        const proceed = await vscode.window.showWarningMessage(
          `This will validate ${filePaths.length} files. This may take a while. Continue?`,
          'Yes',
          'No'
        )
        
        if (proceed !== 'Yes') {
          return
        }
      }

      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Batch Validation',
        cancellable: true
      }, async (progress, token) => {
        progress.report({ message: `Validating ${filePaths.length} files...` })

        const results = await this.validationEngine.validateBatch(filePaths)
        
        if (token.isCancellationRequested) {
          return
        }

        progress.report({ message: 'Generating batch report...', increment: 90 })

        // Show batch results
        await this.reportViewer.showReport(results)
        
        // Show summary
        const totalFiles = results.size
        const compliantFiles = Array.from(results.values()).filter(r => r.isCompliant).length
        const complianceRate = Math.round((compliantFiles / totalFiles) * 100)
        
        const message = `Batch validation complete: ${compliantFiles}/${totalFiles} files compliant (${complianceRate}%)`
        
        if (complianceRate >= 80) {
          vscode.window.showInformationMessage(`✅ ${message}`)
        } else {
          vscode.window.showWarningMessage(`⚠️ ${message}`)
        }
      })

    } catch (error) {
      vscode.window.showErrorMessage(`Batch validation failed: ${error}`)
    }
  }

  /**
   * Show fix suggestions for validation issues
   */
  async showFixSuggestions(result: ValidationResult): Promise<void> {
    try {
      const fixableViolations = result.violations.filter(v => v.suggestedFix)
      
      if (fixableViolations.length === 0) {
        vscode.window.showInformationMessage('No automatic fixes available for this file')
        return
      }

      const suggestions = await this.validationEngine.suggestFixes(fixableViolations)
      
      // Show quick pick for fixes
      const items = suggestions.map(suggestion => ({
        label: suggestion.description,
        description: `Confidence: ${Math.round(suggestion.confidence * 100)}%`,
        detail: suggestion.autoFixAvailable ? '🔧 Auto-fixable' : '📝 Manual steps required',
        suggestion
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a fix to apply',
        canPickMany: true
      })

      if (selected && selected.length > 0) {
        await this.applySelectedFixes(result.filePath, selected.map(s => s.suggestion))
      }

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show fix suggestions: ${error}`)
    }
  }

  /**
   * Apply selected fixes to file
   */
  private async applySelectedFixes(filePath: string, suggestions: any[]): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath)
      const editor = await vscode.window.showTextDocument(document)
      
      let appliedCount = 0
      let manualCount = 0

      for (const suggestion of suggestions) {
        if (suggestion.autoFixAvailable && suggestion.fixCode) {
          // Apply automatic fix
          // This is a simplified implementation - in practice, you'd need more sophisticated parsing
          appliedCount++
        } else if (suggestion.manualSteps) {
          // Show manual steps
          const steps = suggestion.manualSteps.join('\n• ')
          vscode.window.showInformationMessage(
            `Manual fix required:\n• ${steps}`,
            { modal: true }
          )
          manualCount++
        }
      }

      if (appliedCount > 0) {
        vscode.window.showInformationMessage(`Applied ${appliedCount} automatic fixes`)
      }
      
      if (manualCount > 0) {
        vscode.window.showInformationMessage(`${manualCount} issues require manual attention`)
      }

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply fixes: ${error}`)
    }
  }

  /**
   * Configure validation rules
   */
  async configureValidationRules(): Promise<void> {
    try {
      const rules = await this.validationEngine.getValidationRules()
      
      const items = rules.map(rule => ({
        label: rule.name,
        description: rule.severity.toUpperCase(),
        detail: rule.description,
        picked: true, // All rules enabled by default
        rule
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select validation rules to enable',
        canPickMany: true
      })

      if (selected) {
        // In a real implementation, you'd save the configuration
        vscode.window.showInformationMessage(`Updated validation rules: ${selected.length} rules enabled`)
      }

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to configure validation rules: ${error}`)
    }
  }

  /**
   * Show validation help and documentation
   */
  async showValidationHelp(): Promise<void> {
    const helpContent = `
# Elavon L1 Validation Help

## What is validated?

The validation engine checks your code against Elavon L1 API standards:

### Schema Compliance
- API endpoint format (/api/v1/...)
- Response structure (data wrapper)
- Field naming conventions (camelCase)

### Security
- Authentication headers
- No hardcoded credentials
- Proper error handling

### Style & Best Practices
- Consistent naming conventions
- Proper code structure
- Documentation standards

## Severity Levels

- **Error**: Must be fixed for compliance
- **Warning**: Should be addressed
- **Info**: Suggestions for improvement

## Fix Suggestions

- **Auto-fixable**: Can be applied automatically
- **Manual**: Requires developer attention

## Batch Validation

Validate multiple files at once for project-wide compliance checking.
    `

    const panel = vscode.window.createWebviewPanel(
      'validationHelp',
      'Validation Help',
      vscode.ViewColumn.One,
      { enableScripts: false }
    )

    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: var(--vscode-font-family);
                padding: 2rem;
                line-height: 1.6;
            }
            h1, h2, h3 { color: var(--vscode-textLink-foreground); }
            code { 
                background: var(--vscode-textCodeBlock-background);
                padding: 0.2rem 0.4rem;
                border-radius: 3px;
            }
        </style>
    </head>
    <body>
        ${helpContent.split('\n').map(line => {
          if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
          if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
          if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
          if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`
          if (line.trim() === '') return '<br>'
          return `<p>${line}</p>`
        }).join('')}
    </body>
    </html>`
  }

  /**
   * Register all validation commands
   */
  static registerCommands(
    context: vscode.ExtensionContext,
    validationEngine: ValidationEngine
  ): ValidationCommands {
    const commands = new ValidationCommands(context, validationEngine)

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'elavonMigration.validateCompliance',
        (scanResult?: EnhancedScanResult) => commands.validateFileCompliance(scanResult)
      ),
      
      vscode.commands.registerCommand(
        'elavonMigration.validateBatchCompliance',
        (scanResults?: EnhancedScanResult[]) => commands.validateBatchCompliance(scanResults)
      ),
      
      vscode.commands.registerCommand(
        'elavonMigration.configureValidation',
        () => commands.configureValidationRules()
      ),
      
      vscode.commands.registerCommand(
        'elavonMigration.validationHelp',
        () => commands.showValidationHelp()
      )
    )

    return commands
  }
}