import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CredentialsWebviewPanel } from '../panels/CredentialsWebviewPanel';

export class CommandRegistry {
  private disposables: vscode.Disposable[] = [];
  private scanPanel?: any;
  private credentialsPanel?: any;
  private docsPanel?: any;
  private migrationPanel?: any;

  constructor(private context: vscode.ExtensionContext) {}

  setScanPanel(scanPanel: any): void {
    this.scanPanel = scanPanel;
  }

  setCredentialsPanel(credentialsPanel: any): void {
    this.credentialsPanel = credentialsPanel;
  }

  setDocsPanel(docsPanel: any): void {
    this.docsPanel = docsPanel;
  }

  setMigrationPanel(migrationPanel: any): void {
    this.migrationPanel = migrationPanel;
  }

  registerAllCommands(): void {
    // Scan Panel Commands
    this.registerCommand('l1x.scanProject', () => this.handleScanProject());
    this.registerCommand('l1x.reScan', () => this.handleReScan());
    this.registerCommand('l1x.refresh', () => this.handleRefresh());
    this.registerCommand('l1x.viewSummary', () => this.handleViewSummary());
    this.registerCommand('l1x.configureScan', () => this.handleConfigureScan());
    this.registerCommand('l1x.clearResults', () => this.handleClearResults());

    // Credentials Panel Commands
    this.registerCommand('l1x.addCredential', () => this.handleAddCredential());
    this.registerCommand('l1x.testConnection', () => this.handleTestConnection());
    this.registerCommand('l1x.testCredentialSet', (item?: any) => this.handleTestCredentialSet(item));
    this.registerCommand('l1x.exportCredentials', () => this.handleExportCredentials());
    this.registerCommand('l1x.importCredentials', () => this.handleImportCredentials());
    this.registerCommand('l1x.openCredentialsEditor', () => this.handleOpenCredentialsEditor());
    this.registerCommand('l1x.editCredentialField', (fieldItem: any) => this.handleEditCredentialField(fieldItem));

    // Documentation Panel Commands
    this.registerCommand('l1x.addSpec', () => this.handleAddSpec());
    this.registerCommand('l1x.compareSpecs', () => this.handleCompareSpecs());
    this.registerCommand('l1x.generateMapping', () => this.handleGenerateMapping());

    // Migration Panel Commands
    this.registerCommand('l1x.generatePreview', () => this.handleGeneratePreview());
    this.registerCommand('l1x.apply', () => this.handleApply());
    this.registerCommand('l1x.rollback', () => this.handleRollback());

    // Context Menu Commands
    this.registerCommand('l1x.generateMigration', (item?: any) => this.handleGenerateMigration(item));
    this.registerCommand('l1x.addToIgnoreList', (item?: any) => this.handleAddToIgnoreList(item));
    
    // Enhanced Context Menu Commands for File Standard Detection
    this.registerCommand('l1x.detectFileStandard', (item?: any) => this.handleDetectFileStandard(item));
    this.registerCommand('l1x.migrateToElavon', (item?: any) => this.handleMigrateToElavon(item));
    this.registerCommand('l1x.askGitHubCopilot', (item?: any) => this.handleAskGitHubCopilot(item));
    this.registerCommand('l1x.compareOpenAPISpecs', (item?: any) => this.handleCompareOpenAPISpecs(item));
    this.registerCommand('l1x.validateElavonCompliance', (item?: any) => this.handleValidateElavonCompliance(item));
    this.registerCommand('l1x.batchDetectStandards', () => this.handleBatchDetectStandards());
  }

  private registerCommand(command: string, callback: (...args: any[]) => void): void {
    const disposable = vscode.commands.registerCommand(command, (...args: any[]) => {
      Logger.buttonClicked(command.replace('l1x.', ''));
      callback(...args);
    });
    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }

  // Scan Panel Command Handlers
  private async handleScanProject(): Promise<void> {
    if (this.scanPanel) {
      await this.scanPanel.scanProject();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleReScan(): Promise<void> {
    if (this.scanPanel) {
      await this.scanPanel.reScan();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private handleRefresh(): void {
    if (this.scanPanel) {
      this.scanPanel.refresh();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private handleViewSummary(): void {
    if (this.scanPanel) {
      this.scanPanel.viewSummary();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleConfigureScan(): Promise<void> {
    if (this.scanPanel) {
      await this.scanPanel.configureScan();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private handleClearResults(): void {
    if (this.scanPanel) {
      this.scanPanel.clearResults();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  // Credentials Panel Command Handlers
  private async handleAddCredential(): Promise<void> {
    if (this.credentialsPanel) {
      // Determine environment based on selection or show picker
      const environment = await vscode.window.showQuickPick(['uat', 'production'], {
        placeHolder: 'Select environment for new credential'
      });
      if (environment) {
        await this.credentialsPanel.addCredential(environment);
      }
    } else {
      vscode.window.showInformationMessage('Add Credential clicked - functionality coming in Phase 3');
    }
  }

  private async handleTestConnection(): Promise<void> {
    if (this.credentialsPanel) {
      const environment = await vscode.window.showQuickPick(['uat', 'production'], {
        placeHolder: 'Select environment to test'
      });
      if (environment) {
        await this.credentialsPanel.testConnection(environment);
      }
    } else {
      vscode.window.showInformationMessage('Test Connection clicked - functionality coming in Phase 3');
    }
  }

  private async handleExportCredentials(): Promise<void> {
    if (this.credentialsPanel) {
      const environment = await vscode.window.showQuickPick(['uat', 'production'], {
        placeHolder: 'Select environment to export'
      });
      if (environment) {
        await this.credentialsPanel.exportCredentials(environment);
      }
    } else {
      vscode.window.showInformationMessage('Export Credentials clicked - functionality coming in Phase 3');
    }
  }

  private async handleImportCredentials(): Promise<void> {
    if (this.credentialsPanel) {
      await this.credentialsPanel.importCredentials();
    } else {
      vscode.window.showInformationMessage('Import Credentials clicked - functionality coming in Phase 3');
    }
  }

  private async handleTestCredentialSet(item?: any): Promise<void> {
    if (this.credentialsPanel) {
      // Try multiple ways to get the credential ID
      const credentialId = item?.credentialId || item?.id;
      
      if (credentialId) {
        await this.credentialsPanel.testCredentialSet(credentialId);
      } else {
        vscode.window.showWarningMessage('No credential set selected');
      }
    } else {
      vscode.window.showInformationMessage('Test Credential Set clicked - functionality coming in Phase 3');
    }
  }

  private async handleOpenCredentialsEditor(): Promise<void> {
    Logger.buttonClicked('openCredentialsEditor');
    
    // Get the extension URI from the context
    const extensionUri = this.context.extensionUri;
    CredentialsWebviewPanel.createOrShow(extensionUri);
  }

  private async handleEditCredentialField(fieldItem: any): Promise<void> {
    Logger.buttonClicked('editCredentialField');
    
    if (!this.credentialsPanel) {
      vscode.window.showErrorMessage('Credentials panel not available');
      return;
    }



    // Parse the field ID to extract information
    const fieldId = fieldItem.id;
    const fieldParts = fieldId.split('-');
    
    if (fieldParts.length < 3) {
      vscode.window.showErrorMessage('Invalid field identifier');
      return;
    }

    // The field type is always the last part
    const fieldType = fieldParts[fieldParts.length - 1]; // e.g., "merchant", "key", "secret"
    // The credential ID is everything except the last part
    const credentialId = fieldParts.slice(0, -1).join('-'); // e.g., "uat-cred-1"

    
    // Determine field name and current value
    let fieldName = '';
    let currentValue = fieldItem.value || '';
    let isSecret = fieldItem.isSecret || false;
    
    switch (fieldType) {
      case 'merchant':
        fieldName = 'Merchant ID';
        break;
      case 'key':
        fieldName = 'API Key';
        break;
      case 'secret':
        fieldName = 'API Secret';
        isSecret = true;
        break;
      default:
        vscode.window.showErrorMessage('Field type not editable');
        return;
    }

    // Show input box for editing
    const newValue = await vscode.window.showInputBox({
      prompt: `Edit ${fieldName}`,
      value: currentValue,
      password: isSecret,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return `${fieldName} cannot be empty`;
        }
        if (value.length < 3) {
          return `${fieldName} must be at least 3 characters`;
        }
        return null;
      }
    });

    if (newValue !== undefined && newValue !== currentValue) {
      // Update the credential in the panel
      await this.credentialsPanel.updateCredentialField(credentialId, fieldType, newValue.trim());
      vscode.window.showInformationMessage(`${fieldName} updated successfully`);
    }
  }

  // Documentation Panel Command Handlers
  private async handleAddSpec(): Promise<void> {
    if (this.docsPanel) {
      await this.docsPanel.addSpec();
    } else {
      vscode.window.showInformationMessage('Add Spec clicked - functionality coming in Phase 4');
    }
  }

  private async handleCompareSpecs(): Promise<void> {
    if (this.docsPanel) {
      await this.docsPanel.compareSpecs();
    } else {
      vscode.window.showInformationMessage('Compare Specs clicked - functionality coming in Phase 4');
    }
  }

  private async handleGenerateMapping(): Promise<void> {
    if (this.docsPanel) {
      await this.docsPanel.generateMapping();
    } else {
      vscode.window.showInformationMessage('Generate Mapping clicked - functionality coming in Phase 4');
    }
  }

  // Migration Panel Command Handlers
  private async handleGeneratePreview(): Promise<void> {
    if (this.migrationPanel) {
      await this.migrationPanel.generatePreview();
    } else {
      vscode.window.showInformationMessage('Generate Preview clicked - functionality coming in Phase 5');
    }
  }

  private async handleApply(): Promise<void> {
    if (this.migrationPanel) {
      // For now, apply the first generated migration
      await this.migrationPanel.applyMigration('generated-1');
    } else {
      vscode.window.showInformationMessage('Apply clicked - functionality coming in Phase 5');
    }
  }

  private async handleRollback(): Promise<void> {
    if (this.migrationPanel) {
      // For now, rollback the first applied migration
      await this.migrationPanel.rollbackMigration('applied-1');
    } else {
      vscode.window.showInformationMessage('Rollback clicked - functionality coming in Phase 5');
    }
  }

  // Context Menu Command Handlers
  private async handleGenerateMigration(item?: any): Promise<void> {
    Logger.buttonClicked('generateMigration');
    
    if (!item) {
      vscode.window.showWarningMessage('No item selected for migration');
      return;
    }

    const itemType = item.contextValue || 'unknown';
    const itemLabel = item.label || 'Unknown item';
    
    // Show confirmation dialog
    const choice = await vscode.window.showInformationMessage(
      `Generate migration for ${itemLabel}?`,
      { modal: true },
      'Generate',
      'Cancel'
    );

    if (choice === 'Generate') {
      vscode.window.showInformationMessage(
        `Migration generation for ${itemType} will be available in Phase 5`
      );
    }
  }

  private async handleAddToIgnoreList(item?: any): Promise<void> {
    Logger.buttonClicked('addToIgnoreList');
    
    if (!item) {
      vscode.window.showWarningMessage('No item selected to ignore');
      return;
    }

    const itemLabel = item.label || 'Unknown item';
    
    // Show confirmation dialog
    const choice = await vscode.window.showWarningMessage(
      `Add ${itemLabel} to ignore list? This will exclude it from future scans.`,
      { modal: true },
      'Add to Ignore List',
      'Cancel'
    );

    if (choice === 'Add to Ignore List') {
      if (this.scanPanel && this.scanPanel.addToIgnoreList) {
        await this.scanPanel.addToIgnoreList(item);
        vscode.window.showInformationMessage(`${itemLabel} added to ignore list`);
      } else {
        vscode.window.showInformationMessage('Ignore list functionality will be enhanced in Phase 2.2');
      }
    }
  }

  // Enhanced Context Menu Command Handlers
  private async handleDetectFileStandard(item?: any): Promise<void> {
    Logger.buttonClicked('detectFileStandard');
    
    if (!item) {
      vscode.window.showWarningMessage('No file selected for standard detection');
      return;
    }

    if (this.scanPanel && this.scanPanel.detectFileStandard) {
      await this.scanPanel.detectFileStandard(item);
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleMigrateToElavon(item?: any): Promise<void> {
    Logger.buttonClicked('migrateToElavon');
    
    if (!item) {
      vscode.window.showWarningMessage('No file selected for migration');
      return;
    }

    if (this.scanPanel && this.scanPanel.migrateToElavon) {
      await this.scanPanel.migrateToElavon(item);
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleAskGitHubCopilot(item?: any): Promise<void> {
    Logger.buttonClicked('askGitHubCopilot');
    
    if (!item) {
      vscode.window.showWarningMessage('No file selected for Copilot assistance');
      return;
    }

    if (this.scanPanel && this.scanPanel.askGitHubCopilot) {
      await this.scanPanel.askGitHubCopilot(item);
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleCompareOpenAPISpecs(item?: any): Promise<void> {
    Logger.buttonClicked('compareOpenAPISpecs');
    
    if (!item) {
      vscode.window.showWarningMessage('No file selected for spec comparison');
      return;
    }

    if (this.scanPanel && this.scanPanel.compareOpenAPISpecs) {
      await this.scanPanel.compareOpenAPISpecs(item);
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleValidateElavonCompliance(item?: any): Promise<void> {
    Logger.buttonClicked('validateElavonCompliance');
    
    if (!item) {
      vscode.window.showWarningMessage('No file selected for validation');
      return;
    }

    if (this.scanPanel && this.scanPanel.validateElavonCompliance) {
      await this.scanPanel.validateElavonCompliance(item);
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  private async handleBatchDetectStandards(): Promise<void> {
    Logger.buttonClicked('batchDetectStandards');
    
    if (this.scanPanel && this.scanPanel.batchDetectStandards) {
      await this.scanPanel.batchDetectStandards();
    } else {
      vscode.window.showErrorMessage('Scan panel not available');
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}