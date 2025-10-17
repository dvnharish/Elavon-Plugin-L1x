import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface CredentialTreeItem {
  id: string;
  label: string;
  type: 'environment' | 'credential' | 'field';
  environment?: 'uat' | 'production';
  children?: CredentialTreeItem[];
  value?: string;
  isSecret?: boolean;
}

export class CredentialsPanel implements vscode.TreeDataProvider<CredentialTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CredentialTreeItem | undefined | null | void> = new vscode.EventEmitter<CredentialTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CredentialTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private mockData: CredentialTreeItem[] = [
    {
      id: 'uat-env',
      label: 'UAT Environment',
      type: 'environment',
      environment: 'uat',
      children: [
        {
          id: 'uat-cred-1',
          label: 'Credential Set 1',
          type: 'credential',
          environment: 'uat',
          children: [
            {
              id: 'uat-merchant-1',
              label: 'Merchant ID: DEMO123',
              type: 'field',
              value: 'DEMO123'
            },
            {
              id: 'uat-apikey-1',
              label: 'API Key: ak_test_***',
              type: 'field',
              value: 'ak_test_1234567890',
              isSecret: true
            },
            {
              id: 'uat-secret-1',
              label: 'API Secret: ••••••••',
              type: 'field',
              value: 'secret_key_hidden',
              isSecret: true
            }
          ]
        }
      ]
    },
    {
      id: 'prod-env',
      label: 'Production Environment',
      type: 'environment',
      environment: 'production',
      children: [
        {
          id: 'prod-cred-1',
          label: 'Credential Set 1',
          type: 'credential',
          environment: 'production',
          children: [
            {
              id: 'prod-merchant-1',
              label: 'Merchant ID: PROD456',
              type: 'field',
              value: 'PROD456'
            },
            {
              id: 'prod-apikey-1',
              label: 'API Key: ak_live_***',
              type: 'field',
              value: 'ak_live_0987654321',
              isSecret: true
            },
            {
              id: 'prod-secret-1',
              label: 'API Secret: ••••••••',
              type: 'field',
              value: 'secret_key_hidden_prod',
              isSecret: true
            }
          ]
        }
      ]
    }
  ];

  constructor(private context: vscode.ExtensionContext) {
    // Commands are registered by CommandRegistry
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
        break;
      case 'field':
        if (element.isSecret) {
          treeItem.iconPath = new vscode.ThemeIcon('lock');
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('symbol-string');
        }
        treeItem.contextValue = 'credentialField';
        break;
    }

    return treeItem;
  }

  getChildren(element?: CredentialTreeItem): Thenable<CredentialTreeItem[]> {
    if (!element) {
      // Return root items (environments)
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
  async addCredential(environment: 'uat' | 'production'): Promise<void> {
    Logger.buttonClicked(`addCredential-${environment}`);
    
    // Show input boxes for credential details
    const merchantId = await vscode.window.showInputBox({
      prompt: `Enter Merchant ID for ${environment.toUpperCase()}`,
      placeHolder: 'e.g., MERCHANT123'
    });

    if (!merchantId) {
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: `Enter API Key for ${environment.toUpperCase()}`,
      placeHolder: 'e.g., ak_test_1234567890'
    });

    if (!apiKey) {
      return;
    }

    const apiSecret = await vscode.window.showInputBox({
      prompt: `Enter API Secret for ${environment.toUpperCase()}`,
      password: true,
      placeHolder: 'Enter API Secret (will be hidden)'
    });

    if (!apiSecret) {
      return;
    }

    // Add the new credential to the tree
    const envData = this.mockData.find(env => env.environment === environment);
    if (envData && envData.children) {
      const newCredentialId = `${environment}-cred-${envData.children.length + 1}`;
      const newCredential: CredentialTreeItem = {
        id: newCredentialId,
        label: `Credential Set ${envData.children.length + 1}`,
        type: 'credential',
        environment: environment,
        children: [
          {
            id: `${newCredentialId}-merchant`,
            label: `Merchant ID: ${merchantId}`,
            type: 'field',
            value: merchantId
          },
          {
            id: `${newCredentialId}-apikey`,
            label: `API Key: ${apiKey.substring(0, 8)}***`,
            type: 'field',
            value: apiKey,
            isSecret: true
          },
          {
            id: `${newCredentialId}-secret`,
            label: 'API Secret: ••••••••',
            type: 'field',
            value: apiSecret,
            isSecret: true
          }
        ]
      };

      envData.children.push(newCredential);
      this.refresh();
      vscode.window.showInformationMessage(`Credential added for ${environment.toUpperCase()} environment`);
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    Logger.buttonClicked(`deleteCredential-${credentialId}`);
    
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to delete this credential?',
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      // Remove credential from tree
      for (const env of this.mockData) {
        if (env.children) {
          env.children = env.children.filter(cred => cred.id !== credentialId);
        }
      }
      this.refresh();
      vscode.window.showInformationMessage('Credential deleted successfully');
    }
  }

  async testConnection(environment: 'uat' | 'production'): Promise<void> {
    Logger.buttonClicked(`testConnection-${environment}`);
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Testing ${environment.toUpperCase()} connection...`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      progress.report({ increment: 100 });
      
      vscode.window.showInformationMessage(`${environment.toUpperCase()} connection test successful (mock)`);
    });
  }
}