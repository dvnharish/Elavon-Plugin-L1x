import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
// import { OpenApiCache, OpenApiSpec, OpenApiEndpoint } from '../services/OpenApiCache';
// import { MappingEngine, EndpointMapping, MappingStats } from '../services/MappingEngine';

export interface DocTreeItem {
  id: string;
  label: string;
  type: 'spec' | 'endpoint' | 'field' | 'mapping' | 'category' | 'stats' | 'status';
  specType?: 'converge' | 'l1';
  children?: DocTreeItem[];
  description?: string;
  dataType?: string;
  required?: boolean;
  mappedTo?: string;
  confidence?: number;
  specId?: string;
  endpointId?: string;
  mappingId?: string;
}

export class DocsPanel implements vscode.TreeDataProvider<DocTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DocTreeItem | undefined | null | void> = new vscode.EventEmitter<DocTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DocTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  // private openApiCache?: OpenApiCache;
  // private mappingEngine?: MappingEngine;
  private mockData: DocTreeItem[] = [
    {
      id: 'converge-spec',
      label: 'Converge API Specification',
      type: 'spec',
      specType: 'converge',
      children: [
        {
          id: 'converge-payments',
          label: 'Payment Endpoints',
          type: 'category',
          children: [
            {
              id: 'converge-payment-create',
              label: 'POST /payments',
              type: 'endpoint',
              description: 'Create a new payment',
              children: [
                {
                  id: 'converge-ssl-merchant-id',
                  label: 'ssl_merchant_id (required)',
                  type: 'field',
                  dataType: 'string',
                  required: true,
                  description: 'Merchant identifier'
                },
                {
                  id: 'converge-ssl-amount',
                  label: 'ssl_amount (required)',
                  type: 'field',
                  dataType: 'decimal',
                  required: true,
                  description: 'Payment amount'
                },
                {
                  id: 'converge-ssl-card-number',
                  label: 'ssl_card_number (required)',
                  type: 'field',
                  dataType: 'string',
                  required: true,
                  description: 'Credit card number'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'l1-spec',
      label: 'Elavon L1 API Specification',
      type: 'spec',
      specType: 'l1',
      children: [
        {
          id: 'l1-payments',
          label: 'Payment Endpoints',
          type: 'category',
          children: [
            {
              id: 'l1-payment-create',
              label: 'POST /v1/payments',
              type: 'endpoint',
              description: 'Create a new payment',
              children: [
                {
                  id: 'l1-merchant-id',
                  label: 'merchant_id (required)',
                  type: 'field',
                  dataType: 'string',
                  required: true,
                  description: 'Merchant identifier'
                },
                {
                  id: 'l1-amount',
                  label: 'amount (required)',
                  type: 'field',
                  dataType: 'integer',
                  required: true,
                  description: 'Payment amount in cents'
                },
                {
                  id: 'l1-payment-method',
                  label: 'payment_method (required)',
                  type: 'field',
                  dataType: 'object',
                  required: true,
                  description: 'Payment method details'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'mappings',
      label: 'Field Mappings',
      type: 'category',
      children: [
        {
          id: 'mapping-1',
          label: 'ssl_merchant_id → merchant_id',
          type: 'mapping',
          confidence: 0.95,
          description: 'Direct field mapping'
        },
        {
          id: 'mapping-2',
          label: 'ssl_amount → amount',
          type: 'mapping',
          confidence: 0.87,
          description: 'Amount conversion (dollars to cents)'
        },
        {
          id: 'mapping-3',
          label: 'ssl_card_number → payment_method.card.number',
          type: 'mapping',
          confidence: 0.92,
          description: 'Nested field mapping'
        }
      ]
    }
  ];

  constructor(private context: vscode.ExtensionContext) {
    // Commands are registered by CommandRegistry
  }

  getTreeItem(element: DocTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    
    if (element.children && element.children.length > 0) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Set icons and context values based on type
    switch (element.type) {
      case 'spec':
        treeItem.iconPath = new vscode.ThemeIcon('book');
        treeItem.contextValue = 'apiSpec';
        break;
      case 'category':
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'endpoint':
        treeItem.iconPath = new vscode.ThemeIcon('globe');
        treeItem.tooltip = element.description;
        treeItem.contextValue = 'apiEndpoint';
        break;
      case 'field':
        const fieldIcon = element.required ? 'symbol-field' : 'symbol-property';
        treeItem.iconPath = new vscode.ThemeIcon(fieldIcon);
        treeItem.tooltip = `${element.dataType} - ${element.description}`;
        treeItem.contextValue = 'apiField';
        break;
      case 'mapping':
        treeItem.iconPath = new vscode.ThemeIcon('arrow-right');
        const confidencePercent = Math.round((element.confidence || 0) * 100);
        treeItem.tooltip = `${element.description} (${confidencePercent}% confidence)`;
        treeItem.contextValue = 'fieldMapping';
        break;
    }

    // Add confidence indicator for mappings
    if (element.type === 'mapping' && element.confidence) {
      const confidencePercent = Math.round(element.confidence * 100);
      treeItem.description = `${confidencePercent}%`;
    }

    // Add data type for fields
    if (element.type === 'field' && element.dataType) {
      treeItem.description = element.dataType;
    }

    return treeItem;
  }

  getChildren(element?: DocTreeItem): Thenable<DocTreeItem[]> {
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

  getParent(element: DocTreeItem): vscode.ProviderResult<DocTreeItem> {
    return null;
  }

  // Methods for documentation management
  async addSpec(): Promise<void> {
    Logger.buttonClicked('addSpec');
    
    const specType = await vscode.window.showQuickPick(
      ['Converge API', 'Elavon L1 API'],
      { placeHolder: 'Select specification type to add' }
    );

    if (!specType) {
      return;
    }

    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select OpenAPI Specification',
      filters: {
        'OpenAPI Files': ['json', 'yaml', 'yml']
      }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
      vscode.window.showInformationMessage(`${specType} specification loaded: ${fileUri[0].fsPath}`);
      this.refresh();
    }
  }

  async compareSpecs(): Promise<void> {
    Logger.buttonClicked('compareSpecs');
    vscode.window.showInformationMessage('Specifications compared - 85% field compatibility detected (mock)');
  }

  async generateMapping(): Promise<void> {
    Logger.buttonClicked('generateMapping');
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating field mappings...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      
      // Simulate mapping generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      progress.report({ increment: 100 });
      
      vscode.window.showInformationMessage('Mapping generated - 12 field mappings created with 0.87 average confidence (mock)');
      this.refresh();
    });
  }
}