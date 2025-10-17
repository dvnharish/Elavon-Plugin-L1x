import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { OpenApiSpecSection } from '../types/copilot';
import { StandardDetectionResult } from '../types/contextMenu';

export class OpenApiService {
  private convergeSpec: any = null;
  private elavonSpec: any = null;
  private specCache = new Map<string, any>();
  private readonly DEFAULT_CONVERGE_PATH = 'openapi/Converge Open API.json';
  private readonly DEFAULT_ELAVON_PATH = 'openapi/Elavon API Gateway Open API.json';

  async loadSpecs(): Promise<void> {
    Logger.info('Loading OpenAPI specifications');
    
    try {
      if (!this.convergeSpec) {
        this.convergeSpec = await this.loadSpecFile(this.DEFAULT_CONVERGE_PATH);
      }
      if (!this.elavonSpec) {
        this.elavonSpec = await this.loadSpecFile(this.DEFAULT_ELAVON_PATH);
      }
      
      Logger.info('OpenAPI specifications loaded successfully');
    } catch (error) {
      Logger.error('Failed to load OpenAPI specifications', error as Error);
      // Continue without specs - graceful degradation
    }
  }

  async loadConvergeSpec(): Promise<any> {
    if (!this.convergeSpec) {
      await this.loadSpecs();
    }
    return this.convergeSpec;
  }

  async loadElavonSpec(): Promise<any> {
    if (!this.elavonSpec) {
      await this.loadSpecs();
    }
    return this.elavonSpec;
  }

  async getRelevantSections(detectedStandard?: StandardDetectionResult): Promise<OpenApiSpecSection[]> {
    await this.loadSpecs();
    
    if (!detectedStandard?.details?.detectedEndpoints || detectedStandard.details.detectedEndpoints.length === 0) {
      Logger.info('No detected endpoints, returning empty spec sections');
      return [];
    }

    const sections: OpenApiSpecSection[] = [];
    
    try {
      // Extract relevant sections based on detected endpoints
      for (const endpoint of detectedStandard.details.detectedEndpoints) {
        if (endpoint.standard === 'converge' && this.convergeSpec) {
          const convergeSection = this.findSpecSection(this.convergeSpec, endpoint.name, 'Converge');
          if (convergeSection) {
            sections.push(convergeSection);
          }
        }
        
        if (endpoint.standard === 'elavon' && this.elavonSpec) {
          const elavonSection = this.findSpecSection(this.elavonSpec, endpoint.name, 'Elavon L1');
          if (elavonSection) {
            sections.push(elavonSection);
          }
        }
      }

      // Add general payment endpoints if detected
      if (this.hasPaymentEndpoints(detectedStandard)) {
        sections.push(...this.getPaymentSpecSections());
      }

      Logger.info(`Found ${sections.length} relevant spec sections`);
      return sections;
    } catch (error) {
      Logger.error('Error extracting relevant spec sections', error as Error);
      return [];
    }
  }

  private async loadSpecFile(specPath: string): Promise<any> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const fullPath = path.join(workspaceFolder.uri.fsPath, specPath);
      
      // Check cache first
      if (this.specCache.has(fullPath)) {
        Logger.info(`Using cached spec: ${specPath}`);
        return this.specCache.get(fullPath);
      }

      if (!fs.existsSync(fullPath)) {
        Logger.warn(`OpenAPI spec file not found: ${fullPath}`);
        return null;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const spec = JSON.parse(content);
      
      // Cache the loaded spec
      this.specCache.set(fullPath, spec);
      
      Logger.info(`Loaded OpenAPI spec: ${specPath}`);
      return spec;
    } catch (error) {
      Logger.error(`Failed to load spec file: ${specPath}`, error as Error);
      return null;
    }
  }

  private findSpecSection(spec: any, endpointName: string, specType: string): OpenApiSpecSection | null {
    if (!spec || !spec.paths) {
      return null;
    }

    try {
      // Look for matching paths in the spec
      const matchingPaths = Object.keys(spec.paths).filter(path => {
        const normalizedPath = path.toLowerCase();
        const normalizedEndpoint = endpointName.toLowerCase();
        
        return normalizedPath.includes(normalizedEndpoint) || 
               normalizedPath.includes('payment') ||
               normalizedPath.includes('transaction');
      });

      if (matchingPaths.length === 0) {
        return null;
      }

      // Get the first matching path and its operations
      const matchingPath = matchingPaths[0];
      if (!matchingPath) {
        return null;
      }
      const pathSpec = spec.paths[matchingPath];

      return {
        title: `${specType} - ${matchingPath}`,
        path: matchingPath,
        content: pathSpec,
        relevanceScore: this.calculateRelevanceScore(endpointName, matchingPath)
      };
    } catch (error) {
      Logger.error(`Error finding spec section for endpoint: ${endpointName}`, error as Error);
      return null;
    }
  }

  private hasPaymentEndpoints(detectedStandard: StandardDetectionResult): boolean {
    return detectedStandard.details.detectedEndpoints.some(endpoint => 
      endpoint.name.toLowerCase().includes('payment') ||
      endpoint.name.toLowerCase().includes('transaction')
    );
  }

  private getPaymentSpecSections(): OpenApiSpecSection[] {
    const sections: OpenApiSpecSection[] = [];

    try {
      // Add general payment sections from both specs
      if (this.convergeSpec?.paths) {
        const convergePaymentPaths = Object.keys(this.convergeSpec.paths).filter(path =>
          path.toLowerCase().includes('payment')
        );

        convergePaymentPaths.slice(0, 2).forEach(path => { // Limit to 2 sections
          sections.push({
            title: `Converge - ${path}`,
            path: path,
            content: this.convergeSpec.paths[path],
            relevanceScore: 0.8
          });
        });
      }

      if (this.elavonSpec?.paths) {
        const elavonPaymentPaths = Object.keys(this.elavonSpec.paths).filter(path =>
          path.toLowerCase().includes('payment') || path.toLowerCase().includes('l1')
        );

        elavonPaymentPaths.slice(0, 2).forEach(path => { // Limit to 2 sections
          sections.push({
            title: `Elavon L1 - ${path}`,
            path: path,
            content: this.elavonSpec.paths[path],
            relevanceScore: 0.8
          });
        });
      }
    } catch (error) {
      Logger.error('Error getting payment spec sections', error as Error);
    }

    return sections;
  }

  private calculateRelevanceScore(endpointName: string, specPath: string): number {
    const normalizedEndpoint = endpointName.toLowerCase();
    const normalizedPath = specPath.toLowerCase();

    let score = 0.5; // Base score

    // Exact match
    if (normalizedPath.includes(normalizedEndpoint)) {
      score += 0.4;
    }

    // Payment-related
    if (normalizedPath.includes('payment') && normalizedEndpoint.includes('payment')) {
      score += 0.3;
    }

    // Transaction-related
    if (normalizedPath.includes('transaction') && normalizedEndpoint.includes('transaction')) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Clear the spec cache (useful for testing or when specs are updated)
   */
  clearCache(): void {
    this.specCache.clear();
    this.convergeSpec = null;
    this.elavonSpec = null;
    Logger.info('OpenAPI spec cache cleared');
  }

  /**
   * Get configuration paths for specs
   */
  getSpecPaths(): { converge: string; elavon: string } {
    const config = vscode.workspace.getConfiguration('l1x.copilot');
    return {
      converge: config.get('convergeSpecPath', this.DEFAULT_CONVERGE_PATH),
      elavon: config.get('elavonSpecPath', this.DEFAULT_ELAVON_PATH)
    };
  }
}