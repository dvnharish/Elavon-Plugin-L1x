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
  private handleScanProject(): void {
    vscode.window.showInformationMessage('Scan Project clicked - Mock data displayed');
    this.scanPanel?.refresh();
  }

  private handleReScan(): void {
    vscode.window.showInformationMessage('Re-Scan clicked - Mock data refreshed');
    this.scanPanel?.refresh();
  }

  private handleRefresh(): void {
    vscode.window.showInformationMessage('Refresh clicked - Tree view refreshed');
    this.scanPanel?.refresh();
  }

  private handleViewSummary(): void {
    vscode.window.showInformationMessage('View Summary clicked - Found 2 endpoints, 3 files, 4 occurrences');
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

    // Debug logging
    console.log('Field item:', fieldItem);

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
    
    // Debug logging
    console.log('Field ID:', fieldId);
    console.log('Field parts:', fieldParts);
    console.log('Field type:', fieldType);
    console.log('Credential ID:', credentialId);
    
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

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}