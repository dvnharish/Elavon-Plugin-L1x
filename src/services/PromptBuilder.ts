import { Logger } from '../utils/logger';
import { FileContext } from '../types/copilot';

export class PromptBuilder {
  private readonly MAX_PROMPT_LENGTH = 8000; // Conservative limit for API
  
  private readonly MIGRATION_TEMPLATE = `# Converge to Elavon L1 Migration Request

## File Information
- **File**: {{filePath}}
- **Language**: {{language}}
- **Size**: {{fileSize}} bytes{{#if truncated}} (content truncated){{/if}}{{#if detectedStandard}}
- **Detected Standard**: {{detectedStandard.standard}} ({{detectedStandard.confidence}}% confidence){{/if}}

## Current Code
\`\`\`{{language}}
{{content}}
\`\`\`{{#if detectedEndpoints}}

## Detected API Patterns{{#each detectedEndpoints}}
- {{name}} ({{standard}}, {{confidence}}% confidence){{/each}}{{/if}}{{#if relevantSpecs}}

## Relevant API Specifications{{#each relevantSpecs}}
### {{title}}
\`\`\`json
{{content}}
\`\`\`{{/each}}{{/if}}

## Migration Request
Please help migrate this {{language}} code from Converge API to Elavon L1 API:

1. **Identify** all Converge API calls and patterns in the code
2. **Map** them to equivalent Elavon L1 endpoints and patterns
3. **Provide** specific code changes needed for the migration
4. **Explain** the key differences and any manual steps required
5. **Highlight** any potential issues or breaking changes

Please provide both the migrated code and a clear explanation of the changes made.`;

  createMigrationPrompt(context: FileContext, customInstructions?: string): string {
    Logger.info(`Creating migration prompt for: ${context.filePath}`);

    try {
      // Prepare template context
      const templateContext = this.prepareTemplateContext(context);
      
      // Render the base template
      let prompt = this.renderTemplate(this.MIGRATION_TEMPLATE, templateContext);
      
      // Add custom instructions if provided
      if (customInstructions && customInstructions.trim()) {
        prompt += `\n\n## Additional Instructions\n${customInstructions.trim()}`;
      }

      // Ensure prompt doesn't exceed length limits
      prompt = this.truncatePromptIfNeeded(prompt);

      Logger.info(`Migration prompt created (${prompt.length} characters)`);
      return prompt;
    } catch (error) {
      Logger.error('Failed to create migration prompt', error as Error);
      throw error;
    }
  }

  createCustomPrompt(template: string, context: FileContext): string {
    Logger.info('Creating custom prompt from template');

    try {
      const templateContext = this.prepareTemplateContext(context);
      const prompt = this.renderTemplate(template, templateContext);
      return this.truncatePromptIfNeeded(prompt);
    } catch (error) {
      Logger.error('Failed to create custom prompt', error as Error);
      throw error;
    }
  }

  private prepareTemplateContext(context: FileContext): any {
    const templateContext: any = {
      filePath: context.filePath,
      fileName: context.fileName,
      language: context.language,
      content: context.content,
      fileSize: context.fileSize,
      truncated: context.truncated
    };

    // Add detected standard information
    if (context.detectedStandard) {
      templateContext.detectedStandard = {
        standard: context.detectedStandard.standard,
        confidence: context.detectedStandard.confidence
      };

      // Add detected endpoints
      if (context.detectedStandard.details?.detectedEndpoints?.length > 0) {
        templateContext.detectedEndpoints = context.detectedStandard.details.detectedEndpoints.map(endpoint => ({
          name: endpoint.name,
          standard: endpoint.standard,
          confidence: endpoint.confidence
        }));
      }
    }

    // Add relevant specs (limit to prevent prompt bloat)
    if (context.relevantSpecs.length > 0) {
      templateContext.relevantSpecs = context.relevantSpecs.slice(0, 3).map(spec => ({
        title: spec.title,
        content: this.formatSpecContent(spec.content)
      }));
    }

    return templateContext;
  }

  private renderTemplate(template: string, context: any): string {
    let result = template;

    try {
      // Handle conditional blocks {{#if condition}}...{{/if}}
      result = this.processConditionalBlocks(result, context);

      // Handle each blocks {{#each array}}...{{/each}}
      result = this.processEachBlocks(result, context);

      // Handle simple variable substitution {{variable}}
      result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const value = this.getNestedValue(context, path);
        return value !== undefined ? String(value) : match;
      });

      return result;
    } catch (error) {
      Logger.error('Error rendering template', error as Error);
      return template; // Return original template if rendering fails
    }
  }

  private processConditionalBlocks(template: string, context: any): string {
    const conditionalRegex = /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const value = this.getNestedValue(context, condition);
      const shouldInclude = this.isTruthy(value);
      return shouldInclude ? content : '';
    });
  }

  private processEachBlocks(template: string, context: any): string {
    const eachRegex = /\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (match, arrayPath, itemTemplate) => {
      const array = this.getNestedValue(context, arrayPath);
      
      if (!Array.isArray(array) || array.length === 0) {
        return '';
      }

      return array.map(item => {
        // Replace {{property}} with item.property in the item template
        return itemTemplate.replace(/\{\{(\w+)\}\}/g, (itemMatch: string, prop: string) => {
          const value = item[prop];
          return value !== undefined ? String(value) : itemMatch;
        });
      }).join('');
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private isTruthy(value: any): boolean {
    if (value === null || value === undefined) {return false;}
    if (typeof value === 'boolean') {return value;}
    if (typeof value === 'number') {return value !== 0;}
    if (typeof value === 'string') {return value.length > 0;}
    if (Array.isArray(value)) {return value.length > 0;}
    if (typeof value === 'object') {return Object.keys(value).length > 0;}
    return Boolean(value);
  }

  private formatSpecContent(content: any): string {
    try {
      if (typeof content === 'string') {
        return content;
      }
      
      // Limit the spec content to prevent prompt bloat
      const formatted = JSON.stringify(content, null, 2);
      if (formatted.length > 1000) {
        // Truncate large specs
        return formatted.substring(0, 1000) + '\n  // ... [truncated]';
      }
      
      return formatted;
    } catch (error) {
      Logger.warn('Failed to format spec content', error as Error);
      return '[Unable to format spec content]';
    }
  }

  private truncatePromptIfNeeded(prompt: string): string {
    if (prompt.length <= this.MAX_PROMPT_LENGTH) {
      return prompt;
    }

    Logger.warn(`Prompt exceeds length limit (${prompt.length} > ${this.MAX_PROMPT_LENGTH}), truncating`);

    // Find a good truncation point (end of a section)
    const truncationPoint = this.findGoodTruncationPoint(prompt, this.MAX_PROMPT_LENGTH - 100);
    
    let truncated = prompt.substring(0, truncationPoint);
    truncated += '\n\n[Prompt truncated due to length limits]';
    
    return truncated;
  }

  private findGoodTruncationPoint(text: string, maxLength: number): number {
    if (maxLength >= text.length) {
      return text.length;
    }

    // Look for good break points near the max length
    const searchStart = Math.max(0, maxLength - 200);
    const searchEnd = Math.min(text.length, maxLength);
    const searchText = text.substring(searchStart, searchEnd);

    // Prefer to break at section boundaries
    const sectionBreak = searchText.lastIndexOf('\n## ');
    if (sectionBreak !== -1) {
      return searchStart + sectionBreak;
    }

    // Fall back to paragraph breaks
    const paragraphBreak = searchText.lastIndexOf('\n\n');
    if (paragraphBreak !== -1) {
      return searchStart + paragraphBreak;
    }

    // Fall back to line breaks
    const lineBreak = searchText.lastIndexOf('\n');
    if (lineBreak !== -1) {
      return searchStart + lineBreak;
    }

    // Last resort: hard truncation
    return maxLength;
  }

  /**
   * Get template suggestions based on file context
   */
  getTemplateSuggestions(context: FileContext): string[] {
    const suggestions: string[] = [];

    if (context.detectedStandard?.standard === 'converge') {
      suggestions.push('Focus on identifying Converge-specific patterns and their Elavon L1 equivalents');
    }

    if (context.detectedStandard?.standard === 'mixed') {
      suggestions.push('This file contains mixed API patterns - please identify which parts need migration');
    }

    if (context.language === 'javascript' || context.language === 'typescript') {
      suggestions.push('Pay attention to async/await patterns and Promise handling differences');
    }

    if (context.relevantSpecs.length > 0) {
      suggestions.push('Use the provided OpenAPI specifications to ensure accurate endpoint mappings');
    }

    if (context.truncated) {
      suggestions.push('Note: File content was truncated - consider reviewing the complete file for full context');
    }

    return suggestions;
  }
}