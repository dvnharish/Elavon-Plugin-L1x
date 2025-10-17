import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IFileStandardAnalyzer,
  StandardDetectionResult,
  StandardDetails,
  DetectedEndpoint,
  MixedStandardIndicator,
  FileStandardCache
} from '../types/contextMenu';
import { Logger } from '../utils/logger';

export class FileStandardAnalyzer implements IFileStandardAnalyzer {
  private cache = new Map<string, FileStandardCache>();

  // Converge API patterns
  private readonly convergePatterns = [
    // Payment endpoints
    /\/api\/v[12]\/payments?\/[a-zA-Z0-9-]+/g,
    /converge\.payment\./g,
    /ConvergePayment/g,
    /converge-payment/g,
    // Auth endpoints
    /\/api\/v[12]\/auth\/converge/g,
    /converge\.auth\./g,
    /ConvergeAuth/g,
    // Refund endpoints
    /\/api\/v[12]\/refunds?\/converge/g,
    /converge\.refund\./g,
    /ConvergeRefund/g,
    // SDK imports
    /import.*converge.*sdk/gi,
    /require.*converge.*sdk/gi,
    // Configuration
    /converge\.config/g,
    /CONVERGE_API_KEY/g,
    /CONVERGE_MERCHANT_ID/g
  ];

  // Elavon L1 API patterns
  private readonly elavonPatterns = [
    // L1 Payment endpoints
    /\/api\/l1\/payments?\/[a-zA-Z0-9-]+/g,
    /elavon\.l1\./g,
    /ElavonL1/g,
    /elavon-l1/g,
    // L1 Auth endpoints
    /\/api\/l1\/auth\/token/g,
    /elavon\.auth\./g,
    /ElavonAuth/g,
    // L1 Transaction endpoints
    /\/api\/l1\/transactions?/g,
    /elavon\.transaction\./g,
    /ElavonTransaction/g,
    // SDK imports
    /import.*elavon.*l1/gi,
    /require.*elavon.*l1/gi,
    // Configuration
    /elavon\.l1\.config/g,
    /ELAVON_L1_API_KEY/g,
    /ELAVON_L1_MERCHANT_ID/g
  ];

  async detectStandard(filePath: string): Promise<StandardDetectionResult> {
    Logger.info(`Detecting standard for file: ${filePath}`);

    try {
      // Check cache first
      const cached = this.getCachedResult(filePath);
      if (cached && cached.cacheValid) {
        Logger.info(`Using cached result for ${filePath}`);
        return cached;
      }

      // Read file content
      const content = await this.readFileContent(filePath);
      const fileHash = this.calculateFileHash(content);

      // Perform analysis
      const result = await this.analyzeFileContent(filePath, content);
      
      // Cache the result
      this.cacheResult(filePath, fileHash, result);

      Logger.info(`Detection completed for ${filePath}: ${result.standard} (${result.confidence}%)`);
      return result;

    } catch (error) {
      Logger.error(`Error detecting standard for ${filePath}:`, error as Error);
      return this.createErrorResult(filePath, error as Error);
    }
  }

  getCachedResult(filePath: string): StandardDetectionResult | null {
    const cached = this.cache.get(filePath);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = new Date();
    if (now > cached.expiresAt) {
      this.cache.delete(filePath);
      return null;
    }

    // Check if file has been modified
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const currentHash = this.calculateFileHash(content);
      if (currentHash !== cached.fileHash) {
        this.cache.delete(filePath);
        return null;
      }
    } catch (error) {
      this.cache.delete(filePath);
      return null;
    }

    return cached.result;
  }

  invalidateCache(filePath: string): void {
    this.cache.delete(filePath);
    Logger.info(`Cache invalidated for ${filePath}`);
  }

  async batchDetect(filePaths: string[]): Promise<Map<string, StandardDetectionResult>> {
    Logger.info(`Batch detecting standards for ${filePaths.length} files`);
    const results = new Map<string, StandardDetectionResult>();

    // Process files in parallel with concurrency limit
    const concurrency = 5;
    const chunks = this.chunkArray(filePaths, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(filePath => this.detectStandard(filePath));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((result, index) => {
        const filePath = chunk[index];
        if (filePath && result.status === 'fulfilled') {
          results.set(filePath, result.value);
        } else if (filePath && result.status === 'rejected') {
          Logger.error(`Failed to detect standard for ${filePath}:`, result.reason);
          results.set(filePath, this.createErrorResult(filePath, result.reason));
        }
      });
    }

    return results;
  }

  private async readFileContent(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  private calculateFileHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private async analyzeFileContent(filePath: string, content: string): Promise<StandardDetectionResult> {
    const language = this.detectLanguage(filePath);
    
    // Perform regex analysis
    const regexResults = this.performRegexAnalysis(content);
    
    // Perform AST analysis for supported languages
    let astResults = regexResults;
    if (this.supportsASTAnalysis(language)) {
      astResults = await this.performASTAnalysis(content, language);
    }

    // Combine results and determine standard
    const standard = this.determineStandard(astResults);
    const confidence = this.calculateConfidence(astResults);
    const details = this.buildStandardDetails(astResults);

    return {
      filePath,
      standard,
      confidence,
      details,
      timestamp: new Date(),
      cacheValid: true
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
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

  private performRegexAnalysis(content: string): { convergeMatches: DetectedEndpoint[], elavonMatches: DetectedEndpoint[] } {
    const convergeMatches: DetectedEndpoint[] = [];
    const elavonMatches: DetectedEndpoint[] = [];
    const lines = content.split('\n');

    // Check Converge patterns
    this.convergePatterns.forEach((pattern, patternIndex) => {
      lines.forEach((line, lineIndex) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            convergeMatches.push({
              name: `converge-pattern-${patternIndex}`,
              standard: 'converge',
              confidence: 0.8,
              lineNumber: lineIndex + 1,
              snippet: line.trim()
            });
          });
        }
      });
    });

    // Check Elavon patterns
    this.elavonPatterns.forEach((pattern, patternIndex) => {
      lines.forEach((line, lineIndex) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            elavonMatches.push({
              name: `elavon-pattern-${patternIndex}`,
              standard: 'elavon',
              confidence: 0.8,
              lineNumber: lineIndex + 1,
              snippet: line.trim()
            });
          });
        }
      });
    });

    return { convergeMatches, elavonMatches };
  }

  private supportsASTAnalysis(language: string): boolean {
    return ['javascript', 'typescript', 'java'].includes(language);
  }

  private async performASTAnalysis(content: string, language: string): Promise<{ convergeMatches: DetectedEndpoint[], elavonMatches: DetectedEndpoint[] }> {
    // For now, return regex results. AST analysis would require additional parsing libraries
    // This is a placeholder for more sophisticated analysis
    return this.performRegexAnalysis(content);
  }

  private determineStandard(results: { convergeMatches: DetectedEndpoint[], elavonMatches: DetectedEndpoint[] }): 'converge' | 'elavon' | 'mixed' | 'unknown' {
    const convergeCount = results.convergeMatches.length;
    const elavonCount = results.elavonMatches.length;

    if (convergeCount === 0 && elavonCount === 0) {
      return 'unknown';
    }

    if (convergeCount > 0 && elavonCount > 0) {
      return 'mixed';
    }

    return convergeCount > elavonCount ? 'converge' : 'elavon';
  }

  private calculateConfidence(results: { convergeMatches: DetectedEndpoint[], elavonMatches: DetectedEndpoint[] }): number {
    const totalMatches = results.convergeMatches.length + results.elavonMatches.length;
    
    if (totalMatches === 0) {
      return 0;
    }

    const convergeCount = results.convergeMatches.length;
    const elavonCount = results.elavonMatches.length;

    if (convergeCount > 0 && elavonCount > 0) {
      // Mixed standard - confidence based on ratio
      const ratio = Math.abs(convergeCount - elavonCount) / totalMatches;
      return Math.round((0.5 + ratio * 0.3) * 100); // 50-80% confidence for mixed
    }

    // Single standard - confidence based on number of matches
    const baseConfidence = Math.min(0.6 + (totalMatches * 0.1), 0.95);
    return Math.round(baseConfidence * 100);
  }

  private buildStandardDetails(results: { convergeMatches: DetectedEndpoint[], elavonMatches: DetectedEndpoint[] }): StandardDetails {
    const totalMatches = results.convergeMatches.length + results.elavonMatches.length;
    const convergePercentage = totalMatches > 0 ? Math.round((results.convergeMatches.length / totalMatches) * 100) : 0;
    const elavonPercentage = totalMatches > 0 ? Math.round((results.elavonMatches.length / totalMatches) * 100) : 0;

    const detectedEndpoints = [...results.convergeMatches, ...results.elavonMatches];
    
    let mixedIndicators: MixedStandardIndicator[] | undefined;
    if (results.convergeMatches.length > 0 && results.elavonMatches.length > 0) {
      mixedIndicators = [{
        type: 'endpoint',
        convergeCount: results.convergeMatches.length,
        elavonCount: results.elavonMatches.length,
        description: `File contains both Converge (${results.convergeMatches.length}) and Elavon (${results.elavonMatches.length}) patterns`
      }];
    }

    const details: StandardDetails = {
      convergePercentage,
      elavonPercentage,
      detectedEndpoints,
      analysisMethod: 'regex'
    };

    if (mixedIndicators) {
      details.mixedIndicators = mixedIndicators;
    }

    return details;
  }

  private cacheResult(filePath: string, fileHash: string, result: StandardDetectionResult): void {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Cache for 1 hour

    this.cache.set(filePath, {
      filePath,
      fileHash,
      result,
      cachedAt: new Date(),
      expiresAt
    });
  }

  private createErrorResult(filePath: string, error: Error): StandardDetectionResult {
    return {
      filePath,
      standard: 'unknown',
      confidence: 0,
      details: {
        convergePercentage: 0,
        elavonPercentage: 0,
        detectedEndpoints: [],
        analysisMethod: 'regex'
      },
      timestamp: new Date(),
      cacheValid: false
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}