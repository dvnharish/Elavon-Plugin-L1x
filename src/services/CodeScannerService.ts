import * as vscode from 'vscode';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface ScanOptions {
  mode: 'regex' | 'ast' | 'dto';
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
  endpointType: 'transaction' | 'payment' | 'refund' | 'auth' | 'dto' | 'endpoint' | 'class' | 'unknown';
  language: string;
  framework?: string;
  createdAt: Date;
  scanType: 'regex' | 'ast' | 'dto';
  className?: string;
  methodName?: string;
  endpointUrl?: string;
  dtoName?: string;
  businessLogicType?: 'api-call' | 'endpoint-definition' | 'data-model' | 'service-class';
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

  // Enhanced Converge API patterns for different scan types and languages
  private readonly convergePatterns = {
    // JavaScript/TypeScript patterns
    javascript: {
      regex: [
        // Endpoint URL patterns
        /['"`](https?:\/\/[^'"`]*(?:converge|elavon)[^'"`]*)['"`]/gi,
        /(?:endpoint|url|baseUrl)\s*[=:]\s*['"`]([^'"`]*(?:converge|elavon)[^'"`]*)['"`]/gi,
        // API method patterns
        /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
        /(?:converge|cvg)\.api\.(?:post|get|put|delete)\s*\(/gi,
        // Configuration patterns
        /(?:converge|cvg)\.(?:config|merchantId|apiKey|apiSecret)\s*[=:]/gi,
        // Import/require patterns
        /(?:import|require)\s*.*(?:converge|cvg)/gi
      ],
      ast: [
        // Service class definitions with Converge
        /class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service|Client|Handler)\w*)/gi,
        // Method definitions with business logic
        /(?:async\s+)?(?:function|method)\s+(\w*(?:process|handle|execute|call)(?:Payment|Transaction|Refund|API|Converge)\w*)/gi,
        // API call patterns in methods
        /(?:await\s+)?(?:fetch|axios|http|this\.client)\.(?:post|get|put|delete)\s*\([^)]*(?:converge|payment|transaction|api)/gi,
        // Endpoint configuration patterns
        /(?:const|let|var)\s+\w*(?:endpoint|url|api)\w*\s*=\s*['"`][^'"`]*(?:converge|elavon)/gi,
        // Service injection patterns
        /(?:constructor|inject)\s*\([^)]*(?:Converge|Payment|Transaction)(?:Service|Client)/gi
      ],
      dto: [
        // DTO/Model class patterns
        /(?:interface|class|type)\s+(\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Payment/Transaction data structures
        /(?:interface|class|type)\s+(\w*(?:Payment|Transaction|Refund|Auth)\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Property patterns in DTOs
        /(?:merchantId|apiKey|transactionId|paymentId|amount|currency)\s*[?:]?\s*(?:string|number)/gi
      ]
    },
    // Java patterns
    java: {
      regex: [
        // Endpoint URL patterns
        /"(https?:\/\/[^"]*(?:converge|elavon)[^"]*)"/gi,
        // API method patterns
        /(?:Converge|CVG)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
        // Configuration patterns
        /(?:@Value|@ConfigurationProperties).*(?:converge|cvg)/gi
      ],
      ast: [
        // Class definitions
        /(?:public\s+)?class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service|Controller)\w*)/gi,
        // Method definitions
        /(?:public|private|protected)\s+\w+\s+(\w*(?:process|handle|execute)(?:Payment|Transaction|Refund)\w*)\s*\(/gi,
        // Spring/Framework annotations with classes
        /(?:@RestController|@Service|@Component|@Repository|@Controller)\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/gi,
        // Endpoint mapping annotations
        /(?:@PostMapping|@GetMapping|@PutMapping|@DeleteMapping|@RequestMapping)\s*\([^)]*(?:payment|transaction|converge)/gi
      ],
      dto: [
        // DTO class patterns
        /(?:public\s+)?class\s+(\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Entity annotations
        /(?:@Entity|@Table|@Document)\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/gi,
        // Field patterns
        /(?:private|public)\s+(?:String|Long|Integer|BigDecimal)\s+(?:merchantId|apiKey|transactionId|paymentId|amount)/gi
      ]
    },
    // C# patterns
    csharp: {
      regex: [
        // Endpoint URL patterns
        /"(https?:\/\/[^"]*(?:converge|elavon)[^"]*)"/gi,
        // API method patterns
        /(?:Converge|CVG)\.(?:Transaction|Payment|Refund|Auth)\.(?:Create|Process|Submit|Execute)/gi,
        // Configuration patterns
        /(?:ConfigurationManager|IConfiguration).*(?:converge|cvg)/gi
      ],
      ast: [
        // Class definitions
        /(?:public\s+)?class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service|Controller)\w*)/gi,
        // Method definitions
        /(?:public|private|protected)\s+(?:async\s+)?(?:Task<?[\w<>]*>?|void|\w+)\s+(\w*(?:Process|Handle|Execute)(?:Payment|Transaction|Refund)\w*)\s*\(/gi,
        // Controller/Service attributes
        /\[(?:ApiController|Route|HttpPost|HttpGet)\][\s\S]*?(?:public\s+)?class\s+(\w+)/gi
      ],
      dto: [
        // DTO class patterns
        /(?:public\s+)?class\s+(\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Property patterns
        /public\s+(?:string|long|int|decimal)\s+(?:MerchantId|ApiKey|TransactionId|PaymentId|Amount)/gi
      ]
    },
    // Python patterns
    python: {
      regex: [
        // Endpoint URL patterns
        /['"`](https?:\/\/[^'"`]*(?:converge|elavon)[^'"`]*)['"`]/gi,
        // API method patterns
        /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
        // Import patterns
        /(?:from|import)\s+(?:converge|cvg)/gi
      ],
      ast: [
        // Class definitions
        /class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service)\w*)/gi,
        // Method definitions
        /def\s+(\w*(?:process|handle|execute)_(?:payment|transaction|refund)\w*)\s*\(/gi,
        // FastAPI/Flask decorators
        /@(?:app\.(?:post|get|put|delete)|route)\s*\([^)]*(?:payment|transaction)/gi
      ],
      dto: [
        // Pydantic models
        /class\s+(\w*(?:Model|Schema|DTO|Dto|Request|Response|Data)\w*)\s*\(.*(?:BaseModel|Schema)/gi,
        // Dataclass patterns
        /@dataclass[\s\S]*?class\s+(\w*(?:Payment|Transaction|Refund)\w*)/gi
      ]
    },
    // PHP patterns
    php: {
      regex: [
        // Endpoint URL patterns
        /['"`](https?:\/\/[^'"`]*(?:converge|elavon)[^'"`]*)['"`]/gi,
        // API method patterns
        /(?:converge|cvg)->(?:transaction|payment|refund|auth)->(?:create|process|submit|execute)/gi,
        // Class instantiation
        /new\s+(?:Converge|CVG)(?:Client|Service|API)/gi
      ],
      ast: [
        // Class definitions
        /class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service|Controller)\w*)/gi,
        // Method definitions
        /(?:public|private|protected)\s+function\s+(\w*(?:process|handle|execute)(?:Payment|Transaction|Refund)\w*)\s*\(/gi
      ],
      dto: [
        // DTO class patterns
        /class\s+(\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Property patterns
        /(?:public|private|protected)\s+\$(?:merchantId|apiKey|transactionId|paymentId|amount)/gi
      ]
    },
    // Ruby patterns
    ruby: {
      regex: [
        // Endpoint URL patterns
        /['"`](https?:\/\/[^'"`]*(?:converge|elavon)[^'"`]*)['"`]/gi,
        // API method patterns
        /(?:converge|cvg)\.(?:transaction|payment|refund|auth)\.(?:create|process|submit|execute)/gi,
        // Class instantiation
        /(?:Converge|CVG)(?:Client|Service|API)\.new/gi
      ],
      ast: [
        // Class definitions
        /class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service|Controller)\w*)/gi,
        // Method definitions
        /def\s+(\w*(?:process|handle|execute)_(?:payment|transaction|refund)\w*)/gi
      ],
      dto: [
        // Model class patterns
        /class\s+(\w*(?:Model|DTO|Dto|Request|Response|Data)\w*)/gi,
        // ActiveRecord models
        /class\s+(\w+)\s*<\s*(?:ActiveRecord::Base|ApplicationRecord)/gi
      ]
    },
    // VB.NET patterns
    vb: {
      regex: [
        // Endpoint URL patterns
        /"(https?:\/\/[^"]*(?:converge|elavon)[^"]*)"/gi,
        // API method patterns
        /(?:Converge|CVG)\.(?:Transaction|Payment|Refund|Auth)\.(?:Create|Process|Submit|Execute)/gi
      ],
      ast: [
        // Class definitions
        /(?:Public\s+)?Class\s+(\w*(?:Converge|CVG|Payment|Transaction|Service)\w*)/gi,
        // Method definitions
        /(?:Public|Private|Protected)\s+(?:Function|Sub)\s+(\w*(?:Process|Handle|Execute)(?:Payment|Transaction|Refund)\w*)\s*\(/gi
      ],
      dto: [
        // DTO class patterns
        /(?:Public\s+)?Class\s+(\w*(?:DTO|Dto|Model|Request|Response|Data)\w*)/gi,
        // Property patterns
        /(?:Public|Private)\s+Property\s+(?:MerchantId|ApiKey|TransactionId|PaymentId|Amount)/gi
      ]
    }
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
      const languagePatterns = (this.convergePatterns as any)[language];
      
      if (!languagePatterns) {
        return [];
      }

      // Get patterns based on scan mode
      let patterns: RegExp[] = [];
      switch (options.mode) {
        case 'regex':
          patterns = languagePatterns.regex || [];
          break;
        case 'ast':
          patterns = languagePatterns.ast || [];
          break;
        case 'dto':
          patterns = languagePatterns.dto || [];
          break;
        default:
          patterns = languagePatterns.regex || [];
      }

      // Scan using selected patterns
      for (const pattern of patterns) {
        const matches = this.findMatches(content, pattern, filePath, language, options.mode);
        results.push(...matches);
      }

      return results;
    } catch (error) {
      console.warn(`[L1X] Could not read file ${filePath}:`, error);
      return [];
    }
  }

  private findMatches(content: string, pattern: RegExp, filePath: string, language: string, scanType: 'regex' | 'ast' | 'dto'): ScanResult[] {
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

        // Extract additional information based on scan type
        const additionalInfo = this.extractAdditionalInfo(matchedText, line, scanType);

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
          createdAt: new Date(),
          scanType,
          ...additionalInfo
        });
        
        // Prevent infinite loop for global regex
        if (!pattern.global) {
          break;
        }
      }
    }
    
    return results;
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

  private classifyEndpointType(matchedText: string): 'transaction' | 'payment' | 'refund' | 'auth' | 'dto' | 'endpoint' | 'class' | 'unknown' {
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
    if (text.includes('dto') || text.includes('model') || text.includes('request') || text.includes('response')) {
      return 'dto';
    }
    if (text.includes('http') || text.includes('endpoint') || text.includes('url')) {
      return 'endpoint';
    }
    if (text.includes('class') || text.includes('service') || text.includes('controller')) {
      return 'class';
    }
    
    return 'unknown';
  }

  private extractAdditionalInfo(matchedText: string, line: string, scanType: 'regex' | 'ast' | 'dto'): Partial<ScanResult> {
    const info: Partial<ScanResult> = {};

    switch (scanType) {
      case 'regex':
        // Extract endpoint URLs
        const urlMatch = matchedText.match(/https?:\/\/[^\s"'`]+/);
        if (urlMatch) {
          info.endpointUrl = urlMatch[0];
        }
        break;

      case 'ast':
        // Extract class names
        const classMatch = matchedText.match(/class\s+(\w+)/i);
        if (classMatch && classMatch[1]) {
          info.className = classMatch[1];
          info.businessLogicType = 'service-class';
        }

        // Extract method names
        const methodMatch = matchedText.match(/(?:function|def|public|private)\s+(\w+)/i);
        if (methodMatch && methodMatch[1]) {
          info.methodName = methodMatch[1];
          info.businessLogicType = 'api-call';
        }

        // Detect endpoint definitions
        if (line.includes('@') && (line.includes('Post') || line.includes('Get') || line.includes('Put') || line.includes('Delete'))) {
          info.businessLogicType = 'endpoint-definition';
        }
        break;

      case 'dto':
        // Extract DTO names
        const dtoMatch = matchedText.match(/(?:class|interface|type)\s+(\w+)/i);
        if (dtoMatch && dtoMatch[1]) {
          info.dtoName = dtoMatch[1];
          info.businessLogicType = 'data-model';
        }
        break;
    }

    return info;
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