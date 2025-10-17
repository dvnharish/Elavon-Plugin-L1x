import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { OpenApiService } from './OpenApiService';
import { SpecDiffEngine, SpecDifference, DiffSummary } from './SpecDiffEngine';
import { FieldMappingService, FieldMapping, MappingGroup } from './FieldMappingService';
import { FileStandardAnalyzer } from './FileStandardAnalyzer';
import { StandardDetectionResult } from '../types/contextMenu';

export interface ComparisonView {
  id: string;
  convergeSpec: any;
  elavonSpec: any;
  differences: SpecDifference[];
  fieldMappings: MappingGroup[];
  relevantSections: SpecSection[];
  summary: DiffSummary;
  createdAt: Date;
}

export interface SpecSection {
  path: string;
  title: string;
  content: any;
  relevanceScore: number;
  specType: 'converge' | 'elavon';
}

export interface ISpecComparisonService {
  createComparison(filePath?: string): Promise<ComparisonView>;
  exportComparison(comparison: ComparisonView, format: 'json' | 'markdown' | 'html'): Promise<string>;
  getRelevantSections(filePath: string): Promise<SpecSection[]>;
}

export class SpecComparisonService implements ISpecComparisonService {
  constructor(
    private openApiService: OpenApiService,
    private specDiffEngine: SpecDiffEngine,
    private fieldMappingService: FieldMappingService,
    private fileStandardAnalyzer: FileStandardAnalyzer
  ) {}

  async createComparison(filePath?: string): Promise<ComparisonView> {
    Logger.info(`Creating OpenAPI spec comparison${filePath ? ` for file: ${filePath}` : ''}`);

    try {
      // Load both specifications
      await this.openApiService.loadSpecs();
      const convergeSpec = await this.openApiService.loadConvergeSpec();
      const elavonSpec = await this.openApiService.loadElavonSpec();

      if (!convergeSpec || !elavonSpec) {
        throw new Error('Failed to load one or both OpenAPI specifications');
      }

      // Calculate differences
      const differences = this.specDiffEngine.calculateDifferences(convergeSpec, elavonSpec);
      const summary = this.specDiffEngine.generateSummary(differences);

      // Generate field mappings
      const fieldMappings = this.fieldMappingService.generateMappings(convergeSpec, elavonSpec);

      // Get relevant sections if file path provided
      const relevantSections = filePath ? await this.getRelevantSections(filePath) : [];

      const comparison: ComparisonView = {
        id: `comparison-${Date.now()}`,
        convergeSpec,
        elavonSpec,
        differences,
        fieldMappings,
        relevantSections,
        summary,
        createdAt: new Date()
      };

      Logger.info(`Comparison created with ${differences.length} differences and ${fieldMappings.length} mapping groups`);
      return comparison;
    } catch (error) {
      Logger.error('Failed to create spec comparison', error as Error);
      throw error;
    }
  }

  async getRelevantSections(filePath: string): Promise<SpecSection[]> {
    Logger.info(`Finding relevant spec sections for file: ${filePath}`);

    try {
      // Get file standard detection
      const standardDetection = await this.fileStandardAnalyzer.detectStandard(filePath);
      
      if (!standardDetection.details?.detectedEndpoints || standardDetection.details.detectedEndpoints.length === 0) {
        Logger.info('No detected endpoints found, returning empty relevant sections');
        return [];
      }

      const relevantSections: SpecSection[] = [];

      // Get relevant sections from OpenAPI service
      const openApiSections = await this.openApiService.getRelevantSections(standardDetection);
      
      // Convert to SpecSection format
      openApiSections.forEach(section => {
        relevantSections.push({
          path: section.path,
          title: section.title,
          content: section.content,
          relevanceScore: section.relevanceScore,
          specType: section.title.toLowerCase().includes('converge') ? 'converge' : 'elavon'
        });
      });

      Logger.info(`Found ${relevantSections.length} relevant sections`);
      return relevantSections;
    } catch (error) {
      Logger.error('Failed to get relevant sections', error as Error);
      return [];
    }
  } 
 async exportComparison(comparison: ComparisonView, format: 'json' | 'markdown' | 'html'): Promise<string> {
    Logger.info(`Exporting comparison in ${format} format`);

    try {
      switch (format) {
        case 'json':
          return this.exportAsJson(comparison);
        case 'markdown':
          return this.exportAsMarkdown(comparison);
        case 'html':
          return this.exportAsHtml(comparison);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      Logger.error('Failed to export comparison', error as Error);
      throw error;
    }
  }

  private exportAsJson(comparison: ComparisonView): string {
    // Create a clean export object without circular references
    const exportData = {
      id: comparison.id,
      createdAt: comparison.createdAt,
      summary: comparison.summary,
      differences: comparison.differences,
      fieldMappings: comparison.fieldMappings,
      relevantSections: comparison.relevantSections.map(section => ({
        path: section.path,
        title: section.title,
        relevanceScore: section.relevanceScore,
        specType: section.specType
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsMarkdown(comparison: ComparisonView): string {
    const { summary, differences, fieldMappings } = comparison;
    
    let markdown = `# OpenAPI Specification Comparison Report

**Generated**: ${comparison.createdAt.toLocaleString()}
**Comparison ID**: ${comparison.id}

## Summary

- **Total Differences**: ${summary.totalDifferences}
- **Added**: ${summary.addedCount}
- **Removed**: ${summary.removedCount}
- **Modified**: ${summary.modifiedCount}
- **Breaking Changes**: ${summary.breakingChanges}
- **Non-Breaking Changes**: ${summary.nonBreakingChanges}
- **Enhancements**: ${summary.enhancements}

## Differences

`;

    // Group differences by type
    const groupedDiffs = {
      breaking: differences.filter(d => d.impact === 'breaking'),
      'non-breaking': differences.filter(d => d.impact === 'non-breaking'),
      enhancement: differences.filter(d => d.impact === 'enhancement')
    };

    Object.entries(groupedDiffs).forEach(([impact, diffs]) => {
      if (diffs.length > 0) {
        markdown += `### ${impact.charAt(0).toUpperCase() + impact.slice(1)} Changes\n\n`;
        
        diffs.forEach(diff => {
          const icon = diff.type === 'added' ? '➕' : diff.type === 'removed' ? '➖' : '🔄';
          markdown += `${icon} **${diff.path}**: ${diff.description}\n`;
          if (diff.oldValue && diff.newValue) {
            markdown += `   - Old: \`${JSON.stringify(diff.oldValue)}\`\n`;
            markdown += `   - New: \`${JSON.stringify(diff.newValue)}\`\n`;
          }
          markdown += '\n';
        });
      }
    });

    // Add field mappings
    if (fieldMappings.length > 0) {
      markdown += `## Field Mappings\n\n`;
      
      fieldMappings.forEach(group => {
        markdown += `### ${group.endpoint} (Confidence: ${Math.round(group.confidence * 100)}%)\n\n`;
        
        group.mappings.forEach(mapping => {
          const transformIcon = mapping.transformationRequired ? '🔄' : '✅';
          markdown += `${transformIcon} \`${mapping.sourceField}\` → \`${mapping.targetField}\``;
          
          if (mapping.sourceType !== mapping.targetType) {
            markdown += ` (${mapping.sourceType} → ${mapping.targetType})`;
          }
          
          if (mapping.transformationRule) {
            markdown += `\n   - Transformation: ${mapping.transformationRule}`;
          }
          
          markdown += '\n\n';
        });
      });
    }

    markdown += `---\n*Generated by L1X ElavonX Migrator*`;
    
    return markdown;
  }

  private exportAsHtml(comparison: ComparisonView): string {
    const markdownContent = this.exportAsMarkdown(comparison);
    
    // Simple markdown to HTML conversion
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>OpenAPI Specification Comparison</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        h1, h2, h3 { color: #333; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .breaking { color: #d73a49; }
        .non-breaking { color: #28a745; }
        .enhancement { color: #0366d6; }
        code { background: #f6f8fa; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    </style>
</head>
<body>`;

    // Convert markdown to HTML (basic conversion)
    html += markdownContent
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, '<p>$1</p>');

    html += `</body></html>`;
    
    return html;
  }
}