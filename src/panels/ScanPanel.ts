import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface ScanTreeItem {
  id: string;
  label: string;
  type: 'endpoint' | 'file' | 'occurrence';
  children?: ScanTreeItem[];
  filePath?: string;
  line?: number;
  snippet?: string;
}

export class ScanPanel implements vscode.TreeDataProvider<ScanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ScanTreeItem | undefined | null | void> = new vscode.EventEmitter<ScanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ScanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private mockData: ScanTreeItem[] = [
    {
      id: 'endpoint-1',
      label: 'Payment Transactions',
      type: 'endpoint',
      children: [
        {
          id: 'file-1',
          label: 'payment-service.ts',
          type: 'file',
          filePath: 'src/services/payment-service.ts',
          children: [
            {
              id: 'occurrence-1',
              label: 'Line 45: converge.processPayment()',
              type: 'occurrence',
              line: 45,
              snippet: 'const result = converge.processPayment(paymentData);'
            },
            {
              id: 'occurrence-2',
              label: 'Line 78: converge.refundPayment()',
              type: 'occurrence',
              line: 78,
              snippet: 'await converge.refundPayment(transactionId);'
            }
          ]
        },
        {
          id: 'file-2',
          label: 'checkout.component.ts',
          type: 'file',
          filePath: 'src/components/checkout.component.ts',
          children: [
            {
              id: 'occurrence-3',
              label: 'Line 23: ConvergeAPI.charge()',
              type: 'occurrence',
              line: 23,
              snippet: 'ConvergeAPI.charge(cardData, amount);'
            }
          ]
        }
      ]
    },
    {
      id: 'endpoint-2',
      label: 'Authentication',
      type: 'endpoint',
      children: [
        {
          id: 'file-3',
          label: 'auth-service.js',
          type: 'file',
          filePath: 'src/auth/auth-service.js',
          children: [
            {
              id: 'occurrence-4',
              label: 'Line 12: converge.authenticate()',
              type: 'occurrence',
              line: 12,
              snippet: 'const token = converge.authenticate(credentials);'
            }
          ]
        }
      ]
    }
  ];

  constructor(private context: vscode.ExtensionContext) {
    // Commands are registered by CommandRegistry, no need to register here
  }

  getTreeItem(element: ScanTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    
    if (element.children && element.children.length > 0) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Set icons based on type
    switch (element.type) {
      case 'endpoint':
        treeItem.iconPath = new vscode.ThemeIcon('globe');
        break;
      case 'file':
        treeItem.iconPath = new vscode.ThemeIcon('file-code');
        if (element.filePath) {
          treeItem.resourceUri = vscode.Uri.file(element.filePath);
        }
        break;
      case 'occurrence':
        treeItem.iconPath = new vscode.ThemeIcon('search');
        treeItem.tooltip = element.snippet;
        break;
    }

    // Add context value for context menu
    if (element.type === 'file') {
      treeItem.contextValue = 'scanFile';
    }

    return treeItem;
  }

  getChildren(element?: ScanTreeItem): Thenable<ScanTreeItem[]> {
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

  getParent(element: ScanTreeItem): vscode.ProviderResult<ScanTreeItem> {
    // For simplicity, we'll return null. In a real implementation,
    // you'd maintain parent-child relationships
    return null;
  }
}