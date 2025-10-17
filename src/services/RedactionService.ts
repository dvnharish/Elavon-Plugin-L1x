import { Logger } from '../utils/logger';
import { RedactionResult, RedactedItem } from '../types/copilot';

export class RedactionService {
  private readonly SENSITIVE_PATTERNS = [
    {
      type: 'api_key' as const,
      pattern: /(?:api[_-]?key|apikey|key)["\s]*[:=]["\s]*([A-Za-z0-9]{20,})/gi,
      replacement: '[REDACTED_API_KEY]'
    },
    {
      type: 'token' as const,
      pattern: /(?:token|access[_-]?token|auth[_-]?token)["\s]*[:=]["\s]*([A-Za-z0-9_.-]{20,})/gi,
      replacement: '[REDACTED_TOKEN]'
    },
    {
      type: 'credential' as const,
      pattern: /(?:password|pwd|secret|credential)["\s]*[:=]["\s]*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,})/gi,
      replacement: '[REDACTED_CREDENTIAL]'
    },
    {
      type: 'merchant_id' as const,
      pattern: /(?:merchant[_-]?id|merchantid|mid)["\s]*[:=]["\s]*([A-Za-z0-9]{6,})/gi,
      replacement: '[REDACTED_MERCHANT_ID]'
    },
    {
      type: 'api_key' as const,
      pattern: /(?:converge[_-]?api[_-]?key|CONVERGE_API_KEY)["\s]*[:=]["\s]*([A-Za-z0-9]{20,})/gi,
      replacement: '[REDACTED_CONVERGE_API_KEY]'
    },
    {
      type: 'api_key' as const,
      pattern: /(?:elavon[_-]?api[_-]?key|ELAVON_API_KEY|elavon[_-]?l1[_-]?api[_-]?key|ELAVON_L1_API_KEY)["\s]*[:=]["\s]*([A-Za-z0-9]{20,})/gi,
      replacement: '[REDACTED_ELAVON_API_KEY]'
    },
    {
      type: 'credential' as const,
      pattern: /(?:client[_-]?secret|CLIENT_SECRET)["\s]*[:=]["\s]*([A-Za-z0-9_.-]{20,})/gi,
      replacement: '[REDACTED_CLIENT_SECRET]'
    }
  ];

  redactSensitiveData(content: string): RedactionResult {
    Logger.info('Starting sensitive data redaction');
    
    let redactedContent = content;
    const redactedItems: RedactedItem[] = [];
    let redactionCount = 0;

    try {
      this.SENSITIVE_PATTERNS.forEach(patternConfig => {
        if (!patternConfig) {return;}
        const matches = Array.from(redactedContent.matchAll(patternConfig.pattern));
        
        matches.forEach(match => {
          if (match && match.index !== undefined) {
            const lineNumber = this.getLineNumber(content, match.index);
            const originalValue = match[0];
            
            redactedItems.push({
              type: patternConfig.type,
              originalValue: originalValue,
              redactedValue: patternConfig.replacement,
              lineNumber
            });
            
            redactionCount++;
          }
        });

        // Replace all matches with redacted values
        redactedContent = redactedContent.replace(patternConfig.pattern, patternConfig.replacement);
      });

      Logger.info(`Redaction completed: ${redactionCount} items redacted`);
      
      return {
        redactedContent,
        redactionCount,
        redactedItems
      };
    } catch (error) {
      Logger.error('Error during sensitive data redaction', error as Error);
      
      // Return original content with warning if redaction fails
      return {
        redactedContent: content,
        redactionCount: 0,
        redactedItems: []
      };
    }
  }

  private getLineNumber(content: string, offset: number): number {
    const beforeOffset = content.substring(0, offset);
    return beforeOffset.split('\n').length;
  }

  /**
   * Create a summary report of redacted items for user review
   */
  createRedactionReport(result: RedactionResult): string {
    if (result.redactionCount === 0) {
      return 'No sensitive data detected in the file.';
    }

    const itemsByType = result.redactedItems.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = 0;
      }
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let report = `Redacted ${result.redactionCount} sensitive items:\n`;
    
    Object.entries(itemsByType).forEach(([type, count]) => {
      const typeLabel = type.replace('_', ' ').toUpperCase();
      report += `- ${count} ${typeLabel}${count > 1 ? 'S' : ''}\n`;
    });

    return report;
  }

  /**
   * Validate that redaction was successful by checking for common patterns
   */
  validateRedaction(redactedContent: string): boolean {
    const dangerousPatterns = [
      /[A-Za-z0-9]{32,}/g, // Long alphanumeric strings (likely keys)
      /sk_[A-Za-z0-9_-]{20,}/g, // Stripe-style secret keys
      /pk_[A-Za-z0-9_-]{20,}/g, // Stripe-style public keys
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(redactedContent)) {
        Logger.warn('Potential sensitive data may still be present after redaction');
        return false;
      }
    }

    return true;
  }
}