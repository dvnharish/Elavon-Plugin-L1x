import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { CodeScannerService, ScanResult, ScanOptions, ScanProgress } from '../services/CodeScannerService';
import { FileStandardAnalyzer } from '../services/FileStandardAnalyzer';
import { ProjectTreeService, ProjectTreeNode, ProjectScanSummary } from '../services/ProjectTreeService';
import { ApiMappingService, ApiMapping } from '../services/ApiMappingService';
import { StandardDetectionResult, EnhancedScanResult } from '../types/contextMenu';
import { SERVICE_TOKENS } from '../di/container';
import { container } from '../extension';
import { FileContext, RedactionResult } from '../types/copilot';
import { CopilotErrorHandler } from '../utils/CopilotErrorHandler';

export interface ScanTreeItem {
  id: string;
  label: string;
  type: 'endpoint' | 'file' | 'occurrence' | 'summary' | 'config' | 'folder' | 'method' | 'class' | 'variable' | 'project-summary';
  children?: ScanTreeItem[];
  filePath?: string | undefined;
  line?: number | undefined;
  snippet?: string;
  confidence?: number;
  endpointType?: string;
  scanResult?: ScanResult;
  projectNode?: ProjectTreeNode;
  migrationSuggestions?: string[];
}

export class ScanPanel implements vscode.TreeDataProvider<ScanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ScanTreeItem | undefined | null | void> = new vscode.EventEmitter<ScanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ScanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private scannerService: CodeScannerService;
  private fileStandardAnalyzer: FileStandardAnalyzer;
  private projectTreeService: ProjectTreeService;
  private apiMappingService: ApiMappingService;
  private scanResults: ScanResult[] = [];
  private enhancedResults: Map<string, EnhancedScanResult> = new Map();
  private projectTree: ProjectTreeNode | null = null;
  private projectSummary: ProjectScanSummary | null = null;
  private isScanning = false;
  private useEnhancedView = true;
  private lastScanOptions: ScanOptions = {
    mode: 'regex',
    languages: ['javascript', 'java', 'csharp', 'python'],
    excludePatterns: [],
    includePatterns: []
  };

  private breadcrumbInfo: string = '';
  private currentScanType: 'regex' | 'ast' | 'dto' | 'openapi' = 'regex';

  constructor(private context: vscode.ExtensionContext) {
    this.scannerService = new CodeScannerService();
    this.fileStandardAnalyzer = new FileStandardAnalyzer();
    this.projectTreeService = new ProjectTreeService();
    this.apiMappingService = new ApiMappingService();
    this.setupScannerEvents();
  }

  private setupScannerEvents(): void {
    this.scannerService.on('progress', (progress: ScanProgress) => {
      // Update status bar or show progress notification
      if (progress.isComplete) {
        this.isScanning = false;
        vscode.window.showInformationMessage(
          `Scan completed! Found ${this.scanResults.length} matches in ${progress.processedFiles} files.`
        );
        this.refresh();
      }
    });
  }

  getTreeItem(element: ScanTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    
    if (element.children && element.children.length > 0) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Set icons and context based on type
    switch (element.type) {
      case 'summary':
        if (element.id === 'breadcrumb') {
          treeItem.iconPath = new vscode.ThemeIcon('location');
          treeItem.contextValue = 'scanBreadcrumb';
        } else if (element.id === 'empty-state') {
          treeItem.iconPath = new vscode.ThemeIcon('search');
          treeItem.contextValue = 'scanEmptyState';
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('info');
          treeItem.contextValue = 'scanSummary';
        }
        break;
      case 'endpoint':
        treeItem.iconPath = new vscode.ThemeIcon('globe');
        treeItem.contextValue = 'scanEndpoint';
        break;
      case 'file':
        // Check if file has standard detection result for icon
        const enhancedResult = element.filePath ? this.enhancedResults.get(element.filePath) : null;
        if (enhancedResult?.standardDetection) {
          const standard = enhancedResult.standardDetection.standard;
          switch (standard) {
            case 'converge':
              treeItem.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.red'));
              break;
            case 'elavon':
              treeItem.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.green'));
              break;
            case 'mixed':
              treeItem.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.yellow'));
              break;
            default:
              treeItem.iconPath = new vscode.ThemeIcon('file-code');
          }
          
          // Add standard info to tooltip
          const confidence = Math.round(enhancedResult.standardDetection.confidence);
          treeItem.tooltip = `Standard: ${standard.toUpperCase()} (${confidence}% confidence)`;
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('file-code');
        }
        
        treeItem.contextValue = 'scanFile';
        if (element.filePath) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, element.filePath);
            treeItem.resourceUri = absolutePath;
            // Add command to open file
            treeItem.command = {
              command: 'vscode.open',
              title: 'Open File',
              arguments: [absolutePath]
            };
          }
        }
        break;
      case 'occurrence':
        // Set icon based on confidence level
        if (element.confidence && element.confidence > 0.8) {
          treeItem.iconPath = new vscode.ThemeIcon('check');
        } else if (element.confidence && element.confidence > 0.6) {
          treeItem.iconPath = new vscode.ThemeIcon('warning');
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('question');
        }
        
        treeItem.contextValue = 'scanOccurrence';
        
        // Enhanced tooltip with confidence, endpoint type, and migration info
        const confidencePercent = element.confidence ? Math.round(element.confidence * 100) : 0;
        let tooltip = `Confidence: ${confidencePercent}% | Type: ${element.endpointType || 'unknown'}`;
        
        // Add API mapping info if available
        if (element.scanResult?.apiMapping) {
          const mapping = element.scanResult.apiMapping;
          tooltip += ` | Maps to: ${mapping.elavonEndpoint} (${Math.round(mapping.confidence * 100)}%)`;
        }
        
        tooltip += ` | ${element.snippet || 'No snippet available'}`;
        treeItem.tooltip = tooltip;
        
        // Add command to go to line
        if (element.filePath && element.line) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, element.filePath);
            treeItem.command = {
              command: 'vscode.open',
              title: 'Go to Line',
              arguments: [
                absolutePath,
                { selection: new vscode.Range(element.line - 1, 0, element.line - 1, 0) }
              ]
            };
          }
        }
        break;
      case 'config':
        treeItem.iconPath = new vscode.ThemeIcon('settings-gear');
        treeItem.contextValue = 'scanConfig';
        break;
      case 'project-summary':
        treeItem.iconPath = new vscode.ThemeIcon('graph');
        treeItem.contextValue = 'projectSummary';
        break;
      case 'folder':
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        treeItem.contextValue = 'projectFolder';
        break;
      case 'method':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-method');
        treeItem.contextValue = 'projectMethod';
        // Add command to go to method
        if (element.filePath && element.line) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, element.filePath);
            treeItem.command = {
              command: 'vscode.open',
              title: 'Go to Method',
              arguments: [
                absolutePath,
                { selection: new vscode.Range(element.line - 1, 0, element.line - 1, 0) }
              ]
            };
          }
        }
        break;
      case 'class':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-class');
        treeItem.contextValue = 'projectClass';
        // Add command to go to class
        if (element.filePath && element.line) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, element.filePath);
            treeItem.command = {
              command: 'vscode.open',
              title: 'Go to Class',
              arguments: [
                absolutePath,
                { selection: new vscode.Range(element.line - 1, 0, element.line - 1, 0) }
              ]
            };
          }
        }
        break;
      case 'variable':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-variable');
        treeItem.contextValue = 'projectVariable';
        // Enhanced tooltip for variables with mapping info
        if (element.scanResult?.apiMapping) {
          const mapping = element.scanResult.apiMapping;
          treeItem.tooltip = `${element.scanResult.variableName} → ${mapping.elavonEndpoint} (${Math.round(mapping.confidence * 100)}% confidence)`;
        }
        // Add command to go to variable
        if (element.filePath && element.line) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, element.filePath);
            treeItem.command = {
              command: 'vscode.open',
              title: 'Go to Variable',
              arguments: [
                absolutePath,
                { selection: new vscode.Range(element.line - 1, 0, element.line - 1, 0) }
              ]
            };
          }
        }
        break;
    }

    return treeItem;
  }

  getChildren(element?: ScanTreeItem): Thenable<ScanTreeItem[]> {
    if (!element) {
      // Return root items - either scan results or empty with instructions
      if (this.scanResults.length > 0) {
        return Promise.resolve(this.buildTreeFromResults());
      } else {
        return Promise.resolve([{
          id: 'empty-state',
          label: 'No scan results. Click the Scan Project button (🔍) to start scanning.',
          type: 'summary'
        }]);
      }
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

  private buildTreeFromResults(): ScanTreeItem[] {
    if (this.scanResults.length === 0) {
      return [{
        id: 'no-results',
        label: 'No Converge API usage found',
        type: 'summary'
      }];
    }

    // Build enhanced project tree if enabled
    if (this.useEnhancedView) {
      return this.buildEnhancedProjectTree();
    }

    // Fallback to original grouped view
    return this.buildGroupedView();
  }

  private buildEnhancedProjectTree(): ScanTreeItem[] {
    // Generate project tree and summary
    this.projectTree = this.projectTreeService.buildProjectTree(this.scanResults);
    this.projectSummary = this.projectTreeService.generateProjectSummary(this.scanResults);

    const treeItems: ScanTreeItem[] = [];

    // Add breadcrumb item at the top
    if (this.breadcrumbInfo) {
      treeItems.push({
        id: 'breadcrumb',
        label: `📍 ${this.breadcrumbInfo}`,
        type: 'summary'
      });
    }

    // Add enhanced summary
    treeItems.push({
      id: 'enhanced-summary',
      label: `📊 ${this.projectSummary.totalConvergeReferences} references in ${this.projectSummary.totalFiles} files (${this.projectSummary.migrationComplexity.toUpperCase()} complexity)`,
      type: 'project-summary',
      children: this.buildSummaryChildren()
    });

    // Convert project tree to scan tree items
    if (this.projectTree) {
      const projectTreeItems = this.convertProjectTreeToScanTree(this.projectTree);
      treeItems.push(...projectTreeItems.children || []);
    }

    return treeItems;
  }

  private buildGroupedView(): ScanTreeItem[] {
    // Group results by endpoint type
    const groupedResults = this.groupResultsByEndpointType();
    const treeItems: ScanTreeItem[] = [];

    // Add summary item
    treeItems.push({
      id: 'summary',
      label: `Found ${this.scanResults.length} matches in ${this.getUniqueFileCount()} files`,
      type: 'summary'
    });

    // Add grouped endpoint items
    for (const [endpointType, results] of Object.entries(groupedResults)) {
      const endpointItem: ScanTreeItem = {
        id: `endpoint-${endpointType}`,
        label: `${this.capitalizeEndpointType(endpointType)} (${results.length})`,
        type: 'endpoint',
        children: this.buildFileTreeFromResults(results)
      };
      treeItems.push(endpointItem);
    }

    return treeItems;
  }

  private buildSummaryChildren(): ScanTreeItem[] {
    if (!this.projectSummary) return [];

    const summaryItems: ScanTreeItem[] = [];

    // Migration complexity and time
    summaryItems.push({
      id: 'migration-time',
      label: `⏱️ Estimated migration time: ${this.projectSummary.estimatedMigrationTime}`,
      type: 'summary'
    });

    // Language distribution
    const languages = Object.entries(this.projectSummary.languageDistribution)
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(', ');
    summaryItems.push({
      id: 'languages',
      label: `💻 Languages: ${languages}`,
      type: 'summary'
    });

    // Endpoint types
    const endpointTypes = Object.entries(this.projectSummary.endpointsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    if (endpointTypes) {
      summaryItems.push({
        id: 'endpoint-types',
        label: `🌐 Endpoints: ${endpointTypes}`,
        type: 'summary'
      });
    }

    // Variable types
    const variableTypes = Object.entries(this.projectSummary.variablesByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    if (variableTypes) {
      summaryItems.push({
        id: 'variable-types',
        label: `🔧 Variables: ${variableTypes}`,
        type: 'summary'
      });
    }

    return summaryItems;
  }

  private convertProjectTreeToScanTree(projectNode: ProjectTreeNode): ScanTreeItem {
    const scanTreeItem: ScanTreeItem = {
      id: projectNode.id,
      label: projectNode.label,
      type: projectNode.type as any,
      filePath: projectNode.filePath || undefined,
      line: projectNode.line || undefined,
      confidence: projectNode.confidence,
      projectNode: projectNode,
      migrationSuggestions: projectNode.migrationSuggestions,
      children: projectNode.children.map(child => this.convertProjectTreeToScanTree(child))
    };

    // Add scan result if available (for leaf nodes)
    if (projectNode.scanResults.length === 1) {
      const scanResult = projectNode.scanResults[0];
      if (scanResult) {
        scanTreeItem.scanResult = scanResult;
        scanTreeItem.snippet = scanResult.snippet;
        scanTreeItem.endpointType = scanResult.endpointType;
      }
    }

    return scanTreeItem;
  }

  private groupResultsByEndpointType(): Record<string, ScanResult[]> {
    const grouped: Record<string, ScanResult[]> = {};
    
    for (const result of this.scanResults) {
      const type = result.endpointType || 'unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type]!.push(result);
    }
    
    return grouped;
  }

  private buildFileTreeFromResults(results: ScanResult[]): ScanTreeItem[] {
    const fileGroups: Record<string, ScanResult[]> = {};
    
    // Group by file path
    for (const result of results) {
      if (!fileGroups[result.filePath]) {
        fileGroups[result.filePath] = [];
      }
      fileGroups[result.filePath]!.push(result);
    }

    // Build file tree items
    return Object.entries(fileGroups).map(([filePath, fileResults]) => {
      const fileName = filePath.split('/').pop() || filePath;
      return {
        id: `file-${filePath}`,
        label: `${fileName} (${fileResults.length})`,
        type: 'file',
        filePath: filePath,
        children: fileResults.map(result => {
          let label = `Line ${result.line}: ${result.matchedText}`;
          
          // Add additional context based on scan type
          if (result.className) {
            label = `Line ${result.line}: Class ${result.className}`;
          } else if (result.methodName) {
            label = `Line ${result.line}: Method ${result.methodName}`;
          } else if (result.dtoName) {
            label = `Line ${result.line}: DTO ${result.dtoName}`;
          } else if (result.endpointUrl) {
            label = `Line ${result.line}: ${result.endpointUrl}`;
          }

          return {
            id: result.id,
            label,
            type: 'occurrence' as const,
            line: result.line,
            snippet: result.snippet,
            confidence: result.confidence,
            endpointType: result.endpointType,
            scanResult: result
          };
        })
      };
    });
  }

  private getUniqueFileCount(): number {
    const uniqueFiles = new Set(this.scanResults.map(r => r.filePath));
    return uniqueFiles.size;
  }

  private capitalizeEndpointType(type: string): string {
    switch (type) {
      case 'transaction': return 'Transactions';
      case 'payment': return 'Payments';
      case 'refund': return 'Refunds';
      case 'auth': return 'Authentication';
      case 'dto': return 'Data Transfer Objects';
      case 'endpoint': return 'API Endpoints';
      case 'class': return 'Service Classes';
      default: return 'Other';
    }
  }

  // Public methods for command handlers
  async scanProject(options?: Partial<ScanOptions>): Promise<void> {
    if (this.isScanning) {
      vscode.window.showWarningMessage('Scan already in progress');
      return;
    }

    Logger.buttonClicked('scanProject');

    // If no options provided, use default regex scan
    const scanOptions: ScanOptions = options ? {
      ...this.lastScanOptions,
      ...options
    } : {
      mode: 'regex',
      languages: ['javascript', 'java', 'csharp', 'python', 'php', 'ruby', 'vb'],
      excludePatterns: [],
      includePatterns: []
    };

    // Update current scan type for breadcrumb
    this.currentScanType = scanOptions.mode;

    this.isScanning = true;
    
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Scanning project for Converge API usage...',
        cancellable: true
      }, async (progress, token) => {
        
        token.onCancellationRequested(() => {
          this.scannerService.cancelScan();
        });

        // Listen for progress updates
        const progressHandler = (scanProgress: ScanProgress) => {
          progress.report({
            increment: scanProgress.percentage,
            message: `Processing ${scanProgress.currentFile} (${scanProgress.processedFiles}/${scanProgress.totalFiles})`
          });
        };

        this.scannerService.on('progress', progressHandler);

        try {
          this.scanResults = await this.scannerService.scanProject(scanOptions);
          this.lastScanOptions = scanOptions;
          
          // If using OpenAPI mode, refresh API mappings
          if (scanOptions.mode === 'openapi') {
            await this.scannerService.refreshApiMappings();
          }
        } finally {
          this.scannerService.off('progress', progressHandler);
        }
      });

      // Update breadcrumb info
      this.updateBreadcrumb(scanOptions);
      this.refresh();
      
    } catch (error) {
      this.isScanning = false;
      vscode.window.showErrorMessage(`Scan failed: ${error}`);
      Logger.error('Scan failed', error as Error);
    }
  }

  private updateBreadcrumb(options: ScanOptions): void {
    const scanTypeLabel = this.getScanTypeLabel(options.mode);
    const languageCount = options.languages.length;
    const resultCount = this.scanResults.length;
    const fileCount = this.getUniqueFileCount();
    
    this.breadcrumbInfo = `${scanTypeLabel} • ${languageCount} languages • ${resultCount} matches in ${fileCount} files`;
  }

  private getScanTypeLabel(mode: 'regex' | 'ast' | 'dto' | 'openapi'): string {
    switch (mode) {
      case 'regex': return 'Regex Scan';
      case 'ast': return 'Business Logic Scan';
      case 'dto': return 'DTO Scan';
      case 'openapi': return 'OpenAPI-Aware Scan';
      default: return 'Unknown Scan';
    }
  }

  async configureScan(): Promise<void> {
    Logger.buttonClicked('configureScan');

    // Show scan mode selection
    const modeChoice = await vscode.window.showQuickPick([
      { label: 'Regex Scan', description: 'Find Converge endpoints, URLs, and DTOs using regex patterns (Default)', value: 'regex' },
      { label: 'Scan Converge Business Logic', description: 'Analyze where API calls happen, find service classes and endpoint configurations', value: 'ast' },
      { label: 'DTO Scan', description: 'Specifically find Data Transfer Objects and models', value: 'dto' },
      { label: 'OpenAPI-Aware Scan', description: 'Enhanced scan using OpenAPI specifications for intelligent mapping', value: 'openapi' }
    ], {
      placeHolder: 'Select scan mode (Default: Regex Scan)'
    });

    if (!modeChoice) {
      return;
    }

    // Show language selection
    const languageChoices = await vscode.window.showQuickPick([
      { label: 'JavaScript/TypeScript', value: 'javascript', picked: this.lastScanOptions.languages.includes('javascript') },
      { label: 'Java', value: 'java', picked: this.lastScanOptions.languages.includes('java') },
      { label: 'C#', value: 'csharp', picked: this.lastScanOptions.languages.includes('csharp') },
      { label: 'Python', value: 'python', picked: this.lastScanOptions.languages.includes('python') },
      { label: 'PHP', value: 'php', picked: this.lastScanOptions.languages.includes('php') },
      { label: 'Ruby', value: 'ruby', picked: this.lastScanOptions.languages.includes('ruby') },
      { label: 'VB.NET', value: 'vb', picked: this.lastScanOptions.languages.includes('vb') }
    ], {
      placeHolder: 'Select languages to scan',
      canPickMany: true
    });

    if (!languageChoices || languageChoices.length === 0) {
      return;
    }

    // Update scan options
    this.lastScanOptions = {
      mode: modeChoice.value as 'regex' | 'ast' | 'dto' | 'openapi',
      languages: languageChoices.map(choice => choice.value),
      excludePatterns: this.lastScanOptions.excludePatterns,
      includePatterns: this.lastScanOptions.includePatterns,
      useOpenApiMapping: modeChoice.value === 'openapi'
    };

    vscode.window.showInformationMessage(
      `Scan configured: ${modeChoice.label} for ${languageChoices.length} language(s)`
    );
  }

  async reScan(): Promise<void> {
    Logger.buttonClicked('reScan');
    await this.scanProject();
  }

  viewSummary(): void {
    Logger.buttonClicked('viewSummary');
    
    if (this.scanResults.length === 0) {
      vscode.window.showInformationMessage('No scan results available. Run a scan first.');
      return;
    }

    const summary = this.generateSummary();
    vscode.window.showInformationMessage(summary);
  }

  private generateSummary(): string {
    const totalMatches = this.scanResults.length;
    const uniqueFiles = this.getUniqueFileCount();
    const endpointTypes = Object.keys(this.groupResultsByEndpointType());
    
    const highConfidenceMatches = this.scanResults.filter(r => r.confidence > 0.7).length;
    
    return `Scan Summary: ${totalMatches} matches in ${uniqueFiles} files. ` +
           `Endpoint types: ${endpointTypes.join(', ')}. ` +
           `High confidence matches: ${highConfidenceMatches}`;
  }

  clearResults(): void {
    Logger.buttonClicked('clearResults');
    this.scanResults = [];
    this.projectTree = null;
    this.projectSummary = null;
    this.breadcrumbInfo = '';
    this.refresh();
    vscode.window.showInformationMessage('Scan results cleared');
  }

  toggleView(): void {
    Logger.buttonClicked('toggleView');
    this.useEnhancedView = !this.useEnhancedView;
    this.refresh();
    
    const viewType = this.useEnhancedView ? 'Enhanced Project Tree' : 'Simple Grouped View';
    vscode.window.showInformationMessage(`Switched to ${viewType}`);
  }

  // New Context Menu Option: Generate L1 Equivalent Code
  async generateL1EquivalentCode(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('generateL1EquivalentCode');
    
    if (!item.scanResult?.apiMapping) {
      vscode.window.showWarningMessage('No API mapping available for this item');
      return;
    }

    try {
      const mapping = item.scanResult.apiMapping;
      const language = item.scanResult.language;
      
      // Generate the equivalent L1 code
      const migrationCode = this.scannerService.getApiMappings().length > 0 
        ? await this.generateMigrationCodeForItem(item, language)
        : this.generateBasicMigrationCode(mapping, language);

      // Show the generated code in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: migrationCode,
        language: this.getVSCodeLanguageId(language)
      });

      await vscode.window.showTextDocument(doc);
      
      vscode.window.showInformationMessage(
        `Generated L1 equivalent code for ${mapping.convergeEndpoint} → ${mapping.elavonEndpoint}`
      );
    } catch (error) {
      Logger.error('Failed to generate L1 equivalent code', error as Error);
      vscode.window.showErrorMessage(`Failed to generate L1 code: ${error}`);
    }
  }

  // New Context Menu Option: Show API Mapping
  async showApiMapping(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('showApiMapping');
    
    if (!item.scanResult?.apiMapping) {
      vscode.window.showWarningMessage('No API mapping available for this item');
      return;
    }

    const mapping = item.scanResult.apiMapping;
    
    // Create a detailed mapping view
    const mappingInfo = `
# Converge → L1 (Elavon) API Mapping

## Source (Converge)
- **Endpoint**: ${mapping.convergeEndpoint}
- **Type**: ${item.scanResult.endpointType}

## Target (Elavon L1)
- **Endpoint**: ${mapping.elavonEndpoint}
- **Confidence**: ${Math.round(mapping.confidence * 100)}%
- **Mapping Type**: ${mapping.mappingType}

## Migration Notes
${mapping.migrationNotes.map(note => `- ${note}`).join('\n')}

## Field Mappings
${mapping.fieldMappings.length > 0 
  ? mapping.fieldMappings.map(fm => 
      `- **${fm.sourceField}** → **${fm.targetField}** (${Math.round(fm.confidence * 100)}% confidence)${fm.transformationRequired ? ' *[Transformation Required]*' : ''}`
    ).join('\n')
  : 'No specific field mappings available'
}

## Transformation Required
${mapping.transformationRequired ? '✅ Yes - Code changes needed' : '❌ No - Direct mapping possible'}
`;

    // Show in a new markdown document
    const doc = await vscode.workspace.openTextDocument({
      content: mappingInfo,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
  }

  // New Context Menu Option: Generate L1 DTOs/POJOs
  async generateL1DTOs(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('generateL1DTOs');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available');
      return;
    }

    try {
      const language = item.scanResult?.language || this.detectLanguageFromPath(item.filePath);
      const dtoCode = await this.generateDTOsFromOpenAPI(language);

      // Show the generated DTOs in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: dtoCode,
        language: this.getVSCodeLanguageId(language)
      });

      await vscode.window.showTextDocument(doc);
      
      vscode.window.showInformationMessage('Generated L1 DTOs/POJOs from OpenAPI specification');
    } catch (error) {
      Logger.error('Failed to generate L1 DTOs', error as Error);
      vscode.window.showErrorMessage(`Failed to generate DTOs: ${error}`);
    }
  }

  // New Context Menu Option: Open Documentation
  async openDocumentation(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('openDocumentation');
    
    const mapping = item.scanResult?.apiMapping;
    let documentationUrl = 'https://developer.elavon.com/docs/epg';

    if (mapping) {
      // Try to find specific documentation for the endpoint
      if (mapping.elavonEndpoint.includes('transaction')) {
        documentationUrl = 'https://developer.elavon.com/docs/epg/transactions';
      } else if (mapping.elavonEndpoint.includes('payment')) {
        documentationUrl = 'https://developer.elavon.com/docs/epg/payments';
      } else if (mapping.elavonEndpoint.includes('refund')) {
        documentationUrl = 'https://developer.elavon.com/docs/epg/refunds';
      }
    }

    await vscode.env.openExternal(vscode.Uri.parse(documentationUrl));
  }

  // Helper method to generate migration code for an item
  private async generateMigrationCodeForItem(item: ScanTreeItem, language: string): Promise<string> {
    if (!item.scanResult?.apiMapping) {
      throw new Error('No API mapping available');
    }

    const mapping = item.scanResult.apiMapping;
    
    // Use the ApiMappingService to generate the code
    const apiMappingService = new (await import('../services/ApiMappingService')).ApiMappingService();
    return apiMappingService.generateMigrationCode(mapping, language);
  }

  // Helper method for basic migration code generation
  private generateBasicMigrationCode(mapping: ApiMapping, language: string): string {
    return `
// Basic Migration Template
// From: ${mapping.convergeEndpoint}
// To: ${mapping.elavonEndpoint}
// Language: ${language}
// Confidence: ${Math.round(mapping.confidence * 100)}%

// Migration Notes:
${mapping.migrationNotes.map((note: string) => `// ${note}`).join('\n')}

// TODO: Implement the actual migration based on your specific use case
// Refer to the Elavon L1 API documentation for detailed implementation
`;
  }

  // Helper method to generate DTOs from OpenAPI
  private async generateDTOsFromOpenAPI(language: string): Promise<string> {
    // This would integrate with the OpenAPI service to generate DTOs
    // For now, return a template
    return `
// Generated L1 DTOs for ${language}
// Based on Elavon OpenAPI Specification

${language === 'java' ? this.generateJavaDTOs() : 
  language === 'csharp' ? this.generateCSharpDTOs() :
  language === 'typescript' || language === 'javascript' ? this.generateTypeScriptDTOs() :
  this.generateGenericDTOs(language)}
`;
  }

  private generateJavaDTOs(): string {
    return `
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionRequest {
    private Total total;
    private Card card;
    private Boolean doCapture;
    private String customReference;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Total {
    private String amount;
    private String currency;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Card {
    private String number;
    private String expirationMonth;
    private String expirationYear;
    private String securityCode;
    private String holderName;
}

@Data
public class TransactionResponse {
    private String id;
    private String state;
    private Total total;
    private String createdAt;
    private String transactionId;
}
`;
  }

  private generateCSharpDTOs(): string {
    return `
public class TransactionRequest
{
    public Total Total { get; set; }
    public Card Card { get; set; }
    public bool DoCapture { get; set; }
    public string CustomReference { get; set; }
}

public class Total
{
    public string Amount { get; set; }
    public string Currency { get; set; }
}

public class Card
{
    public string Number { get; set; }
    public string ExpirationMonth { get; set; }
    public string ExpirationYear { get; set; }
    public string SecurityCode { get; set; }
    public string HolderName { get; set; }
}

public class TransactionResponse
{
    public string Id { get; set; }
    public string State { get; set; }
    public Total Total { get; set; }
    public string CreatedAt { get; set; }
    public string TransactionId { get; set; }
}
`;
  }

  private generateTypeScriptDTOs(): string {
    return `
export interface TransactionRequest {
  total: Total;
  card: Card;
  doCapture: boolean;
  customReference?: string;
}

export interface Total {
  amount: string;
  currency: string;
}

export interface Card {
  number: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode?: string;
  holderName?: string;
}

export interface TransactionResponse {
  id: string;
  state: string;
  total: Total;
  createdAt: string;
  transactionId: string;
}
`;
  }

  private generateGenericDTOs(language: string): string {
    return `
// Generic DTO template for ${language}
// Adapt these structures to your language's conventions

TransactionRequest:
- total: Total
- card: Card  
- doCapture: boolean
- customReference: string (optional)

Total:
- amount: string
- currency: string

Card:
- number: string
- expirationMonth: string
- expirationYear: string
- securityCode: string (optional)
- holderName: string (optional)

TransactionResponse:
- id: string
- state: string
- total: Total
- createdAt: string
- transactionId: string
`;
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript', 
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.java': 'java',
      '.cs': 'csharp',
      '.py': 'python',
      '.php': 'php',
      '.rb': 'ruby',
      '.vb': 'vb'
    };
    return languageMap[ext] || 'unknown';
  }

  private getVSCodeLanguageId(language: string): string {
    const languageMap: Record<string, string> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'java': 'java',
      'csharp': 'csharp',
      'python': 'python',
      'php': 'php',
      'ruby': 'ruby',
      'vb': 'vb'
    };
    return languageMap[language] || 'plaintext';
  }

  async addToIgnoreList(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('addToIgnoreList');
    
    let pattern = '';
    
    if (item.type === 'file' && item.filePath) {
      pattern = item.filePath;
    } else if (item.type === 'occurrence' && item.scanResult) {
      pattern = item.scanResult.filePath;
    } else {
      vscode.window.showWarningMessage('Cannot determine pattern to ignore');
      return;
    }

    // Add to scanner service ignore list
    this.scannerService.addToIgnoreList(pattern);
    
    // Remove from current results if it matches
    this.scanResults = this.scanResults.filter(result => result.filePath !== pattern);
    this.refresh();
    
    vscode.window.showInformationMessage(`Added ${pattern} to ignore list`);
  }

  // Context Menu Option 1: Detect File Standard
  async detectFileStandard(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('detectFileStandard');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for standard detection');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, item.filePath).fsPath;

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Detecting file standard for ${item.filePath}...`,
        cancellable: false
      }, async () => {
        const result = await this.fileStandardAnalyzer.detectStandard(absolutePath);
        
        // Update enhanced results
        const enhancedResult: EnhancedScanResult = this.enhancedResults.get(item.filePath!) || {
          id: item.id,
          filePath: item.filePath!,
          line: item.line || 0,
          snippet: item.snippet || '',
          matchedText: '',
          confidence: item.confidence || 0,
          endpointType: item.endpointType || 'unknown',
          language: 'unknown',
          migrationHistory: [],
          contextMenuState: {
            operationsInProgress: new Set(),
            cachedResults: new Map(),
            lastUpdated: new Date(),
            availableOperations: []
          }
        };

        enhancedResult.standardDetection = result;
        this.enhancedResults.set(item.filePath!, enhancedResult);

        // Show notification with result
        const confidence = Math.round(result.confidence);
        let message = '';
        
        switch (result.standard) {
          case 'converge':
            message = `✅ File detected as: CONVERGE standard (${confidence}% confidence)`;
            break;
          case 'elavon':
            message = `✅ File detected as: ELAVON L1 standard (${confidence}% confidence)`;
            break;
          case 'mixed':
            const details = result.details;
            message = `⚠️ Mixed standards detected: ${details.convergePercentage}% Converge, ${details.elavonPercentage}% Elavon`;
            break;
          case 'unknown':
            message = `❓ Unable to determine standard - no recognizable patterns found`;
            break;
        }

        vscode.window.showInformationMessage(message);
      });

      // Refresh the tree to show updated icons
      this.refresh();

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to detect file standard: ${error}`);
      Logger.error('File standard detection failed', error as Error);
    }
  }

  // Context Menu Option 2: Migrate to Elavon
  async migrateToElavon(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('migrateToElavon');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for migration');
      return;
    }

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Migrating to Elavon L1...',
        cancellable: true
      }, async (progress, token) => {
        
        // Step 1: Detect file standard if not already done
        progress.report({ increment: 10, message: 'Detecting file standard...' });
        
        let enhancedResult = this.enhancedResults.get(item.filePath!);
        if (!enhancedResult?.standardDetection) {
          Logger.info(`Auto-detecting standard for migration: ${item.filePath}`);
          
          try {
            const standardResult = await this.fileStandardAnalyzer.detectStandard(item.filePath!);
            
            // Create or update enhanced result
            enhancedResult = this.enhancedResults.get(item.filePath!) || {
              id: `enhanced-${item.filePath}`,
              filePath: item.filePath!,
              line: 0,
              snippet: '',
              matchedText: '',
              confidence: 0,
              endpointType: 'unknown',
              language: 'unknown',
              migrationHistory: [],
              contextMenuState: {
                operationsInProgress: new Set(),
                cachedResults: new Map(),
                lastUpdated: new Date(),
                availableOperations: []
              }
            };
            
            enhancedResult.standardDetection = standardResult;
            this.enhancedResults.set(item.filePath!, enhancedResult);
            this.refresh(); // Update the tree to show new icon
            
          } catch (error) {
            Logger.error('Failed to detect file standard for migration', error as Error);
            vscode.window.showErrorMessage('Failed to detect file standard. Please try detecting the standard manually first.');
            return;
          }
        }

        if (token.isCancellationRequested) {
          return;
        }

        // Step 2: Validate that it's a Converge file or mixed file
        const standard = enhancedResult.standardDetection!.standard;
        if (standard === 'elavon') {
          vscode.window.showInformationMessage('This file already appears to use Elavon L1 API patterns. No migration needed.');
          return;
        }
        
        if (standard === 'unknown') {
          vscode.window.showWarningMessage('No Converge API patterns detected in this file. Migration may not be necessary.');
          const proceed = await vscode.window.showInformationMessage(
            'Continue with migration anyway?',
            'Yes, Continue',
            'Cancel'
          );
          if (proceed !== 'Yes, Continue') {
            return;
          }
        }

        progress.report({ increment: 20, message: 'Checking GitHub Copilot availability...' });

        // Step 3: Check GitHub Copilot availability
        const copilotService = container.get(SERVICE_TOKENS.COPILOT_SERVICE);
        const isAvailable = await copilotService.checkAvailability();
        
        if (!isAvailable) {
          const choice = await vscode.window.showErrorMessage(
            'GitHub Copilot is required for automated migration. Please install and authenticate the GitHub Copilot extension.',
            'Install Copilot',
            'Manual Migration Guide'
          );
          
          if (choice === 'Install Copilot') {
            await vscode.env.openExternal(
              vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat')
            );
          } else if (choice === 'Manual Migration Guide') {
            await this.showManualMigrationGuide(item.filePath!, enhancedResult.standardDetection!);
          }
          return;
        }

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 20, message: 'Building migration context...' });

        // Step 4: Build comprehensive migration context
        const contextBuilder = container.get(SERVICE_TOKENS.CONTEXT_BUILDER);
        const fileContext = await contextBuilder.buildContext(item.filePath!);
        
        // Step 5: Create migration-specific prompt
        const promptBuilder = container.get(SERVICE_TOKENS.PROMPT_BUILDER);
        const migrationPrompt = this.buildMigrationPrompt(fileContext, enhancedResult.standardDetection!);

        progress.report({ increment: 20, message: 'Redacting sensitive data...' });

        // Step 6: Redact sensitive information
        const redactionService = container.get(SERVICE_TOKENS.REDACTION_SERVICE);
        const redactionResult = redactionService.redactSensitiveData(fileContext.content);
        fileContext.content = redactionResult.redactedContent;

        progress.report({ increment: 10, message: 'Requesting user consent...' });

        // Step 7: Show consent dialog
        const consentPayload = {
          filePath: item.filePath!,
          contentPreview: redactionResult.redactedContent.substring(0, 500) + (redactionResult.redactedContent.length > 500 ? '...' : ''),
          redactionSummary: redactionResult,
          specSections: fileContext.relevantSpecs
        };

        const userConsent = await import('../ui/ConsentDialog').then(module => 
          module.ConsentDialog.showConsentDialog(consentPayload)
        );
        
        if (!userConsent) {
          Logger.info('User declined migration consent');
          vscode.window.showInformationMessage('Migration cancelled by user');
          return;
        }

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 15, message: 'Sending migration request to GitHub Copilot...' });

        // Step 8: Send migration request to Copilot
        await copilotService.openChatWithPrompt(migrationPrompt);

        progress.report({ increment: 5, message: 'Opening Copilot Chat...' });

        // Step 9: Show success message and offer additional options
        const choice = await vscode.window.showInformationMessage(
          '✅ Migration request sent to GitHub Copilot! Check the Copilot Chat panel for migration suggestions.',
          'Open Chat',
          'View Migration Guide'
        );

        if (choice === 'Open Chat') {
          await vscode.commands.executeCommand('github.copilot.chat.focus');
        } else if (choice === 'View Migration Guide') {
          await this.showMigrationGuide(item.filePath!, enhancedResult.standardDetection!);
        }

        // Step 10: Log successful migration attempt
        this.logMigrationAttempt(fileContext, enhancedResult.standardDetection!, true);
      });

    } catch (error) {
      Logger.error('Migration to Elavon failed', error as Error);
      
      // Log failed migration attempt
      this.logMigrationAttempt(
        { filePath: item.filePath! } as FileContext, 
        this.enhancedResults.get(item.filePath!)?.standardDetection, 
        false, 
        error as Error
      );
      
      // Use centralized error handling
      await CopilotErrorHandler.handleError(error as Error, {
        fileContext: { filePath: item.filePath! } as FileContext
      });
    }
  }

  // Context Menu Option 3: Ask GitHub Copilot for Migration
  async askGitHubCopilot(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('askGitHubCopilot');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for Copilot assistance');
      return;
    }

    try {
      // Step 1: Check GitHub Copilot availability
      const copilotService = container.get(SERVICE_TOKENS.COPILOT_SERVICE);
      const isAvailable = await copilotService.checkAvailability();
      
      if (!isAvailable) {
        vscode.window.showErrorMessage(
          'GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.',
          'Learn More'
        ).then(choice => {
          if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat'));
          }
        });
        return;
      }

      // Step 2: Build file context with progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Preparing migration request...',
        cancellable: true
      }, async (progress, token) => {
        progress.report({ increment: 20, message: 'Analyzing file...' });
        
        const contextBuilder = container.get(SERVICE_TOKENS.CONTEXT_BUILDER);
        const fileContext = await contextBuilder.buildContext(item.filePath!);
        
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 30, message: 'Redacting sensitive data...' });
        
        // Step 3: Redact sensitive information
        const redactionService = container.get(SERVICE_TOKENS.REDACTION_SERVICE);
        const redactionResult = redactionService.redactSensitiveData(fileContext.content);
        
        // Update file context with redacted content
        fileContext.content = redactionResult.redactedContent;

        progress.report({ increment: 20, message: 'Requesting user consent...' });
        
        // Step 4: Show consent dialog
        const consentPayload: import('../types/copilot').ConsentPayload = {
          filePath: item.filePath!,
          contentPreview: redactionResult.redactedContent.substring(0, 500) + (redactionResult.redactedContent.length > 500 ? '...' : ''),
          redactionSummary: redactionResult,
          specSections: fileContext.relevantSpecs
        };

        const userConsent = await import('../ui/ConsentDialog').then(module => 
          module.ConsentDialog.showConsentDialog(consentPayload)
        );
        
        if (!userConsent) {
          Logger.info('User declined Copilot consent');
          vscode.window.showInformationMessage('Migration request cancelled by user');
          return;
        }

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 20, message: 'Sending to GitHub Copilot...' });
        
        // Step 5: Send to GitHub Copilot
        const response = await copilotService.sendMigrationRequest(fileContext);
        
        progress.report({ increment: 10, message: 'Processing response...' });
        
        if (response.success) {
          // Log telemetry
          this.logCopilotUsage(fileContext, redactionResult, true);
          
          vscode.window.showInformationMessage(
            '✅ Migration request sent to GitHub Copilot. Check the Copilot Chat panel for suggestions.',
            'Open Chat'
          ).then(choice => {
            if (choice === 'Open Chat') {
              vscode.commands.executeCommand('github.copilot.chat.focus');
            }
          });
        } else {
          throw new Error(response.error || 'Unknown error occurred');
        }
      });

    } catch (error) {
      Logger.error('GitHub Copilot integration failed', error as Error);
      
      // Log telemetry for error
      this.logCopilotError(item.filePath!, error as Error);
      
      // Use centralized error handling
      await CopilotErrorHandler.handleError(error as Error, {
        fileContext: { filePath: item.filePath! } as FileContext
      });
    }
  }

  // Context Menu Option 4: Compare OpenAPI Specs
  async compareOpenAPISpecs(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('compareOpenAPISpecs');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for spec comparison');
      return;
    }

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Comparing OpenAPI Specifications...',
        cancellable: true
      }, async (progress, token) => {
        
        progress.report({ increment: 10, message: 'Loading OpenAPI specifications...' });
        
        // Create comparison service
        const specComparisonService = container.get(SERVICE_TOKENS.SPEC_COMPARISON_SERVICE);
        
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 30, message: 'Analyzing specifications...' });
        
        // Create comparison with file context
        const comparison = await specComparisonService.createComparison(item.filePath);
        
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 40, message: 'Calculating differences...' });
        
        // Show comparison in webview
        const comparisonWebview = new (await import('../ui/ComparisonWebview')).ComparisonWebview();
        await comparisonWebview.show(comparison);
        
        progress.report({ increment: 20, message: 'Opening comparison view...' });
        
        // Show success message with options
        const choice = await vscode.window.showInformationMessage(
          `✅ OpenAPI specification comparison complete! Found ${comparison.summary.totalDifferences} differences (${comparison.summary.breakingChanges} breaking changes).`,
          'View Details',
          'Export Report',
          'Dismiss'
        );

        if (choice === 'Export Report') {
          await this.exportComparisonReport(comparison);
        } else if (choice === 'View Details') {
          await this.showComparisonSummary(comparison);
        }

        // Log successful comparison
        this.logComparisonAttempt(item.filePath!, comparison, true);
      });

    } catch (error) {
      Logger.error('OpenAPI spec comparison failed', error as Error);
      
      // Log failed comparison attempt
      this.logComparisonAttempt(item.filePath!, undefined, false, error as Error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const choice = await vscode.window.showErrorMessage(
        `Failed to compare OpenAPI specifications: ${errorMessage}`,
        'Check Specs',
        'Retry',
        'Dismiss'
      );

      if (choice === 'Check Specs') {
        await this.showSpecificationStatus();
      } else if (choice === 'Retry') {
        await this.compareOpenAPISpecs(item);
      }
    }
  }

  // Context Menu Option 5: Validate Elavon Compliance
  async validateElavonCompliance(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('validateElavonCompliance');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for validation');
      return;
    }

    try {
      // Get validation engine from container
      const { container } = await import('../extension');
      const { SERVICE_TOKENS } = await import('../di/container');
      const validationEngine = container.get(SERVICE_TOKENS.VALIDATION_ENGINE);
      
      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Validating Elavon L1 Compliance',
        cancellable: true
      }, async (progress, token) => {
        progress.report({ message: `Analyzing ${path.basename(item.filePath!)}...` });

        if (token.isCancellationRequested) {
          return;
        }

        const result = await validationEngine.validateFile(item.filePath!);
        
        progress.report({ message: 'Generating report...', increment: 80 });

        // Create and show validation report
        const { ValidationReportViewer } = await import('../ui/ValidationReportViewer');
        const reportViewer = new ValidationReportViewer(this.context);
        await reportViewer.showReport(result);
        
        // Show summary notification
        const statusIcon = result.isCompliant ? '✅' : '❌';
        const message = `${statusIcon} Validation complete: ${result.overallScore}/100 (${result.violations.length} issues)`;
        
        if (result.isCompliant) {
          vscode.window.showInformationMessage(message);
        } else {
          const action = await vscode.window.showWarningMessage(
            message,
            'View Report',
            'Show Fixes'
          );
          
          if (action === 'Show Fixes') {
            const suggestions = await validationEngine.suggestFixes(result.violations);
            if (suggestions.length > 0) {
              const items = suggestions.map(suggestion => ({
                label: suggestion.description,
                description: `Confidence: ${Math.round(suggestion.confidence * 100)}%`,
                detail: suggestion.autoFixAvailable ? '🔧 Auto-fixable' : '📝 Manual steps required'
              }));

              await vscode.window.showQuickPick(items, {
                placeHolder: 'Available fixes for validation issues',
                canPickMany: false
              });
            } else {
              vscode.window.showInformationMessage('No automatic fixes available for this file');
            }
          }
        }

        // Update the enhanced result with validation status
        const enhancedResult: EnhancedScanResult = this.enhancedResults.get(item.filePath!) || {
          id: `enhanced-${item.filePath}`,
          filePath: item.filePath!,
          line: 0,
          snippet: '',
          matchedText: '',
          confidence: 0,
          endpointType: 'unknown',
          language: 'unknown',
          migrationHistory: [],
          contextMenuState: {
            operationsInProgress: new Set(),
            cachedResults: new Map(),
            lastUpdated: new Date(),
            availableOperations: []
          }
        };
        
        enhancedResult.validationStatus = result;
        this.enhancedResults.set(item.filePath!, enhancedResult);
        this.refresh();
      });

    } catch (error) {
      Logger.error('Validation failed', error as Error);
      vscode.window.showErrorMessage(`Validation failed: ${error}`);
    }
  }

  // Batch detect standards for all files
  async batchDetectStandards(): Promise<void> {
    Logger.buttonClicked('batchDetectStandards');
    
    if (this.scanResults.length === 0) {
      vscode.window.showInformationMessage('No scan results available. Run a scan first.');
      return;
    }

    const uniqueFiles = Array.from(new Set(this.scanResults.map(r => r.filePath)));
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Detecting standards for ${uniqueFiles.length} files...`,
        cancellable: false
      }, async (progress) => {
        const absolutePaths = uniqueFiles.map(filePath => 
          vscode.Uri.joinPath(workspaceFolder.uri, filePath).fsPath
        );

        const results = await this.fileStandardAnalyzer.batchDetect(absolutePaths);
        
        // Update enhanced results
        let processedCount = 0;
        for (const [absolutePath, result] of results) {
          const relativePath = vscode.workspace.asRelativePath(absolutePath);
          
          const enhancedResult: EnhancedScanResult = this.enhancedResults.get(relativePath) || {
            id: `enhanced-${relativePath}`,
            filePath: relativePath,
            line: 0,
            snippet: '',
            matchedText: '',
            confidence: 0,
            endpointType: 'unknown',
            language: 'unknown',
            migrationHistory: [],
            contextMenuState: {
              operationsInProgress: new Set(),
              cachedResults: new Map(),
              lastUpdated: new Date(),
              availableOperations: []
            }
          };

          enhancedResult.standardDetection = result;
          this.enhancedResults.set(relativePath, enhancedResult);
          
          processedCount++;
          progress.report({
            increment: (processedCount / uniqueFiles.length) * 100,
            message: `Processed ${processedCount}/${uniqueFiles.length} files`
          });
        }

        // Generate summary
        const standards = Array.from(results.values());
        const convergeCount = standards.filter(r => r.standard === 'converge').length;
        const elavonCount = standards.filter(r => r.standard === 'elavon').length;
        const mixedCount = standards.filter(r => r.standard === 'mixed').length;
        const unknownCount = standards.filter(r => r.standard === 'unknown').length;

        const summary = `Standards detected: ${convergeCount} Converge, ${elavonCount} Elavon, ${mixedCount} Mixed, ${unknownCount} Unknown`;
        vscode.window.showInformationMessage(summary);
      });

      // Refresh the tree to show updated icons
      this.refresh();

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to detect file standards: ${error}`);
      Logger.error('Batch file standard detection failed', error as Error);
    }
  }

  // Batch validate compliance for all files
  async batchValidateCompliance(): Promise<void> {
    Logger.buttonClicked('batchValidateCompliance');
    
    if (this.scanResults.length === 0) {
      vscode.window.showInformationMessage('No scan results available. Run a scan first.');
      return;
    }

    const uniqueFiles = Array.from(new Set(this.scanResults.map(r => r.filePath)));
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    if (uniqueFiles.length > 20) {
      const proceed = await vscode.window.showWarningMessage(
        `This will validate ${uniqueFiles.length} files. This may take a while. Continue?`,
        'Yes',
        'No'
      );
      
      if (proceed !== 'Yes') {
        return;
      }
    }

    try {
      // Get validation engine from container
      const { container } = await import('../extension');
      const { SERVICE_TOKENS } = await import('../di/container');
      const validationEngine = container.get(SERVICE_TOKENS.VALIDATION_ENGINE);

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Validating ${uniqueFiles.length} files for Elavon L1 compliance...`,
        cancellable: true
      }, async (progress, token) => {
        const absolutePaths = uniqueFiles.map(filePath => 
          vscode.Uri.joinPath(workspaceFolder.uri, filePath).fsPath
        );

        const results = await validationEngine.validateBatch(absolutePaths);
        
        if (token.isCancellationRequested) {
          return;
        }

        // Update enhanced results with validation status
        let processedCount = 0;
        for (const [absolutePath, result] of results) {
          const relativePath = vscode.workspace.asRelativePath(absolutePath);
          
          const enhancedResult: EnhancedScanResult = this.enhancedResults.get(relativePath) || {
            id: `enhanced-${relativePath}`,
            filePath: relativePath,
            line: 0,
            snippet: '',
            matchedText: '',
            confidence: 0,
            endpointType: 'unknown',
            language: 'unknown',
            migrationHistory: [],
            contextMenuState: {
              operationsInProgress: new Set(),
              cachedResults: new Map(),
              lastUpdated: new Date(),
              availableOperations: []
            }
          };

          enhancedResult.validationStatus = result;
          this.enhancedResults.set(relativePath, enhancedResult);
          
          processedCount++;
          progress.report({
            increment: (processedCount / uniqueFiles.length) * 80,
            message: `Validated ${processedCount}/${uniqueFiles.length} files`
          });
        }

        progress.report({ message: 'Generating batch report...', increment: 90 });

        // Show batch validation report
        const { ValidationReportViewer } = await import('../ui/ValidationReportViewer');
        const reportViewer = new ValidationReportViewer(this.context);
        await reportViewer.showReport(results);
        
        // Generate summary
        const totalFiles = results.size;
        const compliantFiles = Array.from(results.values()).filter(r => r.isCompliant).length;
        const complianceRate = Math.round((compliantFiles / totalFiles) * 100);
        const totalViolations = Array.from(results.values()).reduce((sum, r) => sum + r.violations.length, 0);
        
        const message = `Batch validation complete: ${compliantFiles}/${totalFiles} files compliant (${complianceRate}%), ${totalViolations} total issues`;
        
        if (complianceRate >= 80) {
          vscode.window.showInformationMessage(`✅ ${message}`);
        } else {
          vscode.window.showWarningMessage(`⚠️ ${message}`);
        }
      });

      // Refresh the tree to show updated validation status
      this.refresh();

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to validate compliance: ${error}`);
      Logger.error('Batch validation failed', error as Error);
    }
  }

  // Helper methods for GitHub Copilot integration
  private logCopilotUsage(context: FileContext, redactionResult: RedactionResult, success: boolean): void {
    try {
      const telemetry = {
        operation: success ? 'prompt_sent' : 'error',
        filePath: context.filePath,
        fileSize: context.fileSize,
        language: context.language,
        redactionCount: redactionResult.redactionCount,
        detectedStandard: context.detectedStandard?.standard,
        confidence: context.detectedStandard?.confidence,
        timestamp: new Date()
      };

      Logger.info('Copilot usage telemetry', telemetry);
    } catch (error) {
      Logger.warn('Failed to log Copilot telemetry', error as Error);
    }
  }

  private logCopilotError(filePath: string, error: Error): void {
    try {
      const telemetry = {
        operation: 'error',
        filePath: filePath,
        fileSize: 0,
        language: 'unknown',
        redactionCount: 0,
        timestamp: new Date(),
        error: error.message
      };

      Logger.error('Copilot error telemetry', error);
    } catch (logError) {
      Logger.warn('Failed to log Copilot error telemetry', logError as Error);
    }
  }

  private buildMigrationPrompt(context: FileContext, standardDetection: StandardDetectionResult): string {
    const promptBuilder = container.get(SERVICE_TOKENS.PROMPT_BUILDER);
    
    // Create a migration-specific prompt with additional context
    const migrationInstructions = `
## Migration Instructions
This is an automated migration request from Converge API to Elavon L1 API.

**Current Standard**: ${standardDetection.standard} (${standardDetection.confidence}% confidence)
**Target**: Elavon L1 API

Please provide:
1. **Complete migrated code** with all Converge patterns converted to Elavon L1
2. **Detailed explanation** of each change made
3. **Migration checklist** of manual steps required
4. **Testing recommendations** for validating the migration
5. **Potential issues** to watch out for

Focus on:
- Converting API endpoints from Converge to Elavon L1 format
- Updating authentication mechanisms
- Transforming request/response data structures
- Maintaining existing business logic and error handling
`;

    return promptBuilder.createMigrationPrompt(context, migrationInstructions);
  }

  private async showManualMigrationGuide(filePath: string, standardDetection: StandardDetectionResult): Promise<void> {
    const fileName = filePath.split('/').pop() || filePath;
    
    const guideContent = `# Manual Migration Guide: ${fileName}

## Current Analysis
- **File**: ${filePath}
- **Detected Standard**: ${standardDetection.standard} (${standardDetection.confidence}% confidence)
- **Detected Patterns**: ${standardDetection.details.detectedEndpoints.length} API patterns found

## Migration Steps

### 1. API Endpoint Migration
${standardDetection.details.detectedEndpoints.map(endpoint => `
- **${endpoint.name}** (${endpoint.standard})
  - Current: ${endpoint.snippet}
  - Target: Convert to Elavon L1 equivalent
  - Confidence: ${endpoint.confidence}%
`).join('')}

### 2. Authentication Changes
- Replace Converge API keys with Elavon L1 credentials
- Update authentication headers and methods
- Verify SSL/TLS requirements

### 3. Data Structure Updates
- Review request/response formats
- Update field mappings between Converge and Elavon L1
- Handle any breaking changes in data types

### 4. Testing Checklist
- [ ] Update API endpoints
- [ ] Replace authentication credentials
- [ ] Test all payment flows
- [ ] Verify error handling
- [ ] Check webhook configurations
- [ ] Validate reporting functionality

### 5. Resources
- [Elavon L1 API Documentation](https://developer.elavon.com)
- [Migration Best Practices](https://developer.elavon.com/migration)
- [Support Contact](mailto:developer-support@elavon.com)

---
*Generated by L1X ElavonX Migrator v0.6.0*`;

    const doc = await vscode.workspace.openTextDocument({
      content: guideContent,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async showMigrationGuide(filePath: string, standardDetection: StandardDetectionResult): Promise<void> {
    const fileName = filePath.split('/').pop() || filePath;
    
    const guideContent = `# Migration Guide: ${fileName}

## GitHub Copilot Migration Process

Your migration request has been sent to GitHub Copilot. Here's what to expect:

### 1. Review Copilot Suggestions
- Check the Copilot Chat panel for detailed migration recommendations
- Look for complete code examples with Elavon L1 API patterns
- Review the explanation of changes made

### 2. Apply Changes Carefully
- **Don't apply all changes at once** - migrate incrementally
- **Test each change** before proceeding to the next
- **Keep backups** of your original code

### 3. Validation Steps
- [ ] Verify all API endpoints are correctly mapped
- [ ] Test authentication with Elavon L1 credentials
- [ ] Validate request/response data structures
- [ ] Check error handling and edge cases
- [ ] Test in sandbox environment first

### 4. Common Migration Points
- **Endpoints**: Converge \`/api/v1/\` → Elavon L1 \`/api/l1/\`
- **Authentication**: API key format and headers may differ
- **Response Format**: Field names and structures may have changed
- **Error Codes**: Different error code mappings

### 5. Need Help?
- Use "Ask GitHub Copilot for Migration" for specific questions
- Check the OpenAPI specs comparison feature
- Contact Elavon developer support for complex issues

---
*Migration initiated: ${new Date().toLocaleString()}*
*File: ${filePath}*
*Standard: ${standardDetection.standard} (${standardDetection.confidence}% confidence)*`;

    const doc = await vscode.workspace.openTextDocument({
      content: guideContent,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private logMigrationAttempt(
    context: Partial<FileContext>, 
    standardDetection: StandardDetectionResult | undefined, 
    success: boolean, 
    error?: Error
  ): void {
    try {
      const telemetry = {
        operation: success ? 'migration_success' : 'migration_error',
        filePath: context.filePath || 'unknown',
        fileSize: context.fileSize || 0,
        language: context.language || 'unknown',
        detectedStandard: standardDetection?.standard || 'unknown',
        confidence: standardDetection?.confidence || 0,
        timestamp: new Date(),
        error: error?.message
      };

      if (success) {
        Logger.info('Migration attempt successful', telemetry);
      } else {
        Logger.error('Migration attempt failed', error || new Error('Unknown migration error'));
      }
    } catch (logError) {
      Logger.warn('Failed to log migration telemetry', logError as Error);
    }
  }

  private async exportComparisonReport(comparison: import('../services/SpecComparisonService').ComparisonView): Promise<void> {
    try {
      const format = await vscode.window.showQuickPick(
        [
          { label: 'JSON', description: 'Machine-readable format', value: 'json' },
          { label: 'Markdown', description: 'Human-readable report', value: 'markdown' },
          { label: 'HTML', description: 'Web-viewable report', value: 'html' }
        ],
        { placeHolder: 'Select export format' }
      );

      if (!format) {return;}

      const specComparisonService = container.get(SERVICE_TOKENS.SPEC_COMPARISON_SERVICE);
      const exportContent = await specComparisonService.exportComparison(comparison, format.value as any);
      
      const fileName = `spec-comparison-${comparison.id}.${format.value}`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(fileName),
        filters: {
          [format.label]: [format.value]
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportContent, 'utf8'));
        vscode.window.showInformationMessage(`✅ Comparison report exported to ${uri.fsPath}`);
      }
    } catch (error) {
      Logger.error('Failed to export comparison report', error as Error);
      vscode.window.showErrorMessage('Failed to export comparison report');
    }
  }

  private async showComparisonSummary(comparison: import('../services/SpecComparisonService').ComparisonView): Promise<void> {
    const { summary } = comparison;
    
    const summaryContent = `# OpenAPI Specification Comparison Summary

## Overview
- **Total Differences**: ${summary.totalDifferences}
- **Breaking Changes**: ${summary.breakingChanges}
- **Non-Breaking Changes**: ${summary.nonBreakingChanges}
- **Enhancements**: ${summary.enhancements}

## Impact Analysis
${summary.breakingChanges > 0 ? '⚠️ **Breaking changes detected** - Migration will require code updates' : '✅ No breaking changes detected'}

## Field Mappings
- **Endpoint Groups**: ${comparison.fieldMappings.length}
- **Total Mappings**: ${comparison.fieldMappings.reduce((sum, group) => sum + group.mappings.length, 0)}

## Recommendations
${summary.breakingChanges > 0 ? 
  '1. Review breaking changes carefully\n2. Plan migration in phases\n3. Test thoroughly in staging environment' :
  '1. Migration should be straightforward\n2. Focus on testing new features\n3. Update documentation'
}

---
*Generated: ${comparison.createdAt.toLocaleString()}*`;

    const doc = await vscode.workspace.openTextDocument({
      content: summaryContent,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async showSpecificationStatus(): Promise<void> {
    const config = vscode.workspace.getConfiguration('l1x.copilot');
    const convergeSpecPath = config.get('convergeSpecPath', 'openapi/Converge Open API.json');
    const elavonSpecPath = config.get('elavonSpecPath', 'openapi/Elavon API Gateway Open API.json');

    const statusContent = `# OpenAPI Specification Status

## Configuration
- **Converge Spec Path**: ${convergeSpecPath}
- **Elavon Spec Path**: ${elavonSpecPath}

## Troubleshooting
1. **Check file paths** - Ensure both OpenAPI specification files exist
2. **Validate JSON format** - Specifications must be valid JSON
3. **Check permissions** - Ensure files are readable
4. **Update configuration** - Use VS Code settings to update paths if needed

## Configuration Commands
- Open Settings: \`Ctrl+,\` (Cmd+, on Mac)
- Search for: \`l1x.copilot\`
- Update spec paths as needed

---
*Current workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'No workspace'}*`;

    const doc = await vscode.workspace.openTextDocument({
      content: statusContent,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private logComparisonAttempt(
    filePath: string, 
    comparison: import('../services/SpecComparisonService').ComparisonView | undefined, 
    success: boolean, 
    error?: Error
  ): void {
    try {
      const telemetry = {
        operation: success ? 'comparison_success' : 'comparison_error',
        filePath: filePath,
        totalDifferences: comparison?.summary.totalDifferences || 0,
        breakingChanges: comparison?.summary.breakingChanges || 0,
        fieldMappings: comparison?.fieldMappings.length || 0,
        timestamp: new Date(),
        error: error?.message
      };

      if (success) {
        Logger.info('Spec comparison successful', telemetry);
      } else {
        Logger.error('Spec comparison failed', error || new Error('Unknown comparison error'));
      }
    } catch (logError) {
      Logger.warn('Failed to log comparison telemetry', logError as Error);
    }
  }
}