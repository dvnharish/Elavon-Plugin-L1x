import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CodeScannerService, ScanResult, ScanOptions, ScanProgress } from '../services/CodeScannerService';
import { FileStandardAnalyzer } from '../services/FileStandardAnalyzer';
import { StandardDetectionResult, EnhancedScanResult } from '../types/contextMenu';
import { SERVICE_TOKENS } from '../di/container';
import { container } from '../extension';
import { FileContext, RedactionResult } from '../types/copilot';
import { CopilotErrorHandler } from '../utils/CopilotErrorHandler';

export interface ScanTreeItem {
  id: string;
  label: string;
  type: 'endpoint' | 'file' | 'occurrence' | 'summary' | 'config';
  children?: ScanTreeItem[];
  filePath?: string;
  line?: number;
  snippet?: string;
  confidence?: number;
  endpointType?: string;
  scanResult?: ScanResult;
}

export class ScanPanel implements vscode.TreeDataProvider<ScanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ScanTreeItem | undefined | null | void> = new vscode.EventEmitter<ScanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ScanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private scannerService: CodeScannerService;
  private fileStandardAnalyzer: FileStandardAnalyzer;
  private scanResults: ScanResult[] = [];
  private enhancedResults: Map<string, EnhancedScanResult> = new Map();
  private isScanning = false;
  private lastScanOptions: ScanOptions = {
    mode: 'regex',
    languages: ['javascript', 'java', 'csharp', 'python'],
    excludePatterns: [],
    includePatterns: []
  };

  private breadcrumbInfo: string = '';
  private currentScanType: 'regex' | 'ast' | 'dto' = 'regex';

  constructor(private context: vscode.ExtensionContext) {
    this.scannerService = new CodeScannerService();
    this.fileStandardAnalyzer = new FileStandardAnalyzer();
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
        
        // Enhanced tooltip with confidence and endpoint type
        const confidencePercent = element.confidence ? Math.round(element.confidence * 100) : 0;
        treeItem.tooltip = `Confidence: ${confidencePercent}% | Type: ${element.endpointType || 'unknown'} | ${element.snippet || 'No snippet available'}`;
        
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

    // Group results by endpoint type
    const groupedResults = this.groupResultsByEndpointType();
    const treeItems: ScanTreeItem[] = [];

    // Add breadcrumb item at the top
    if (this.breadcrumbInfo) {
      treeItems.push({
        id: 'breadcrumb',
        label: `📍 ${this.breadcrumbInfo}`,
        type: 'summary'
      });
    }

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

  private getScanTypeLabel(mode: 'regex' | 'ast' | 'dto'): string {
    switch (mode) {
      case 'regex': return 'Regex Scan';
      case 'ast': return 'Business Logic Scan';
      case 'dto': return 'DTO Scan';
      default: return 'Unknown Scan';
    }
  }

  async configureScan(): Promise<void> {
    Logger.buttonClicked('configureScan');

    // Show scan mode selection
    const modeChoice = await vscode.window.showQuickPick([
      { label: 'Regex Scan', description: 'Find Converge endpoints, URLs, and DTOs using regex patterns (Default)', value: 'regex' },
      { label: 'Scan Converge Business Logic', description: 'Analyze where API calls happen, find service classes and endpoint configurations', value: 'ast' },
      { label: 'DTO Scan', description: 'Specifically find Data Transfer Objects and models', value: 'dto' }
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
      mode: modeChoice.value as 'regex' | 'ast' | 'dto',
      languages: languageChoices.map(choice => choice.value),
      excludePatterns: this.lastScanOptions.excludePatterns,
      includePatterns: this.lastScanOptions.includePatterns
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
    this.breadcrumbInfo = '';
    this.refresh();
    vscode.window.showInformationMessage('Scan results cleared');
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

  // Context Menu Option 4: Compare OpenAPI Specs (placeholder)
  async compareOpenAPISpecs(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('compareOpenAPISpecs');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for spec comparison');
      return;
    }

    vscode.window.showInformationMessage('📂 OpenAPI spec comparison feature coming soon!');
  }

  // Context Menu Option 5: Validate Elavon Compliance (placeholder)
  async validateElavonCompliance(item: ScanTreeItem): Promise<void> {
    Logger.buttonClicked('validateElavonCompliance');
    
    if (!item.filePath) {
      vscode.window.showWarningMessage('No file path available for validation');
      return;
    }

    vscode.window.showInformationMessage('🧪 Elavon compliance validation feature coming soon!');
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
}