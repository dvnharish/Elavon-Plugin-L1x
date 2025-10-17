/**
 * Validation Report Viewer
 * Displays validation results with fix suggestions and batch operations
 */

import * as vscode from 'vscode'
import { ValidationResult, ValidationViolation, FixSuggestion, LintResult } from '../types/contextMenu'

export class ValidationReportViewer {
  private panel: vscode.WebviewPanel | undefined
  private context: vscode.ExtensionContext

  constructor(context: vscode.ExtensionContext) {
    this.context = context
  }

  async showReport(results: ValidationResult | Map<string, ValidationResult>): Promise<void> {
    if (this.panel) {
      this.panel.dispose()
    }

    this.panel = vscode.window.createWebviewPanel(
      'validationReport',
      'Elavon Compliance Report',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
          vscode.Uri.joinPath(this.context.extensionUri, 'out')
        ]
      }
    )

    const isMultiFile = results instanceof Map
    const html = isMultiFile 
      ? this.generateBatchReportHtml(results)
      : this.generateSingleReportHtml(results)

    this.panel.webview.html = html

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'applyFix':
            await this.applyFix(message.filePath, message.violationId, message.fixCode)
            break
          case 'showDetails':
            await this.showViolationDetails(message.violation)
            break
          case 'exportReport':
            await this.exportReport(results, message.format)
            break
          case 'openFile':
            await this.openFileAtLine(message.filePath, message.lineNumber)
            break
        }
      },
      undefined,
      this.context.subscriptions
    )

    this.panel.onDidDispose(() => {
      this.panel = undefined
    })
  }

  private generateSingleReportHtml(result: ValidationResult): string {
    const complianceColor = result.isCompliant ? '#28a745' : '#dc3545'
    const scoreColor = result.overallScore >= 80 ? '#28a745' : 
                      result.overallScore >= 60 ? '#ffc107' : '#dc3545'

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Validation Report</title>
        <style>
            ${this.getCommonStyles()}
        </style>
    </head>
    <body>
        <div class="container">
            <header class="report-header">
                <h1>🧪 Elavon L1 Compliance Report</h1>
                <div class="file-info">
                    <span class="file-path">${result.filePath}</span>
                    <span class="validation-time">Validated: ${result.validatedAt.toLocaleString()}</span>
                </div>
            </header>

            <div class="summary-cards">
                <div class="summary-card">
                    <div class="card-header">
                        <h3>Compliance Status</h3>
                        <span class="status-badge" style="background-color: ${complianceColor}">
                            ${result.isCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
                        </span>
                    </div>
                    <div class="score" style="color: ${scoreColor}">
                        ${result.overallScore}/100
                    </div>
                </div>

                <div class="summary-card">
                    <div class="card-header">
                        <h3>Issues Found</h3>
                    </div>
                    <div class="issue-counts">
                        <span class="error-count">${result.violations.filter(v => v.severity === 'error').length} Errors</span>
                        <span class="warning-count">${result.violations.filter(v => v.severity === 'warning').length} Warnings</span>
                        <span class="info-count">${result.violations.filter(v => v.severity === 'info').length} Info</span>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="card-header">
                        <h3>Performance</h3>
                    </div>
                    <div class="performance-info">
                        <span>Duration: ${result.validationDuration}ms</span>
                        ${result.lintResults ? `<span>Lint Issues: ${result.lintResults.totalIssues}</span>` : ''}
                    </div>
                </div>
            </div>

            ${this.generateViolationsSection(result.violations)}
            ${result.lintResults ? this.generateLintSection(result.lintResults) : ''}

            <div class="actions">
                <button onclick="exportReport('json')" class="btn btn-secondary">Export JSON</button>
                <button onclick="exportReport('html')" class="btn btn-secondary">Export HTML</button>
                <button onclick="exportReport('markdown')" class="btn btn-secondary">Export Markdown</button>
            </div>
        </div>

        <script>
            ${this.getCommonScript()}
        </script>
    </body>
    </html>`
  }

  private generateBatchReportHtml(results: Map<string, ValidationResult>): string {
    const totalFiles = results.size
    const compliantFiles = Array.from(results.values()).filter(r => r.isCompliant).length
    const totalViolations = Array.from(results.values()).reduce((sum, r) => sum + r.violations.length, 0)
    const avgScore = Array.from(results.values()).reduce((sum, r) => sum + r.overallScore, 0) / totalFiles

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Batch Validation Report</title>
        <style>
            ${this.getCommonStyles()}
            .file-results { margin-top: 2rem; }
            .file-result { 
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                margin-bottom: 1rem;
                overflow: hidden;
            }
            .file-header {
                background: var(--vscode-editor-background);
                padding: 1rem;
                border-bottom: 1px solid var(--vscode-panel-border);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .file-header:hover { background: var(--vscode-list-hoverBackground); }
            .file-content { padding: 1rem; display: none; }
            .file-content.expanded { display: block; }
        </style>
    </head>
    <body>
        <div class="container">
            <header class="report-header">
                <h1>🧪 Batch Elavon L1 Compliance Report</h1>
                <div class="file-info">
                    <span>${totalFiles} files validated</span>
                </div>
            </header>

            <div class="summary-cards">
                <div class="summary-card">
                    <div class="card-header">
                        <h3>Overall Compliance</h3>
                    </div>
                    <div class="compliance-stats">
                        <div class="stat">
                            <span class="stat-value">${compliantFiles}/${totalFiles}</span>
                            <span class="stat-label">Files Compliant</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${Math.round((compliantFiles / totalFiles) * 100)}%</span>
                            <span class="stat-label">Compliance Rate</span>
                        </div>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="card-header">
                        <h3>Issues Summary</h3>
                    </div>
                    <div class="issue-summary">
                        <span class="total-issues">${totalViolations} Total Issues</span>
                        <span class="avg-score">Avg Score: ${Math.round(avgScore)}/100</span>
                    </div>
                </div>
            </div>

            <div class="file-results">
                ${Array.from(results.entries()).map(([filePath, result]) => 
                  this.generateFileResultHtml(filePath, result)
                ).join('')}
            </div>

            <div class="actions">
                <button onclick="exportReport('json')" class="btn btn-secondary">Export JSON</button>
                <button onclick="exportReport('html')" class="btn btn-secondary">Export HTML</button>
                <button onclick="exportReport('markdown')" class="btn btn-secondary">Export Markdown</button>
            </div>
        </div>

        <script>
            ${this.getCommonScript()}
            
            function toggleFileResult(filePath) {
                const content = document.querySelector(\`[data-file="\${filePath}"] .file-content\`);
                const header = document.querySelector(\`[data-file="\${filePath}"] .file-header\`);
                
                if (content.classList.contains('expanded')) {
                    content.classList.remove('expanded');
                    header.querySelector('.toggle-icon').textContent = '▶';
                } else {
                    content.classList.add('expanded');
                    header.querySelector('.toggle-icon').textContent = '▼';
                }
            }
        </script>
    </body>
    </html>`
  }

  private generateFileResultHtml(filePath: string, result: ValidationResult): string {
    const complianceColor = result.isCompliant ? '#28a745' : '#dc3545'
    
    return `
    <div class="file-result" data-file="${filePath}">
        <div class="file-header" onclick="toggleFileResult('${filePath}')">
            <div class="file-info">
                <span class="toggle-icon">▶</span>
                <span class="file-name">${filePath}</span>
                <span class="status-badge" style="background-color: ${complianceColor}">
                    ${result.isCompliant ? '✅' : '❌'} ${result.overallScore}/100
                </span>
            </div>
            <div class="issue-counts">
                <span class="error-count">${result.violations.filter(v => v.severity === 'error').length}E</span>
                <span class="warning-count">${result.violations.filter(v => v.severity === 'warning').length}W</span>
                <span class="info-count">${result.violations.filter(v => v.severity === 'info').length}I</span>
            </div>
        </div>
        <div class="file-content">
            ${this.generateViolationsSection(result.violations, filePath)}
        </div>
    </div>`
  }

  private generateViolationsSection(violations: ValidationViolation[], filePath?: string): string {
    if (violations.length === 0) {
      return '<div class="no-issues">🎉 No compliance issues found!</div>'
    }

    const groupedViolations = this.groupViolationsByCategory(violations)
    
    return `
    <div class="violations-section">
        <h3>Compliance Issues</h3>
        ${Object.entries(groupedViolations).map(([category, categoryViolations]) => `
            <div class="violation-category">
                <h4>${this.getCategoryIcon(category)} ${this.formatCategory(category)}</h4>
                ${categoryViolations.map(violation => this.generateViolationHtml(violation, filePath)).join('')}
            </div>
        `).join('')}
    </div>`
  }

  private generateViolationHtml(violation: ValidationViolation, filePath?: string): string {
    const severityClass = `severity-${violation.severity}`
    const severityIcon = violation.severity === 'error' ? '❌' : 
                        violation.severity === 'warning' ? '⚠️' : 'ℹ️'

    return `
    <div class="violation ${severityClass}">
        <div class="violation-header">
            <span class="severity-icon">${severityIcon}</span>
            <span class="violation-message">${violation.message}</span>
            <span class="violation-location">Line ${violation.lineNumber}</span>
        </div>
        <div class="violation-details">
            <div class="code-snippet">
                <code>${violation.snippet}</code>
            </div>
            <div class="violation-meta">
                <span class="rule-name">${violation.rule}</span>
                ${violation.suggestedFix ? `
                    <button onclick="applyFix('${filePath || ''}', '${violation.id}', '${violation.suggestedFix}')" 
                            class="btn btn-primary btn-sm">Apply Fix</button>
                ` : ''}
                <button onclick="openFile('${filePath || ''}', ${violation.lineNumber})" 
                        class="btn btn-secondary btn-sm">Go to Line</button>
            </div>
        </div>
    </div>`
  }

  private generateLintSection(lintResult: LintResult): string {
    if (lintResult.totalIssues === 0) {
      return '<div class="lint-section"><h3>🧹 Linting</h3><div class="no-issues">No linting issues found!</div></div>'
    }

    return `
    <div class="lint-section">
        <h3>🧹 Linting Results</h3>
        <div class="lint-summary">
            <span>${lintResult.totalIssues} issues found</span>
            <span>${lintResult.fixableIssues} auto-fixable</span>
        </div>
        <div class="lint-issues">
            ${lintResult.issues.map(issue => `
                <div class="lint-issue severity-${issue.severity}">
                    <span class="severity-icon">${issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span class="issue-message">${issue.message}</span>
                    <span class="issue-location">Line ${issue.line}:${issue.column}</span>
                    <span class="rule-name">${issue.rule}</span>
                    ${issue.fixable ? '<span class="fixable-badge">Auto-fixable</span>' : ''}
                </div>
            `).join('')}
        </div>
    </div>`
  }

  private getCommonStyles(): string {
    return `
      :root {
        --error-color: #dc3545;
        --warning-color: #ffc107;
        --info-color: #17a2b8;
        --success-color: #28a745;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .report-header {
        text-align: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--vscode-panel-border);
      }

      .report-header h1 {
        margin: 0 0 1rem 0;
        color: var(--vscode-textLink-foreground);
      }

      .file-info {
        display: flex;
        justify-content: center;
        gap: 2rem;
        font-size: 0.9rem;
        color: var(--vscode-descriptionForeground);
      }

      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .summary-card {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 1.5rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .card-header h3 {
        margin: 0;
        font-size: 1.1rem;
      }

      .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        color: white;
        font-size: 0.85rem;
        font-weight: bold;
      }

      .score {
        font-size: 2rem;
        font-weight: bold;
        text-align: center;
      }

      .issue-counts, .compliance-stats, .issue-summary, .performance-info {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .error-count { color: var(--error-color); }
      .warning-count { color: var(--warning-color); }
      .info-count { color: var(--info-color); }

      .violations-section, .lint-section {
        margin: 2rem 0;
      }

      .violation-category {
        margin-bottom: 1.5rem;
      }

      .violation-category h4 {
        margin: 0 0 1rem 0;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .violation {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        margin-bottom: 1rem;
        padding: 1rem;
      }

      .violation.severity-error { border-left: 4px solid var(--error-color); }
      .violation.severity-warning { border-left: 4px solid var(--warning-color); }
      .violation.severity-info { border-left: 4px solid var(--info-color); }

      .violation-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .violation-message {
        flex: 1;
        font-weight: 500;
      }

      .violation-location {
        font-size: 0.85rem;
        color: var(--vscode-descriptionForeground);
      }

      .code-snippet {
        background: var(--vscode-textCodeBlock-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 0.75rem;
        margin: 0.5rem 0;
        font-family: var(--vscode-editor-font-family);
      }

      .violation-meta {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.5rem;
      }

      .rule-name {
        font-size: 0.85rem;
        color: var(--vscode-descriptionForeground);
        font-family: monospace;
      }

      .btn {
        padding: 0.375rem 0.75rem;
        border: 1px solid var(--vscode-button-border);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        text-decoration: none;
        display: inline-block;
      }

      .btn-primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      .btn-secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }

      .btn:hover {
        opacity: 0.8;
      }

      .actions {
        text-align: center;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 1px solid var(--vscode-panel-border);
      }

      .actions .btn {
        margin: 0 0.5rem;
      }

      .no-issues {
        text-align: center;
        padding: 2rem;
        color: var(--success-color);
        font-size: 1.1rem;
      }

      .lint-issue {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .fixable-badge {
        background: var(--success-color);
        color: white;
        padding: 0.125rem 0.5rem;
        border-radius: 12px;
        font-size: 0.75rem;
      }
    `
  }

  private getCommonScript(): string {
    return `
      const vscode = acquireVsCodeApi();

      function applyFix(filePath, violationId, fixCode) {
        vscode.postMessage({
          command: 'applyFix',
          filePath: filePath,
          violationId: violationId,
          fixCode: fixCode
        });
      }

      function openFile(filePath, lineNumber) {
        vscode.postMessage({
          command: 'openFile',
          filePath: filePath,
          lineNumber: lineNumber
        });
      }

      function exportReport(format) {
        vscode.postMessage({
          command: 'exportReport',
          format: format
        });
      }

      function showDetails(violation) {
        vscode.postMessage({
          command: 'showDetails',
          violation: violation
        });
      }
    `
  }

  private async applyFix(filePath: string, violationId: string, fixCode: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath)
      const edit = new vscode.WorkspaceEdit()
      
      // Find the violation line and apply the fix
      // This is a simplified implementation - in practice, you'd need more sophisticated parsing
      const text = document.getText()
      const lines = text.split('\n')
      
      // For now, just show the fix suggestion
      vscode.window.showInformationMessage(`Fix suggestion: ${fixCode}`)
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply fix: ${error}`)
    }
  }

  private async showViolationDetails(violation: ValidationViolation): Promise<void> {
    const message = `
Rule: ${violation.rule}
Severity: ${violation.severity}
Category: ${violation.category}
Line: ${violation.lineNumber}:${violation.columnNumber}

${violation.message}

Code snippet:
${violation.snippet}
    `
    
    vscode.window.showInformationMessage(message, { modal: true })
  }

  private async exportReport(results: ValidationResult | Map<string, ValidationResult>, format: string): Promise<void> {
    try {
      let content: string
      let filename: string
      
      switch (format) {
        case 'json':
          content = JSON.stringify(results, null, 2)
          filename = 'validation-report.json'
          break
        case 'markdown':
          content = this.generateMarkdownReport(results)
          filename = 'validation-report.md'
          break
        case 'html':
          content = results instanceof Map 
            ? this.generateBatchReportHtml(results)
            : this.generateSingleReportHtml(results)
          filename = 'validation-report.html'
          break
        default:
          throw new Error(`Unsupported format: ${format}`)
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          'Report Files': [format]
        }
      })

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'))
        vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`)
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export report: ${error}`)
    }
  }

  private generateMarkdownReport(results: ValidationResult | Map<string, ValidationResult>): string {
    if (results instanceof Map) {
      return this.generateBatchMarkdownReport(results)
    } else {
      return this.generateSingleMarkdownReport(results)
    }
  }

  private generateSingleMarkdownReport(result: ValidationResult): string {
    return `# Elavon L1 Compliance Report

## File: ${result.filePath}

**Validation Date:** ${result.validatedAt.toLocaleString()}  
**Duration:** ${result.validationDuration}ms  
**Compliance Status:** ${result.isCompliant ? '✅ Compliant' : '❌ Non-Compliant'}  
**Overall Score:** ${result.overallScore}/100

## Summary

- **Errors:** ${result.violations.filter(v => v.severity === 'error').length}
- **Warnings:** ${result.violations.filter(v => v.severity === 'warning').length}
- **Info:** ${result.violations.filter(v => v.severity === 'info').length}

## Issues

${result.violations.map(v => `
### ${v.severity === 'error' ? '❌' : v.severity === 'warning' ? '⚠️' : 'ℹ️'} ${v.message}

**Rule:** ${v.rule}  
**Line:** ${v.lineNumber}:${v.columnNumber}  
**Category:** ${v.category}

\`\`\`
${v.snippet}
\`\`\`

${v.suggestedFix ? `**Suggested Fix:** \`${v.suggestedFix}\`` : ''}
`).join('\n')}
`
  }

  private generateBatchMarkdownReport(results: Map<string, ValidationResult>): string {
    const totalFiles = results.size
    const compliantFiles = Array.from(results.values()).filter(r => r.isCompliant).length
    const totalViolations = Array.from(results.values()).reduce((sum, r) => sum + r.violations.length, 0)

    return `# Batch Elavon L1 Compliance Report

## Summary

- **Total Files:** ${totalFiles}
- **Compliant Files:** ${compliantFiles}
- **Compliance Rate:** ${Math.round((compliantFiles / totalFiles) * 100)}%
- **Total Issues:** ${totalViolations}

## File Results

${Array.from(results.entries()).map(([filePath, result]) => `
### ${filePath}

**Status:** ${result.isCompliant ? '✅ Compliant' : '❌ Non-Compliant'}  
**Score:** ${result.overallScore}/100  
**Issues:** ${result.violations.length}
`).join('\n')}
`
  }

  private async openFileAtLine(filePath: string, lineNumber: number): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath)
      const editor = await vscode.window.showTextDocument(document)
      
      const position = new vscode.Position(lineNumber - 1, 0)
      editor.selection = new vscode.Selection(position, position)
      editor.revealRange(new vscode.Range(position, position))
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`)
    }
  }

  private groupViolationsByCategory(violations: ValidationViolation[]): { [category: string]: ValidationViolation[] } {
    return violations.reduce((groups, violation) => {
      const category = violation.category
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category]!.push(violation)
      return groups
    }, {} as { [category: string]: ValidationViolation[] })
  }

  private getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'schema': '📋',
      'semantic': '🧠',
      'style': '🎨',
      'security': '🔒'
    }
    return icons[category] || '📝'
  }

  private formatCategory(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }
}