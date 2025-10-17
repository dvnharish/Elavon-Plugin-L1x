import * as vscode from 'vscode';
import { ScanPanel, ScanTreeItem } from '../panels/ScanPanel';
import { Logger } from '../utils/logger';

export class ScanPanelCommands {
  constructor(private scanPanel: ScanPanel) {}

  registerCommands(context: vscode.ExtensionContext): void {
    // Existing commands
    context.subscriptions.push(
      vscode.commands.registerCommand('l1x.scanProject', () => this.scanPanel.scanProject()),
      vscode.commands.registerCommand('l1x.configureScan', () => this.scanPanel.configureScan()),
      vscode.commands.registerCommand('l1x.reScan', () => this.scanPanel.reScan()),
      vscode.commands.registerCommand('l1x.viewSummary', () => this.scanPanel.viewSummary()),
      vscode.commands.registerCommand('l1x.clearResults', () => this.scanPanel.clearResults()),
      vscode.commands.registerCommand('l1x.addToIgnoreList', (item: ScanTreeItem) => this.scanPanel.addToIgnoreList(item)),
      vscode.commands.registerCommand('l1x.detectFileStandard', (item: ScanTreeItem) => this.scanPanel.detectFileStandard(item)),
      vscode.commands.registerCommand('l1x.migrateToElavon', (item: ScanTreeItem) => this.scanPanel.migrateToElavon(item)),
      vscode.commands.registerCommand('l1x.askGitHubCopilot', (item: ScanTreeItem) => this.scanPanel.askGitHubCopilot(item))
    );

    // New enhanced commands
    context.subscriptions.push(
      vscode.commands.registerCommand('l1x.generateL1EquivalentCode', (item: ScanTreeItem) => this.scanPanel.generateL1EquivalentCode(item)),
      vscode.commands.registerCommand('l1x.showApiMapping', (item: ScanTreeItem) => this.scanPanel.showApiMapping(item)),
      vscode.commands.registerCommand('l1x.generateL1DTOs', (item: ScanTreeItem) => this.scanPanel.generateL1DTOs(item)),
      vscode.commands.registerCommand('l1x.openDocumentation', (item: ScanTreeItem) => this.scanPanel.openDocumentation(item)),
      vscode.commands.registerCommand('l1x.toggleView', () => this.scanPanel.toggleView())
    );

    // Bulk operations
    context.subscriptions.push(
      vscode.commands.registerCommand('l1x.generateMigrationReport', () => this.generateMigrationReport()),
      vscode.commands.registerCommand('l1x.exportApiMappings', () => this.exportApiMappings()),
      vscode.commands.registerCommand('l1x.showMigrationCandidates', () => this.showMigrationCandidates())
    );

    Logger.info('Registered all scan panel commands');
  }

  private async generateMigrationReport(): Promise<void> {
    Logger.buttonClicked('generateMigrationReport');
    
    try {
      // Get current scan results
      const scanResults = this.scanPanel['scanResults']; // Access private property
      if (scanResults.length === 0) {
        vscode.window.showWarningMessage('No scan results available. Please run a scan first.');
        return;
      }

      // Generate comprehensive migration report
      const report = this.buildMigrationReport(scanResults);
      
      // Show report in new document
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Migration report generated successfully');
    } catch (error) {
      Logger.error('Failed to generate migration report', error as Error);
      vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
    }
  }

  private async exportApiMappings(): Promise<void> {
    Logger.buttonClicked('exportApiMappings');
    
    try {
      const scannerService = this.scanPanel['scannerService'];
      const apiMappings = scannerService.getApiMappings();
      const variableMappings = scannerService.getVariableMappings();

      if (apiMappings.length === 0 && variableMappings.length === 0) {
        vscode.window.showWarningMessage('No API mappings available. Please run an OpenAPI-aware scan first.');
        return;
      }

      const exportData = {
        timestamp: new Date().toISOString(),
        apiMappings: apiMappings,
        variableMappings: variableMappings,
        summary: {
          totalApiMappings: apiMappings.length,
          totalVariableMappings: variableMappings.length,
          averageConfidence: this.calculateAverageConfidence(apiMappings)
        }
      };

      // Show export in new document
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(exportData, null, 2),
        language: 'json'
      });

      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('API mappings exported successfully');
    } catch (error) {
      Logger.error('Failed to export API mappings', error as Error);
      vscode.window.showErrorMessage(`Failed to export mappings: ${error}`);
    }
  }

  private async showMigrationCandidates(): Promise<void> {
    Logger.buttonClicked('showMigrationCandidates');
    
    try {
      const scanResults = this.scanPanel['scanResults'];
      if (scanResults.length === 0) {
        vscode.window.showWarningMessage('No scan results available. Please run a scan first.');
        return;
      }

      const projectTreeService = this.scanPanel['projectTreeService'];
      const candidates = projectTreeService.findMigrationCandidates(scanResults);

      if (candidates.length === 0) {
        vscode.window.showInformationMessage('No migration candidates found.');
        return;
      }

      // Show candidates in quick pick
      const items = candidates.map(candidate => ({
        label: `${this.getPriorityIcon(candidate.priority)} ${candidate.filePath}`,
        description: `${candidate.priority.toUpperCase()} priority - ${candidate.estimatedEffort}`,
        detail: candidate.reason,
        candidate: candidate
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a file to view migration details',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        // Open the selected file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const filePath = vscode.Uri.joinPath(workspaceFolder.uri, selected.candidate.filePath);
          await vscode.window.showTextDocument(filePath);
        }
      }
    } catch (error) {
      Logger.error('Failed to show migration candidates', error as Error);
      vscode.window.showErrorMessage(`Failed to show candidates: ${error}`);
    }
  }

  private buildMigrationReport(scanResults: any[]): string {
    const projectTreeService = this.scanPanel['projectTreeService'];
    const summary = projectTreeService.generateProjectSummary(scanResults);
    const candidates = projectTreeService.findMigrationCandidates(scanResults);

    return `# Converge → L1 (Elavon) Migration Report

Generated on: ${new Date().toLocaleString()}

## Executive Summary

- **Total Files**: ${summary.totalFiles}
- **Total References**: ${summary.totalConvergeReferences}
- **Migration Complexity**: ${summary.migrationComplexity.toUpperCase()}
- **Estimated Time**: ${summary.estimatedMigrationTime}

## Language Distribution

${Object.entries(summary.languageDistribution)
  .map(([lang, count]) => `- **${lang}**: ${count} files`)
  .join('\n')}

## Endpoint Types Found

${Object.entries(summary.endpointsByType)
  .map(([type, count]) => `- **${type}**: ${count} references`)
  .join('\n')}

## Variable Types Found

${Object.entries(summary.variablesByType)
  .map(([type, count]) => `- **${type}**: ${count} variables`)
  .join('\n')}

## Migration Candidates (Priority Order)

${candidates.map((candidate, index) => `
### ${index + 1}. ${candidate.filePath}

- **Priority**: ${candidate.priority.toUpperCase()}
- **Estimated Effort**: ${candidate.estimatedEffort}
- **Reason**: ${candidate.reason}
- **References Found**: ${candidate.results.length}

#### Specific References:
${candidate.results.map(result => 
  `- Line ${result.line}: ${result.matchedText} (${Math.round(result.confidence * 100)}% confidence)`
).join('\n')}
`).join('\n')}

## Recommended Migration Strategy

### Phase 1: High Priority Files
Focus on files with API endpoints and authentication credentials first.

### Phase 2: Medium Priority Files  
Migrate service classes and business logic components.

### Phase 3: Low Priority Files
Update remaining references and perform final testing.

## Next Steps

1. Review the migration candidates above
2. Start with high-priority files
3. Use the "Generate L1 Equivalent Code" feature for each file
4. Test thoroughly after each migration
5. Update documentation and deployment scripts

---

*This report was generated by the L1X Elavon Migrator extension*
`;
  }

  private calculateAverageConfidence(mappings: any[]): number {
    if (mappings.length === 0) return 0;
    const total = mappings.reduce((sum, mapping) => sum + mapping.confidence, 0);
    return Math.round((total / mappings.length) * 100);
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}