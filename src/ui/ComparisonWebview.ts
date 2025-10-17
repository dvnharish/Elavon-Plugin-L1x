import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ComparisonView, SpecSection } from '../services/SpecComparisonService';

export class ComparisonWebview {
  private panel: vscode.WebviewPanel | undefined;
  private comparison: ComparisonView | undefined;

  async show(comparison: ComparisonView): Promise<void> {
    Logger.info(`Opening comparison webview for comparison: ${comparison.id}`);

    this.comparison = comparison;

    if (this.panel) {
      // If panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.One);
      this.updateContent();
    } else {
      // Create new panel
      this.panel = vscode.window.createWebviewPanel(
        'specComparison',
        'API Specification Comparison',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.setupMessageHandling();
      this.updateContent();
    }
  }

  private updateContent(): void {
    if (!this.panel || !this.comparison) {return;}

    this.panel.webview.html = this.getWebviewContent(this.comparison);
  }

  private setupMessageHandling(): void {
    if (!this.panel) {return;}

    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'export':
            this.handleExport(message.format);
            break;
          case 'highlightSection':
            this.handleHighlightSection(message.path);
            break;
          case 'showFieldMapping':
            this.handleShowFieldMapping(message.mapping as {sourceField: string, targetField: string});
            break;
          case 'copyToClipboard':
            this.handleCopyToClipboard(message.content);
            break;
        }
      },
      undefined
    );
  }

  private async handleExport(format: 'json' | 'markdown' | 'html'): Promise<void> {
    if (!this.comparison) {return;}

    try {
      // This would typically call the SpecComparisonService export method
      // For now, we'll create a simple export
      const exportContent = this.createExportContent(format);
      
      const fileName = `spec-comparison-${this.comparison.id}.${format}`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(fileName),
        filters: {
          [format.toUpperCase()]: [format]
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportContent, 'utf8'));
        vscode.window.showInformationMessage(`Comparison exported to ${uri.fsPath}`);
      }
    } catch (error) {
      Logger.error('Failed to export comparison', error as Error);
      vscode.window.showErrorMessage('Failed to export comparison');
    }
  }

  private handleHighlightSection(path: string): void {
    Logger.info(`Highlighting section: ${path}`);
    // Send message back to webview to highlight the section
    this.panel?.webview.postMessage({
      command: 'highlightSection',
      path: path
    });
  }

  private handleShowFieldMapping(mapping: {sourceField: string, targetField: string}): void {
    Logger.info(`Showing field mapping: ${mapping.sourceField} -> ${mapping.targetField}`);
    // Could open a detailed mapping view or show in a modal
  }

  private async handleCopyToClipboard(content: string): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage('Copied to clipboard');
    } catch (error) {
      Logger.error('Failed to copy to clipboard', error as Error);
      vscode.window.showErrorMessage('Failed to copy to clipboard');
    }
  }

  private getWebviewContent(comparison: ComparisonView): string {
    const { summary, differences, fieldMappings, relevantSections } = comparison;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Specification Comparison</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 OpenAPI Specification Comparison</h1>
        <div class="header-actions">
            <button onclick="exportComparison('json')" class="btn btn-secondary">Export JSON</button>
            <button onclick="exportComparison('markdown')" class="btn btn-secondary">Export Markdown</button>
            <button onclick="exportComparison('html')" class="btn btn-secondary">Export HTML</button>
        </div>
    </div>

    <div class="summary-section">
        <h2>📊 Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-number">${summary.totalDifferences}</div>
                <div class="summary-label">Total Differences</div>
            </div>
            <div class="summary-card breaking">
                <div class="summary-number">${summary.breakingChanges}</div>
                <div class="summary-label">Breaking Changes</div>
            </div>
            <div class="summary-card enhancement">
                <div class="summary-number">${summary.enhancements}</div>
                <div class="summary-label">Enhancements</div>
            </div>
            <div class="summary-card non-breaking">
                <div class="summary-number">${summary.nonBreakingChanges}</div>
                <div class="summary-label">Non-Breaking</div>
            </div>
        </div>
    </div>

    ${relevantSections.length > 0 ? this.renderRelevantSections(relevantSections) : ''}

    <div class="comparison-container">
        <div class="spec-pane">
            <div class="spec-header converge-header">
                <h2>📘 Converge API</h2>
                <div class="spec-info">
                    <span>Version: ${comparison.convergeSpec?.info?.version || 'Unknown'}</span>
                </div>
            </div>
            <div class="spec-content" id="converge-content">
                ${this.renderSpecContent(comparison.convergeSpec, 'converge', differences)}
            </div>
        </div>

        <div class="divider"></div>

        <div class="spec-pane">
            <div class="spec-header elavon-header">
                <h2>📗 Elavon L1 API</h2>
                <div class="spec-info">
                    <span>Version: ${comparison.elavonSpec?.info?.version || 'Unknown'}</span>
                </div>
            </div>
            <div class="spec-content" id="elavon-content">
                ${this.renderSpecContent(comparison.elavonSpec, 'elavon', differences)}
            </div>
        </div>
    </div>

    ${fieldMappings.length > 0 ? this.renderFieldMappings(fieldMappings) : ''}

    <script>
        ${this.getScript()}
    </script>
</body>
</html>`;
  }

  private renderRelevantSections(sections: SpecSection[]): string {
    if (sections.length === 0) {return '';}

    return `
    <div class="relevant-sections">
        <h2>🎯 Relevant Sections</h2>
        <p>Based on your file analysis, these sections are most relevant:</p>
        <div class="relevant-list">
            ${sections.map(section => `
                <div class="relevant-item ${section.specType}" onclick="highlightSection('${section.path}')">
                    <div class="relevant-title">${section.title}</div>
                    <div class="relevant-score">Relevance: ${Math.round(section.relevanceScore * 100)}%</div>
                </div>
            `).join('')}
        </div>
    </div>`;
  }

  private renderSpecContent(spec: any, specType: 'converge' | 'elavon', differences: any[]): string {
    if (!spec || !spec.paths) {
      return '<div class="no-content">No specification content available</div>';
    }

    let content = '<div class="spec-tree">';
    
    // Render paths
    Object.keys(spec.paths).forEach(path => {
      const pathObj = spec.paths[path];
      const pathDiffs = differences.filter(d => d.path.includes(path));
      const hasChanges = pathDiffs.length > 0;
      
      content += `
        <div class="path-item ${hasChanges ? 'has-changes' : ''}" data-path="${path}">
          <div class="path-header" onclick="togglePath('${path}')">
            <span class="path-method">📍</span>
            <span class="path-name">${path}</span>
            ${hasChanges ? `<span class="change-indicator">${pathDiffs.length}</span>` : ''}
          </div>
          <div class="path-content" id="path-${path.replace(/[^a-zA-Z0-9]/g, '_')}">
            ${this.renderPathMethods(pathObj, path, pathDiffs)}
          </div>
        </div>`;
    });
    
    content += '</div>';
    return content;
  }

  private renderPathMethods(pathObj: any, path: string, differences: any[]): string {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    let content = '';

    methods.forEach(method => {
      if (pathObj[method]) {
        const methodObj = pathObj[method];
        const methodDiffs = differences.filter(d => d.path.includes(`${path}.${method}`));
        const hasChanges = methodDiffs.length > 0;

        content += `
          <div class="method-item ${hasChanges ? 'has-changes' : ''}" data-method="${method}">
            <div class="method-header">
              <span class="method-badge ${method}">${method.toUpperCase()}</span>
              <span class="method-summary">${methodObj.summary || 'No summary'}</span>
              ${hasChanges ? `<span class="change-indicator">${methodDiffs.length}</span>` : ''}
            </div>
            ${hasChanges ? this.renderMethodChanges(methodDiffs) : ''}
          </div>`;
      }
    });

    return content;
  }

  private renderMethodChanges(differences: any[]): string {
    return `
      <div class="method-changes">
        ${differences.map(diff => `
          <div class="change-item ${diff.type} ${diff.impact}">
            <span class="change-type">${this.getChangeIcon(diff.type)}</span>
            <span class="change-description">${diff.description}</span>
            <span class="change-impact ${diff.impact}">${diff.impact}</span>
          </div>
        `).join('')}
      </div>`;
  }

  private renderFieldMappings(fieldMappings: any[]): string {
    return `
    <div class="field-mappings-section">
        <h2>🔗 Field Mappings</h2>
        <div class="mappings-container">
            ${fieldMappings.map(group => `
                <div class="mapping-group">
                    <div class="mapping-header">
                        <h3>${group.endpoint}</h3>
                        <div class="confidence-badge">
                            Confidence: ${Math.round(group.confidence * 100)}%
                        </div>
                    </div>
                    <div class="mapping-list">
                        ${group.mappings.map((mapping: any) => `
                            <div class="mapping-item ${mapping.transformationRequired ? 'needs-transform' : 'direct'}">
                                <div class="mapping-source">${mapping.sourceField}</div>
                                <div class="mapping-arrow">
                                    ${mapping.transformationRequired ? '🔄' : '→'}
                                </div>
                                <div class="mapping-target">${mapping.targetField}</div>
                                <div class="mapping-types">
                                    ${mapping.sourceType} → ${mapping.targetType}
                                </div>
                                ${mapping.transformationRule ? `
                                    <div class="transformation-rule">
                                        ${mapping.transformationRule}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
  }

  private getChangeIcon(type: string): string {
    switch (type) {
      case 'added': return '➕';
      case 'removed': return '➖';
      case 'modified': return '🔄';
      default: return '❓';
    }
  }

  private createExportContent(format: 'json' | 'markdown' | 'html'): string {
    if (!this.comparison) {return '';}

    // Simple export - in a real implementation, this would use SpecComparisonService
    switch (format) {
      case 'json':
        return JSON.stringify({
          id: this.comparison.id,
          summary: this.comparison.summary,
          differences: this.comparison.differences,
          fieldMappings: this.comparison.fieldMappings
        }, null, 2);
      case 'markdown':
        return `# API Specification Comparison\n\nGenerated: ${this.comparison.createdAt}\n\n## Summary\n\n- Total Differences: ${this.comparison.summary.totalDifferences}\n- Breaking Changes: ${this.comparison.summary.breakingChanges}`;
      case 'html':
        return `<html><body><h1>API Specification Comparison</h1><p>Generated: ${this.comparison.createdAt}</p></body></html>`;
      default:
        return '';
    }
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        line-height: 1.6;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-panel-background);
      }

      .header h1 {
        color: var(--vscode-foreground);
        font-size: 24px;
        font-weight: 600;
      }

      .header-actions {
        display: flex;
        gap: 10px;
      }

      .btn {
        padding: 8px 16px;
        border: 1px solid var(--vscode-button-border);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }

      .btn:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .btn-secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .summary-section {
        padding: 20px;
        background: var(--vscode-panel-background);
      }

      .summary-section h2 {
        margin-bottom: 16px;
        color: var(--vscode-foreground);
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .summary-card {
        padding: 20px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        text-align: center;
      }

      .summary-number {
        font-size: 32px;
        font-weight: bold;
        margin-bottom: 8px;
      }

      .summary-label {
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
      }

      .summary-card.breaking .summary-number {
        color: var(--vscode-errorForeground);
      }

      .summary-card.enhancement .summary-number {
        color: var(--vscode-charts-blue);
      }

      .summary-card.non-breaking .summary-number {
        color: var(--vscode-charts-green);
      }

      .relevant-sections {
        padding: 20px;
        background: var(--vscode-panel-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .relevant-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 12px;
      }

      .relevant-item {
        padding: 12px 16px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .relevant-item:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .relevant-item.converge {
        border-left: 4px solid var(--vscode-charts-red);
      }

      .relevant-item.elavon {
        border-left: 4px solid var(--vscode-charts-green);
      }

      .relevant-title {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .relevant-score {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .comparison-container {
        display: flex;
        height: 600px;
        border-top: 1px solid var(--vscode-panel-border);
      }

      .spec-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .spec-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .converge-header {
        background: var(--vscode-charts-red);
        color: white;
      }

      .elavon-header {
        background: var(--vscode-charts-green);
        color: white;
      }

      .spec-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }

      .divider {
        width: 1px;
        background: var(--vscode-panel-border);
      }

      .spec-tree {
        font-size: 14px;
      }

      .path-item {
        margin-bottom: 12px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .path-item.has-changes {
        border-color: var(--vscode-charts-orange);
      }

      .path-header {
        padding: 12px 16px;
        background: var(--vscode-input-background);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .path-header:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .path-name {
        flex: 1;
        font-family: 'Courier New', monospace;
      }

      .change-indicator {
        background: var(--vscode-charts-orange);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }

      .path-content {
        padding: 0 16px 16px;
      }

      .method-item {
        margin: 8px 0;
        padding: 8px 12px;
        background: var(--vscode-panel-background);
        border-radius: 4px;
      }

      .method-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .method-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        color: white;
      }

      .method-badge.get { background: var(--vscode-charts-blue); }
      .method-badge.post { background: var(--vscode-charts-green); }
      .method-badge.put { background: var(--vscode-charts-orange); }
      .method-badge.delete { background: var(--vscode-charts-red); }
      .method-badge.patch { background: var(--vscode-charts-purple); }

      .method-summary {
        flex: 1;
        color: var(--vscode-descriptionForeground);
      }

      .method-changes {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--vscode-input-border);
      }

      .change-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 13px;
      }

      .change-description {
        flex: 1;
      }

      .change-impact {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: bold;
      }

      .change-impact.breaking {
        background: var(--vscode-errorBackground);
        color: var(--vscode-errorForeground);
      }

      .change-impact.non-breaking {
        background: var(--vscode-charts-green);
        color: white;
      }

      .change-impact.enhancement {
        background: var(--vscode-charts-blue);
        color: white;
      }

      .field-mappings-section {
        padding: 20px;
        background: var(--vscode-panel-background);
        border-top: 1px solid var(--vscode-panel-border);
      }

      .mapping-group {
        margin-bottom: 24px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        overflow: hidden;
      }

      .mapping-header {
        padding: 16px;
        background: var(--vscode-input-background);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .confidence-badge {
        background: var(--vscode-charts-blue);
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }

      .mapping-list {
        padding: 16px;
      }

      .mapping-item {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 12px;
        margin-bottom: 8px;
        background: var(--vscode-panel-background);
        border-radius: 6px;
        border-left: 4px solid var(--vscode-charts-green);
      }

      .mapping-item.needs-transform {
        border-left-color: var(--vscode-charts-orange);
      }

      .mapping-source, .mapping-target {
        font-family: 'Courier New', monospace;
        font-weight: 500;
      }

      .mapping-arrow {
        font-size: 18px;
        text-align: center;
      }

      .mapping-types {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        grid-column: 1 / -1;
      }

      .transformation-rule {
        grid-column: 1 / -1;
        font-size: 12px;
        color: var(--vscode-charts-orange);
        font-style: italic;
        margin-top: 4px;
      }

      .no-content {
        text-align: center;
        color: var(--vscode-descriptionForeground);
        padding: 40px;
        font-style: italic;
      }
    `;
  }

  private getScript(): string {
    return `
      const vscode = acquireVsCodeApi();

      function exportComparison(format) {
        vscode.postMessage({
          command: 'export',
          format: format
        });
      }

      function highlightSection(path) {
        vscode.postMessage({
          command: 'highlightSection',
          path: path
        });
        
        // Visual feedback
        const elements = document.querySelectorAll('[data-path="' + path + '"]');
        elements.forEach(el => {
          el.style.background = 'var(--vscode-list-activeSelectionBackground)';
          setTimeout(() => {
            el.style.background = '';
          }, 2000);
        });
      }

      function togglePath(path) {
        const contentId = 'path-' + path.replace(/[^a-zA-Z0-9]/g, '_');
        const content = document.getElementById(contentId);
        if (content) {
          content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }
      }

      // Synchronized scrolling
      const convergeContent = document.getElementById('converge-content');
      const elavonContent = document.getElementById('elavon-content');
      
      let isScrolling = false;
      
      if (convergeContent && elavonContent) {
        convergeContent.addEventListener('scroll', () => {
          if (!isScrolling) {
            isScrolling = true;
            elavonContent.scrollTop = convergeContent.scrollTop;
            setTimeout(() => { isScrolling = false; }, 50);
          }
        });
        
        elavonContent.addEventListener('scroll', () => {
          if (!isScrolling) {
            isScrolling = true;
            convergeContent.scrollTop = elavonContent.scrollTop;
            setTimeout(() => { isScrolling = false; }, 50);
          }
        });
      }
    `;
  }
}