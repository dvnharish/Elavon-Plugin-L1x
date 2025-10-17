import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { FileContext } from '../types/copilot';
import { FileStandardAnalyzer } from './FileStandardAnalyzer';
import { OpenApiService } from './OpenApiService';
import { StandardDetectionResult } from '../types/contextMenu';

export class FileContextBuilder {
  private readonly MAX_CONTENT_SIZE = 100 * 1024; // 100KB limit
  private readonly SUPPORTED_LANGUAGES = new Map([
    ['.js', 'javascript'],
    ['.ts', 'typescript'],
    ['.jsx', 'javascript'],
    ['.tsx', 'typescript'],
    ['.java', 'java'],
    ['.cs', 'csharp'],
    ['.py', 'python'],
    ['.php', 'php'],
    ['.rb', 'ruby'],
    ['.vb', 'vb'],
    ['.go', 'go'],
    ['.cpp', 'cpp'],
    ['.c', 'c']
  ]);

  constructor(
    private fileStandardAnalyzer: FileStandardAnalyzer,
    private openApiService: OpenApiService
  ) {}

  async buildContext(filePath: string): Promise<FileContext> {
    Logger.info(`Building file context for: ${filePath}`);

    try {
      // Read file content
      const content = await this.readFileContent(filePath);
      const language = this.detectLanguage(filePath);
      const fileName = path.basename(filePath);
      const fileSize = content.length;

      // Get existing standard detection if available
      const detectedStandard = await this.getStandardDetection(filePath);

      // Get relevant OpenAPI spec sections
      const relevantSpecs = await this.getRelevantSpecs(detectedStandard);

      // Truncate content if needed
      const { processedContent, truncated } = this.processContent(content);

      const context: FileContext = {
        filePath,
        fileName,
        language,
        content: processedContent,
        detectedStandard: detectedStandard || undefined,
        relevantSpecs,
        fileSize,
        truncated
      };

      Logger.info(`File context built successfully: ${fileName} (${language}, ${fileSize} bytes, truncated: ${truncated})`);
      return context;
    } catch (error) {
      Logger.error(`Failed to build file context for ${filePath}`, error as Error);
      throw error;
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      // Handle both absolute and relative paths
      let fullPath = filePath;
      
      if (!path.isAbsolute(filePath)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
        }
      }

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
      }

      const stats = fs.statSync(fullPath);
      
      // Check if file is too large
      if (stats.size > this.MAX_CONTENT_SIZE * 2) { // Allow 2x limit for initial read
        Logger.warn(`File is very large (${stats.size} bytes): ${filePath}`);
      }

      // Check if file is binary
      if (this.isBinaryFile(fullPath)) {
        throw new Error(`Binary file not supported: ${filePath}`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      return content;
    } catch (error) {
      Logger.error(`Failed to read file: ${filePath}`, error as Error);
      throw error;
    }
  }

  private detectLanguage(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    const language = this.SUPPORTED_LANGUAGES.get(extension);
    
    if (!language) {
      Logger.warn(`Unknown file extension: ${extension}, defaulting to 'text'`);
      return 'text';
    }

    return language;
  }

  private async getStandardDetection(filePath: string): Promise<StandardDetectionResult | undefined> {
    try {
      // First check if we have cached results
      const cached = this.fileStandardAnalyzer.getCachedResult(filePath);
      if (cached && cached.cacheValid) {
        Logger.info(`Using cached standard detection for: ${filePath}`);
        return cached;
      }

      // Run detection if not cached
      Logger.info(`Running standard detection for: ${filePath}`);
      const result = await this.fileStandardAnalyzer.detectStandard(filePath);
      return result;
    } catch (error) {
      Logger.warn(`Failed to get standard detection for ${filePath}`, error as Error);
      return undefined;
    }
  }

  private async getRelevantSpecs(detectedStandard?: StandardDetectionResult): Promise<import('../types/copilot').OpenApiSpecSection[]> {
    try {
      return await this.openApiService.getRelevantSections(detectedStandard);
    } catch (error) {
      Logger.warn('Failed to get relevant OpenAPI specs', error as Error);
      return [];
    }
  }

  private processContent(content: string): { processedContent: string; truncated: boolean } {
    if (content.length <= this.MAX_CONTENT_SIZE) {
      return { processedContent: content, truncated: false };
    }

    Logger.info(`Content exceeds size limit (${content.length} > ${this.MAX_CONTENT_SIZE}), truncating`);

    // Try to preserve important sections
    const truncatedContent = this.intelligentTruncation(content);
    
    return { 
      processedContent: truncatedContent, 
      truncated: true 
    };
  }

  private intelligentTruncation(content: string): string {
    const lines = content.split('\n');
    const maxLines = Math.floor(this.MAX_CONTENT_SIZE / 50); // Estimate ~50 chars per line
    
    if (lines.length <= maxLines) {
      return content.substring(0, this.MAX_CONTENT_SIZE);
    }

    // Prioritize lines with API-related content
    const importantLines: { line: string; index: number; score: number }[] = [];
    const apiKeywords = ['api', 'endpoint', 'request', 'response', 'payment', 'transaction', 'converge', 'elavon', 'l1'];
    
    lines.forEach((line, index) => {
      let score = 0;
      const lowerLine = line.toLowerCase();
      
      // Score based on API-related keywords
      apiKeywords.forEach(keyword => {
        if (lowerLine.includes(keyword)) {
          score += 1;
        }
      });

      // Boost score for function/class definitions
      if (lowerLine.includes('function') || lowerLine.includes('class') || lowerLine.includes('def ')) {
        score += 2;
      }

      // Boost score for import/require statements
      if (lowerLine.includes('import') || lowerLine.includes('require') || lowerLine.includes('using')) {
        score += 1;
      }

      importantLines.push({ line, index, score });
    });

    // Sort by score and take the most important lines
    importantLines.sort((a, b) => b.score - a.score);
    const selectedLines = importantLines.slice(0, maxLines);
    
    // Sort back by original index to maintain structure
    selectedLines.sort((a, b) => a.index - b.index);
    
    let result = selectedLines.map(item => item.line).join('\n');
    
    // If still too long, do simple truncation
    if (result.length > this.MAX_CONTENT_SIZE) {
      result = result.substring(0, this.MAX_CONTENT_SIZE);
    }

    // Add truncation notice
    result += '\n\n// ... [Content truncated for size] ...';
    
    return result;
  }

  private isBinaryFile(filePath: string): boolean {
    try {
      const buffer = fs.readFileSync(filePath, { encoding: null });
      const sample = buffer.slice(0, 512); // Check first 512 bytes
      
      // Check for null bytes (common in binary files)
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) {
          return true;
        }
      }

      // Check for high percentage of non-printable characters
      let nonPrintable = 0;
      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        if (byte !== undefined && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) { // Not tab, LF, or CR
          nonPrintable++;
        }
      }

      return (nonPrintable / sample.length) > 0.3; // More than 30% non-printable
    } catch (error) {
      Logger.warn(`Could not determine if file is binary: ${filePath}`, error as Error);
      return false; // Assume text if we can't determine
    }
  }

  /**
   * Validate that the file context is suitable for sending to Copilot
   */
  validateContext(context: FileContext): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!context.content || context.content.trim().length === 0) {
      issues.push('File content is empty');
    }

    if (context.language === 'text' && !context.filePath.endsWith('.txt')) {
      issues.push('Unknown file type - may not be suitable for code analysis');
    }

    if (context.fileSize > this.MAX_CONTENT_SIZE * 2) {
      issues.push('File is very large and may not process well');
    }

    if (context.truncated) {
      issues.push('File content was truncated due to size limits');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}