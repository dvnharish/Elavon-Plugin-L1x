import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface MigrationTreeItem {
  id: string;
  label: string;
  type: 'category' | 'migration' | 'file' | 'change' | 'audit';
  status?: 'pending' | 'generated' | 'applied' | 'failed' | 'rolled-back';
  children?: MigrationTreeItem[];
  filePath?: string;
  originalCode?: string;
  generatedCode?: string;
  confidence?: number;
  timestamp?: Date;
}

export class MigrationPanel implements vscode.TreeDataProvider<MigrationTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MigrationTreeItem | undefined | null | void> = new vscode.EventEmitter<MigrationTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MigrationTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private mockData: MigrationTreeItem[] = [
    {
      id: 'pending-migrations',
      label: 'Pending Migrations',
      type: 'category',
      children: [
        {
          id: 'migration-1',
          label: 'payment-service.ts',
          type: 'migration',
          status: 'pending',
          filePath: 'src/services/payment-service.ts',
          children: [
            {
              id: 'change-1-1',
              label: 'Line 45: processPayment() → L1 API',
              type: 'change',
              confidence: 0.92
            },
            {
              id: 'change-1-2',
              label: 'Line 78: refundPayment() → L1 API',
              type: 'change',
              confidence: 0.88
            }
          ]
        },
        {
          id: 'migration-2',
          label: 'checkout.component.ts',
          type: 'migration',
          status: 'pending',
          filePath: 'src/components/checkout.component.ts',
          children: [
            {
              id: 'change-2-1',
              label: 'Line 23: ConvergeAPI.charge() → L1 API',
              type: 'change',
              confidence: 0.95
            }
          ]
        }
      ]
    },
    {
      id: 'generated-migrations',
      label: 'Generated Previews',
      type: 'category',
      children: [
        {
          id: 'generated-1',
          label: 'auth-service.js',
          type: 'migration',
          status: 'generated',
          filePath: 'src/auth/auth-service.js',
          confidence: 0.89,
          children: [
            {
              id: 'gen-change-1',
              label: 'Line 12: authenticate() → L1 OAuth',
              type: 'change',
              confidence: 0.89
            }
          ]
        }
      ]
    },
    {
      id: 'applied-migrations',
      label: 'Applied Migrations',
      type: 'category',
      children: [
        {
          id: 'applied-1',
          label: 'config.js',
          type: 'migration',
          status: 'applied',
          filePath: 'src/config.js',
          timestamp: new Date('2024-01-15T10:30:00'),
          children: [
            {
              id: 'applied-change-1',
              label: 'Line 5: API endpoint updated',
              type: 'change',
              confidence: 1.0
            }
          ]
        }
      ]
    },
    {
      id: 'audit-trail',
      label: 'Audit Trail',
      type: 'category',
      children: [
        {
          id: 'audit-1',
          label: '2024-01-15 10:30 - config.js applied',
          type: 'audit',
          status: 'applied',
          timestamp: new Date('2024-01-15T10:30:00')
        },
        {
          id: 'audit-2',
          label: '2024-01-14 15:45 - utils.js rolled back',
          type: 'audit',
          status: 'rolled-back',
          timestamp: new Date('2024-01-14T15:45:00')
        }
      ]
    }
  ];

  constructor(private context: vscode.ExtensionContext) {
    // Commands are registered by CommandRegistry
  }

  getTreeItem(element: MigrationTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    
    if (element.children && element.children.length > 0) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Set icons and context values based on type and status
    switch (element.type) {
      case 'category':
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'migration':
        this.setMigrationIcon(treeItem, element.status);
        treeItem.contextValue = `migration-${element.status}`;
        if (element.confidence) {
          const confidencePercent = Math.round(element.confidence * 100);
          treeItem.description = `${confidencePercent}%`;
        }
        break;
      case 'change':
        treeItem.iconPath = new vscode.ThemeIcon('diff');
        treeItem.contextValue = 'migrationChange';
        if (element.confidence) {
          const confidencePercent = Math.round(element.confidence * 100);
          treeItem.description = `${confidencePercent}%`;
        }
        break;
      case 'file':
        treeItem.iconPath = new vscode.ThemeIcon('file-code');
        treeItem.contextValue = 'migrationFile';
        break;
      case 'audit':
        this.setAuditIcon(treeItem, element.status);
        treeItem.contextValue = 'auditEntry';
        break;
    }

    return treeItem;
  }

  private setMigrationIcon(treeItem: vscode.TreeItem, status?: string): void {
    switch (status) {
      case 'pending':
        treeItem.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
        break;
      case 'generated':
        treeItem.iconPath = new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.blue'));
        break;
      case 'applied':
        treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        break;
      case 'failed':
        treeItem.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        break;
      case 'rolled-back':
        treeItem.iconPath = new vscode.ThemeIcon('discard', new vscode.ThemeColor('charts.orange'));
        break;
      default:
        treeItem.iconPath = new vscode.ThemeIcon('file');
    }
  }

  private setAuditIcon(treeItem: vscode.TreeItem, status?: string): void {
    switch (status) {
      case 'applied':
        treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        break;
      case 'rolled-back':
        treeItem.iconPath = new vscode.ThemeIcon('discard', new vscode.ThemeColor('charts.orange'));
        break;
      default:
        treeItem.iconPath = new vscode.ThemeIcon('history');
    }
  }

  getChildren(element?: MigrationTreeItem): Thenable<MigrationTreeItem[]> {
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

  getParent(element: MigrationTreeItem): vscode.ProviderResult<MigrationTreeItem> {
    return null;
  }

  // Methods for migration management
  async generatePreview(migrationId?: string): Promise<void> {
    Logger.buttonClicked('generatePreview');
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating migration preview...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      progress.report({ increment: 100 });
      
      // Move migration from pending to generated
      this.moveMigrationToGenerated(migrationId);
      vscode.window.showInformationMessage('Preview generated successfully (mock data)');
    });
  }

  async applyMigration(migrationId: string): Promise<void> {
    Logger.buttonClicked('apply');
    
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to apply this migration?',
      { modal: true },
      'Apply'
    );

    if (confirm === 'Apply') {
      // Move migration from generated to applied
      this.moveMigrationToApplied(migrationId);
      vscode.window.showInformationMessage('Migration applied successfully (mock operation)');
    }
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    Logger.buttonClicked('rollback');
    
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to rollback this migration?',
      { modal: true },
      'Rollback'
    );

    if (confirm === 'Rollback') {
      // Add to audit trail and remove from applied
      this.addToAuditTrail(migrationId, 'rolled-back');
      vscode.window.showInformationMessage('Migration rolled back successfully (mock operation)');
    }
  }

  private moveMigrationToGenerated(migrationId?: string): void {
    // Mock implementation - move first pending migration to generated
    const pendingCategory = this.mockData.find(item => item.id === 'pending-migrations');
    const generatedCategory = this.mockData.find(item => item.id === 'generated-migrations');
    
    if (pendingCategory?.children && generatedCategory?.children && pendingCategory.children.length > 0) {
      const migration = pendingCategory.children.shift();
      if (migration) {
        migration.status = 'generated';
        generatedCategory.children.push(migration);
        this.refresh();
      }
    }
  }

  private moveMigrationToApplied(migrationId: string): void {
    // Mock implementation
    const generatedCategory = this.mockData.find(item => item.id === 'generated-migrations');
    const appliedCategory = this.mockData.find(item => item.id === 'applied-migrations');
    
    if (generatedCategory?.children && appliedCategory?.children) {
      const migrationIndex = generatedCategory.children.findIndex(m => m.id === migrationId);
      if (migrationIndex >= 0) {
        const migrationArray = generatedCategory.children.splice(migrationIndex, 1);
        if (migrationArray.length > 0 && migrationArray[0]) {
          const migration = migrationArray[0];
          migration.status = 'applied';
          migration.timestamp = new Date();
          appliedCategory.children.push(migration);
          this.addToAuditTrail(migrationId, 'applied');
          this.refresh();
        }
      }
    }
  }

  private addToAuditTrail(migrationId: string, status: string): void {
    const auditCategory = this.mockData.find(item => item.id === 'audit-trail');
    if (auditCategory?.children) {
      const auditEntry: MigrationTreeItem = {
        id: `audit-${Date.now()}`,
        label: `${new Date().toLocaleString()} - ${migrationId} ${status}`,
        type: 'audit',
        status: status as any,
        timestamp: new Date()
      };
      auditCategory.children.unshift(auditEntry);
      this.refresh();
    }
  }
}