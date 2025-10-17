import * as vscode from 'vscode';
import * as path from 'path';
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

export class CredentialsWebviewPanel {
  public static currentPanel: CredentialsWebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private credentialTestService: CredentialTestService;
  
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

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (CredentialsWebviewPanel.currentPanel) {
      CredentialsWebviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'l1xCredentials',
      'L1X Credentials',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview')
        ]
      }
    );

    CredentialsWebviewPanel.currentPanel = new CredentialsWebviewPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.credentialTestService = new CredentialTestService();

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'testCredentialSet':
            this.handleTestCredentialSet(message.credentialId, message.environment, message.credentials);
            return;
          case 'exportCredentials':
            this.handleExportCredentials(message.environment, message.credentials);
            return;
          case 'importCredentials':
            this.handleImportCredentials(message.environment);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private async handleTestCredentialSet(credentialId: string, environment: string, credentials: any) {
    Logger.buttonClicked('testCredentialSet');
    
    if (!credentials.merchantId || !credentials.apiKey || !credentials.apiSecret) {
      this._panel.webview.postMessage({
        command: 'testResult',
        credentialId: credentialId,
        success: false,
        message: 'Please fill in all credential fields before testing'
      });
      return;
    }
    
    try {
      // Update status to testing
      this._panel.webview.postMessage({
        command: 'testResult',
        credentialId: credentialId,
        success: null, // null indicates testing in progress
        message: 'Testing connection...'
      });
      
      // Test API credentials
      const apiUrl = environment === 'uat' 
        ? 'https://uat.api.converge.eu.elavonaws.com'
        : 'https://api.eu.convergepay.com';
      
      const testCredentials: TestCredentials = {
        merchantId: credentials.merchantId,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        apiUrl: apiUrl
      };
      
      const result = await this.credentialTestService.testCredentials(testCredentials);
      
      this._panel.webview.postMessage({
        command: 'testResult',
        credentialId: credentialId,
        success: result.success,
        message: result.message
      });
      
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'testResult',
        credentialId: credentialId,
        success: false,
        message: `Connection test failed: ${error}`
      });
    }
  }

  private async handleExportCredentials(environment: string, credentials: CredentialSet[]) {
    Logger.buttonClicked('exportCredentials');
    
    try {
      const exportData = JSON.stringify(credentials, null, 2);
      
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`l1x-credentials-${environment}.json`),
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

  private async handleImportCredentials(environment: string) {
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
        
        this._panel.webview.postMessage({
          command: 'loadCredentials',
          environment: environment,
          credentials: importData
        });
        
        vscode.window.showInformationMessage('Credentials imported successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Import failed: ${error}`);
    }
  }

  public dispose() {
    CredentialsWebviewPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const credentialsHtmlPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'credentials.html');
    
    // Read the HTML file
    try {
      const htmlContent = require('fs').readFileSync(credentialsHtmlPath.fsPath, 'utf8');
      return htmlContent;
    } catch (error) {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>L1X Credentials</title>
        </head>
        <body>
            <h1>Error loading credentials panel</h1>
            <p>Could not load credentials.html: ${error}</p>
        </body>
        </html>
      `;
    }
  }
}