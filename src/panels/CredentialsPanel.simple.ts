import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CredentialTestService, TestCredentials } from '../services/CredentialTestService';

export interface CredentialSet {
  id: string;
  name: string;
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  status: 'untested' | 'testing' | 'success' | 'error';
  lastTested?: Date;
  environment: 'uat' | 'production';
}

export interface CredentialTreeItem {
  id: string;
  label: string;
  type: 'environment' | 'credential' | 'field' | 'audit' | 'status' | 'url';
  environment?: 'uat' | 'production';
  children?: CredentialTreeItem[];
  value?: string;
  isSecret?: boolean;
  status?: 'connected' | 'disconnected' | 'testing' | 'locked';
  lastTested?: Date;
  credentialId?: string;
}

export class CredentialsPanel implements vscode.TreeDataProvider<CredentialTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CredentialTreeItem | undefined | null | void> = new vscode.EventEmitter<CredentialTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CredentialTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private credentialSets: { [key: string]: CredentialSet[] } = {
    uat: [
      {
        id: 'uat-cred-1',
        name: 'Credential Set 1',
        merchantId: 'demo123',
        apiKey: 'AKA_test',
        apiSecret: 'secret_key_123',
        status: 'untested',
        environment: 'uat'
      }
    ],
    production: [
      {
        id: 'prod-cred-1',
        name: 'Credential Set 1',
        merchantId: '',
        apiKey: '',
        apiSecret: '',
        status: 'untested',
        environment: 'production'
      }
    ]
  };

  private mockData: CredentialTreeItem[] = [];

  private credentialTestService: CredentialTestService;

  constructor(private context: vscode.ExtensionContext) {
    this.credentialTestService = new CredentialTestService();
    this.updateTreeData();
  }

  private updateTreeData(): void {
    this.mockData = [
      {
        id: 'env-uat',
        label: 'UAT Environment',
        type: 'environment',
        environment: 'uat',
        children: [
          {
            id: 'url-uat',
            label: 'https://uat.api.converge.eu.elavonaws.com',
            type: 'url'
          },
          ...(this.credentialSets.uat || []).map(cred => this.createCredentialTreeItem(cred))
        ]
      },
      {
        id: 'env-production',
        label: 'Production Environment',
        type: 'environment',
        environment: 'production',
        children: [
          {
            id: 'url-production',
            label: 'https://api.eu.convergepay.com',
            type: 'url'
          },
          ...(this.credentialSets.production || []).map(cred => this.createCredentialTreeItem(cred))
        ]
      }
    ];
  }

  private createCredentialTreeItem(credentialSet: CredentialSet): CredentialTreeItem {
    const statusIcon = credentialSet.status === 'success' ? '✓' : 
                      credentialSet.status === 'error' ? '✗' : 
                      credentialSet.status === 'testing' ? '⟳' : '○';
    
    return {
      id: credentialSet.id,
      label: `${credentialSet.name} ${statusIcon}`,
      type: 'credential',
      credentialId: credentialSet.id,
      children: [
        {
          id: `${credentialSet.id}-merchant`,
          label: `Merchant ID: ${credentialSet.merchantId || 'Not set'}`,
          type: 'field',
          value: credentialSet.merchantId
        },
        {
          id: `${credentialSet.id}-key`,
          label: `API Key: ${credentialSet.apiKey ? '••••••••' : 'Not set'}`,
          type: 'field',
          value: credentialSet.apiKey,
          isSecret: true
        },
        {
          id: `${credentialSet.id}-secret`,
          label: `API Secret: ${credentialSet.apiSecret ? '••••••••' : 'Not set'}`,
          type: 'field',
          value: credentialSet.apiSecret,
          isSecret: true
        }
      ]
    };
  }

  getTreeItem(element: CredentialTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    
    if (element.children && element.children.length > 0) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Set icons and context values based on type
    switch (element.type) {
      case 'environment':
        treeItem.iconPath = new vscode.ThemeIcon('server-environment');
        treeItem.contextValue = 'credentialEnvironment';
        break;
      case 'credential':
        treeItem.iconPath = new vscode.ThemeIcon('key');
        treeItem.contextValue = 'credentialSet';
        // Store the credential ID for command access
        (treeItem as any).credentialId = element.credentialId;
        break;
      case 'field':
        if (element.isSecret) {
          treeItem.iconPath = new vscode.ThemeIcon('lock');
          treeItem.contextValue = 'editableSecretField';
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('symbol-field');
          treeItem.contextValue = 'editableField';
        }
        // Add click command for editing
        if (element.value !== undefined) {
          treeItem.command = {
            command: 'l1x.editCredentialField',
            title: 'Edit Field',
            arguments: [element]
          };
        }
        break;
      case 'url':
        treeItem.iconPath = new vscode.ThemeIcon('link');
        treeItem.contextValue = 'apiUrl';
        break;
      case 'status':
        const statusIcon = element.status === 'connected' ? 'check' : 'x';
        treeItem.iconPath = new vscode.ThemeIcon(statusIcon);
        break;
      case 'audit':
        treeItem.iconPath = new vscode.ThemeIcon('history');
        break;
    }

    return treeItem;
  }

  getChildren(element?: CredentialTreeItem): Thenable<CredentialTreeItem[]> {
    if (!element) {
      // Return root items
      return Promise.resolve(this.mockData);
    }
    
    // Return children of the element
    return Promise.resolve(element.children || []);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getParent(element: CredentialTreeItem): vscode.ProviderResult<CredentialTreeItem> {
    return null;
  }

  // Methods for credential management
  async addCredential(environment?: 'uat' | 'production'): Promise<void> {
    Logger.buttonClicked('addCredential');
    
    if (!environment) {
      const envChoice = await vscode.window.showQuickPick(['UAT', 'Production'], {
        placeHolder: 'Select environment for new credential set'
      });
      
      if (!envChoice) {
        return;
      }
      environment = envChoice.toLowerCase() as 'uat' | 'production';
    }
    
    const name = await vscode.window.showInputBox({
      prompt: 'Enter name for the credential set',
      value: `Credential Set ${(this.credentialSets[environment] || []).length + 1}`
    });
    
    if (name) {
      const newCredential: CredentialSet = {
        id: `${environment}-cred-${Date.now()}`,
        name: name,
        merchantId: '',
        apiKey: '',
        apiSecret: '',
        status: 'untested',
        environment: environment
      };
      
      if (!this.credentialSets[environment]) {
        this.credentialSets[environment] = [];
      }
      this.credentialSets[environment]!.push(newCredential);
      this.updateTreeData();
      this.refresh();
      
      vscode.window.showInformationMessage(`New credential set "${name}" added to ${environment.toUpperCase()} environment`);
    }
  }

  async testCredentialSet(credentialId: string): Promise<void> {
    Logger.buttonClicked('testCredentialSet');
    
    const credential = this.findCredentialById(credentialId);
    if (!credential) {
      vscode.window.showErrorMessage('Credential set not found');
      return;
    }
    
    if (!credential.merchantId || !credential.apiKey || !credential.apiSecret) {
      vscode.window.showWarningMessage('Please fill in all credential fields before testing');
      return;
    }
    
    // Update status to testing
    credential.status = 'testing';
    this.updateTreeData();
    this.refresh();
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Testing ${credential.name}...`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      
      try {
        // Test API credentials
        const apiUrl = credential.environment === 'uat' 
          ? 'https://uat.api.converge.eu.elavonaws.com'
          : 'https://api.eu.convergepay.com';
        
        const testCredentials: TestCredentials = {
          merchantId: credential.merchantId,
          apiKey: credential.apiKey,
          apiSecret: credential.apiSecret,
          apiUrl: apiUrl
        };
        
        progress.report({ increment: 30 });
        
        const result = await this.credentialTestService.testCredentials(testCredentials);
        
        progress.report({ increment: 70 });
        
        if (result.success) {
          credential.status = 'success';
          credential.lastTested = new Date();
          vscode.window.showInformationMessage(`${credential.name}: ${result.message}`);
        } else {
          credential.status = 'error';
          vscode.window.showErrorMessage(`${credential.name}: ${result.message}`);
        }
        
        progress.report({ increment: 100 });
        
      } catch (error) {
        credential.status = 'error';
        vscode.window.showErrorMessage(`Connection test failed: ${error}`);
      }
      
      this.updateTreeData();
      this.refresh();
    });
  }

  async testConnection(credentialId?: string): Promise<void> {
    if (credentialId) {
      await this.testCredentialSet(credentialId);
    } else {
      // Test all credentials
      const allCredentials = [...(this.credentialSets.uat || []), ...(this.credentialSets.production || [])];
      for (const credential of allCredentials) {
        if (credential.merchantId && credential.apiKey && credential.apiSecret) {
          await this.testCredentialSet(credential.id);
        }
      }
    }
  }

  async exportCredentials(environment?: 'uat' | 'production'): Promise<void> {
    Logger.buttonClicked('exportCredentials');
    
    try {
      const credentials = environment ? 
        this.credentialSets[environment] : 
        { uat: this.credentialSets.uat, production: this.credentialSets.production };
      
      const exportData = JSON.stringify(credentials, null, 2);
      
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`l1x-credentials-${environment || 'all'}.json`),
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });
      
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportData, 'utf8'));
        vscode.window.showInformationMessage(`Credentials exported to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${error}`);
    }
  }

  async importCredentials(environment?: 'uat' | 'production'): Promise<void> {
    Logger.buttonClicked('importCredentials');
    
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });
      
      if (uris && uris[0]) {
        const fileContent = await vscode.workspace.fs.readFile(uris[0]);
        const importData = JSON.parse(fileContent.toString());
        
        if (environment) {
          if (Array.isArray(importData)) {
            this.credentialSets[environment] = importData;
          } else {
            vscode.window.showErrorMessage('Invalid file format for single environment import');
            return;
          }
        } else {
          if (importData.uat && importData.production) {
            this.credentialSets = importData;
          } else {
            vscode.window.showErrorMessage('Invalid file format for full import');
            return;
          }
        }
        
        this.updateTreeData();
        this.refresh();
        vscode.window.showInformationMessage('Credentials imported successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Import failed: ${error}`);
    }
  }

  private findCredentialById(credentialId: string): CredentialSet | undefined {
    const allCredentials = [...(this.credentialSets.uat || []), ...(this.credentialSets.production || [])];
    return allCredentials.find(cred => cred.id === credentialId);
  }

  async updateCredentialField(credentialId: string, fieldType: string, newValue: string): Promise<void> {
    const credential = this.findCredentialById(credentialId);
    
    if (!credential) {
      throw new Error('Credential set not found');
    }

    // Update the field based on type
    switch (fieldType) {
      case 'merchant':
        credential.merchantId = newValue;
        break;
      case 'key':
        credential.apiKey = newValue;
        break;
      case 'secret':
        credential.apiSecret = newValue;
        break;
      default:
        throw new Error('Invalid field type');
    }

    // Reset status since credentials changed
    credential.status = 'untested';
    
    // Update tree data and refresh
    this.updateTreeData();
    this.refresh();
  }
}