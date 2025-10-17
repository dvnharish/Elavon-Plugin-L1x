import * as vscode from 'vscode';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface ScanOptions {
  mode: 'business-logic' | 'quick';
  languages: string[];
  excludePatterns: string[];
  includePatterns: string[];
}

export interface ScanResult {
  id: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  matchedText: string;
  confidence: number;
  endpointType: 'transaction' | 'payment' | 'refund' | 'auth' | 'unknown';
  language: string;
  framework?: string;
  createdAt: Date;
}

export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  percentage: number;
  estimatedTimeRemaining: number;
  isComplete: boolean;
  isCancelled: boolean;
}

export interface ICodeScannerService {
  scanProject(options: ScanOptions): Promise<ScanResult[]>;
  cancelScan(): void;
  getScanProgress(): ScanProgress;
  addToIgnoreList(pattern: string): void;
  getIgnoreList(): string[];
}

export class CodeScannerService extends EventEmitter implements ICodeScannerService {
  private _isScanning = false;
  private _cancellationToken?: vscode.CancellationTokenSource;
  private _progress: ScanProgress = {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    percentage: 0,
    estimatedTimeRemaining: 0,
    isComplete: false,
    isCancelled: false
  };
  private _ignoreList: string[] = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ];

  // Converge API patterns for different languages
  private readonly convergePatterns = {
    // JavaScript/TypeScript patterns
    javascript: [
      // API endpoint patterns
      /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
      /(?:converge|cvg)\.api\.(?:post|get|put|delete)\s*\(/gi,
      /(?:converge|cvg)\.endpoint\s*[=:]\s*['"`]([^'"`]+)['"`]/gi,
      // Configuration patterns
      /(?:converge|cvg)\.config\s*[=:]/gi,
      /(?:converge|cvg)\.merchantId\s*[=:]/gi,
      /(?:converge|cvg)\.apiKey\s*[=:]/gi,
      // Method calls
      /\.(?:processTransaction|processPayment|processRefund|processAuth)\s*\(/gi,
      // Import/require patterns
      /(?:import|require)\s*.*(?:converge|cvg)/gi
    ],
    // Java patterns
    java: [
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
      /(?:@Converge|@CVG)(?:Endpoint|Service|Client)/g,
      /new\s+(?:Converge|CVG)(?:Client|Service|API)/g,
      /\.(?:processTransaction|processPayment|processRefund|processAuth)\s*\(/gi
    ],
    // C# patterns
    csharp: [
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /(?:converge|cvg)\.(?:Transaction|Payment|Refund|Auth)\.(?:Create|Process|Submit|Execute)/gi,
      /\[(?:Converge|CVG)(?:Endpoint|Service|Client)\]/g,
      /new\s+(?:Converge|CVG)(?:Client|Service|API)/g,
      /\.(?:ProcessTransaction|ProcessPayment|ProcessRefund|ProcessAuth)\s*\(/gi
    ],
    // Python patterns
    python: [
      /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
      /(?:from|import)\s+(?:converge|cvg)/gi,
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /\.(?:process_transaction|process_payment|process_refund|process_auth)\s*\(/gi
    ],
    // PHP patterns
    php: [
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /(?:converge|cvg)->(?:transaction|payment|refund|auth)->(?:create|process|submit|execute)/gi,
      /new\s+(?:Converge|CVG)(?:Client|Service|API)/g,
      /->(?:processTransaction|processPayment|processRefund|processAuth)\s*\(/gi
    ],
    // Ruby patterns
    ruby: [
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
      /(?:Converge|CVG)(?:Client|Service|API)\.new/g,
      /\.(?:process_transaction|process_payment|process_refund|process_auth)\s*\(/gi
    ],
    // VB.NET patterns
    vb: [
      /(?:Converge|CVG)(?:Client|Service|API|Transaction|Payment)/g,
      /(?:converge|cvg)\.(?:Transaction|Payment|Refund|Auth)\.(?:Create|Process|Submit|Execute)/gi,
      /New\s+(?:Converge|CVG)(?:Client|Service|API)/gi,
      /\.(?:ProcessTransaction|ProcessPayment|ProcessRefund|ProcessAuth)\s*\(/gi
    ]
  };

  // File extensions for each language
  private readonly languageExtensions = {
    javascript: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    java: ['.java'],
    csharp: ['.cs'],
    python: ['.py'],
    php: ['.php'],
    ruby: ['.rb'],
    vb: ['.vb']
  };

  constructor() {
    super();
  }

  async scanProject(options: ScanOptions): Promise<ScanResult[]> {
    if (this._isScanning) {
      throw new Error('Scan already in progress');
    }

    this._isScanning = true;
    this._cancellationToken = new vscode.CancellationTokenSource();
    
    const startTime = Date.now();
    const results: ScanResult[] = [];

    try {
      // Reset progress
      this._progress = {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        percentage: 0,
        estimatedTimeRemaining: 0,
        isComplete: false,
        isCancelled: false
      };

      // Find all files to scan
      const filesToScan = await this.findFilesToScan(options);
      this._progress.totalFiles = filesToScan.length;

      console.log(`[L1X] Starting ${options.mode} scan of ${filesToScan.length} files`);

      for (let i = 0; i < filesToScan.length; i++) {
        if (this._cancellationToken.token.isCancellationRequested) {
          this._progress.isCancelled = true;
          break;
        }

        const file = filesToScan[i];
        this._progress.currentFile = file || '';
        this._progress.processedFiles = i;
        this._progress.percentage = Math.round((i / filesToScan.length) * 100);
        
        // Calculate estimated time remaining
        const elapsed = Date.now() - startTime;
        const avgTimePerFile = elapsed / (i + 1);
        this._progress.estimatedTimeRemaining = Math.round(avgTimePerFile * (filesToScan.length - i - 1) / 1000);

        this.emit('progress', this._progress);

        try {
          const fileResults = await this.scanFile(file || '', options);
          results.push(...fileResults);
        } catch (error) {
          console.warn(`[L1X] Error scanning file ${file}:`, error);
        }
      }

      this._progress.isComplete = true;
      this._progress.percentage = 100;
      this._progress.processedFiles = filesToScan.length;
      this.emit('progress', this._progress);

      console.log(`[L1X] Scan completed. Found ${results.length} matches in ${Date.now() - startTime}ms`);
      
      return results;
    } finally {
      this._isScanning = false;
      this._cancellationToken?.dispose();
      this._cancellationToken = undefined as any;
    }
  }

  cancelScan(): void {
    if (this._cancellationToken) {
      this._cancellationToken.cancel();
      console.log('[L1X] Scan cancellation requested');
    }
  }

  getScanProgress(): ScanProgress {
    return { ...this._progress };
  }

  addToIgnoreList(pattern: string): void {
    if (!this._ignoreList.includes(pattern)) {
      this._ignoreList.push(pattern);
      console.log(`[L1X] Added to ignore list: ${pattern}`);
    }
  }

  getIgnoreList(): string[] {
    return [...this._ignoreList];
  }

  private async findFilesToScan(options: ScanOptions): Promise<string[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    // Build include patterns based on selected languages
    const includePatterns: string[] = [];
    for (const language of options.languages) {
      const extensions = this.languageExtensions[language as keyof typeof this.languageExtensions];
      if (extensions) {
        for (const ext of extensions) {
          includePatterns.push(`**/*${ext}`);
        }
      }
    }

    // Combine with user-provided include patterns
    if (options.includePatterns.length > 0) {
      includePatterns.push(...options.includePatterns);
    }

    // Build exclude patterns
    const excludePatterns = [...this._ignoreList, ...options.excludePatterns];

    // Find files using VS Code's file search
    const files: string[] = [];
    for (const includePattern of includePatterns) {
      const foundFiles = await vscode.workspace.findFiles(
        includePattern,
        `{${excludePatterns.join(',')}}`,
        10000 // Limit to prevent memory issues
      );
      
      for (const file of foundFiles) {
        const relativePath = vscode.workspace.asRelativePath(file);
        if (!files.includes(relativePath)) {
          files.push(relativePath);
        }
      }
    }

    return files;
  }

  private async scanFile(filePath: string, options: ScanOptions): Promise<ScanResult[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
    const uri = vscode.Uri.file(fullPath);
    
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const language = this.detectLanguage(filePath);
      
      if (!language) {
        return [];
      }

      const results: ScanResult[] = [];
      const patterns = (this.convergePatterns as any)[language];
      
      if (!patterns) {
        return [];
      }

      // Scan using regex patterns
      for (const pattern of patterns) {
        const matches = this.findMatches(content, pattern, filePath, language);
        results.push(...matches);
      }

      // If business-logic mode, enhance with AST parsing
      if (options.mode === 'business-logic') {
        const astResults = await this.enhanceWithAST(content, filePath, language, results);
        return astResults;
      }

      return results;
    } catch (error) {
      console.warn(`[L1X] Could not read file ${filePath}:`, error);
      return [];
    }
  }

  private findMatches(content: string, pattern: RegExp, filePath: string, language: string): ScanResult[] {
    const results: ScanResult[] = [];
    const lines = content.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) {
        continue;
      }
      
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(line)) !== null) {
        const matchedText = match[0];
        const endpointType = this.classifyEndpointType(matchedText);
        const confidence = this.calculateConfidence(matchedText, line, language);
        
        // Create snippet with context
        const startLine = Math.max(0, lineIndex - 1);
        const endLine = Math.min(lines.length - 1, lineIndex + 1);
        const snippet = lines.slice(startLine, endLine + 1).join('\n');

        results.push({
          id: `${filePath}:${lineIndex + 1}:${match.index}:${Date.now()}`,
          filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          snippet,
          matchedText,
          confidence,
          endpointType,
          language,
          createdAt: new Date()
        });
        
        // Prevent infinite loop for global regex
        if (!pattern.global) {
          break;
        }
      }
    }
    
    return results;
  }

  private async enhanceWithAST(content: string, filePath: string, language: string, regexResults: ScanResult[]): Promise<ScanResult[]> {
    // For now, return regex results with enhanced confidence
    // In a full implementation, this would use language-specific AST parsers
    // like @babel/parser for JS/TS, tree-sitter, or language servers
    
    return regexResults.map(result => {
      const framework = this.detectFramework(content, language);
      const enhanced: ScanResult = {
        ...result,
        confidence: Math.min(result.confidence + 0.1, 1.0), // Slight confidence boost for AST mode
      };
      
      if (framework) {
        enhanced.framework = framework;
      }
      
      return enhanced;
    });
  }

  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [language, extensions] of Object.entries(this.languageExtensions)) {
      if (extensions.includes(ext)) {
        return language;
      }
    }
    
    return null;
  }

  private classifyEndpointType(matchedText: string): 'transaction' | 'payment' | 'refund' | 'auth' | 'unknown' {
    const text = matchedText.toLowerCase();
    
    if (text.includes('transaction')) {
      return 'transaction';
    }
    if (text.includes('payment')) {
      return 'payment';
    }
    if (text.includes('refund')) {
      return 'refund';
    }
    if (text.includes('auth')) {
      return 'auth';
    }
    
    return 'unknown';
  }

  private calculateConfidence(matchedText: string, line: string, language: string): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for specific API method calls
    if (/\.(process|create|submit|execute)/i.test(matchedText)) {
      confidence += 0.3;
    }
    
    // Higher confidence for import/require statements
    if (/(?:import|require|from)/i.test(line)) {
      confidence += 0.2;
    }
    
    // Higher confidence for configuration patterns
    if (/(?:config|key|secret|merchant)/i.test(matchedText)) {
      confidence += 0.1;
    }
    
    // Language-specific confidence adjustments
    if (language === 'javascript' && /(?:converge|cvg)\./i.test(matchedText)) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private detectFramework(content: string, language: string): string | undefined {
    if (language === 'javascript') {
      if (content.includes('react')) {
        return 'React';
      }
      if (content.includes('angular')) {
        return 'Angular';
      }
      if (content.includes('vue')) {
        return 'Vue';
      }
      if (content.includes('express')) {
        return 'Express';
      }
      if (content.includes('next')) {
        return 'Next.js';
      }
    }
    
    if (language === 'java') {
      if (content.includes('springframework')) {
        return 'Spring';
      }
      if (content.includes('javax.servlet')) {
        return 'Servlet';
      }
    }
    
    if (language === 'csharp') {
      if (content.includes('Microsoft.AspNetCore')) {
        return 'ASP.NET Core';
      }
      if (content.includes('System.Web')) {
        return 'ASP.NET';
      }
    }
    
    return undefined;
  }
}