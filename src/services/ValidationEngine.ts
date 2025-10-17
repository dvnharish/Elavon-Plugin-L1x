/**
 * Validation Engine Service
 * Validates files against Elavon L1 API standards and provides fix suggestions
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { 
  IValidationEngine, 
  ValidationResult, 
  ValidationViolation, 
  ValidationRule, 
  FixSuggestion, 
  LintResult,
  ValidationWarning,
  LintIssue
} from '../types/contextMenu'

export class ValidationEngine implements IValidationEngine {
  private validationRules: ValidationRule[] = []
  private cache = new Map<string, ValidationResult>()
  private readonly cacheExpiry = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.initializeValidationRules()
  }

  async validateFile(filePath: string): Promise<ValidationResult> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cached = this.getCachedResult(filePath)
      if (cached) {
        return cached
      }

      const content = await fs.promises.readFile(filePath, 'utf-8')
      const language = this.detectLanguage(filePath)
      
      const violations: ValidationViolation[] = []
      const warnings: ValidationWarning[] = []

      // Run schema validation
      const schemaViolations = await this.validateSchema(content, language, filePath)
      violations.push(...schemaViolations)

      // Run semantic validation
      const semanticViolations = await this.validateSemantics(content, language, filePath)
      violations.push(...semanticViolations)

      // Run style validation
      const styleViolations = await this.validateStyle(content, language, filePath)
      violations.push(...styleViolations)

      // Run security validation
      const securityViolations = await this.validateSecurity(content, language, filePath)
      violations.push(...securityViolations)

      // Run linting if available
      let lintResults: LintResult | undefined
      try {
        lintResults = await this.runLinting(filePath, language)
      } catch (error) {
        // Linting is optional, continue without it
        console.warn('Linting failed:', error)
      }

      const result: ValidationResult = {
        filePath,
        isCompliant: violations.filter(v => v.severity === 'error').length === 0,
        overallScore: this.calculateComplianceScore(violations, warnings),
        violations,
        warnings,
        validatedAt: new Date(),
        validationDuration: Date.now() - startTime
      }

      if (lintResults) {
        result.lintResults = lintResults
      }

      // Cache the result
      this.cache.set(filePath, result)
      setTimeout(() => this.cache.delete(filePath), this.cacheExpiry)

      return result
    } catch (error) {
      throw new Error(`Validation failed for ${filePath}: ${error}`)
    }
  }

  async validateBatch(filePaths: string[]): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>()
    
    // Process files in parallel with concurrency limit
    const concurrency = 5
    const chunks = this.chunkArray(filePaths, concurrency)
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (filePath) => {
        try {
          const result = await this.validateFile(filePath)
          results.set(filePath, result)
        } catch (error) {
          console.error(`Failed to validate ${filePath}:`, error)
        }
      })
      
      await Promise.all(promises)
    }
    
    return results
  }

  async getValidationRules(): Promise<ValidationRule[]> {
    return [...this.validationRules]
  }

  async suggestFixes(violations: ValidationViolation[]): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = []

    for (const violation of violations) {
      const suggestion = await this.generateFixSuggestion(violation)
      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return suggestions
  }

  async runLinting(filePath: string, language: string): Promise<LintResult> {
    const issues: LintIssue[] = []
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      // Basic linting rules for common issues
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line) continue
        
        const lineNumber = i + 1

        // Check for common issues
        if (line.includes('console.log') && language === 'javascript') {
          issues.push({
            line: lineNumber,
            column: line.indexOf('console.log') + 1,
            severity: 'warning',
            message: 'Remove console.log statements in production code',
            rule: 'no-console',
            fixable: true
          })
        }

        if (line.includes('TODO') || line.includes('FIXME')) {
          issues.push({
            line: lineNumber,
            column: line.indexOf('TODO') !== -1 ? line.indexOf('TODO') + 1 : line.indexOf('FIXME') + 1,
            severity: 'info',
            message: 'TODO/FIXME comment found',
            rule: 'no-todo',
            fixable: false
          })
        }

        // Check for hardcoded URLs that should use Elavon endpoints
        const urlPattern = /https?:\/\/[^\s"']+/g
        const urlMatches = line.match(urlPattern)
        if (urlMatches) {
          for (const url of urlMatches) {
            if (!url.includes('elavon') && !url.includes('localhost')) {
              issues.push({
                line: lineNumber,
                column: line.indexOf(url) + 1,
                severity: 'warning',
                message: 'Consider using Elavon L1 API endpoints',
                rule: 'elavon-endpoints',
                fixable: false
              })
            }
          }
        }
      }

      return {
        filePath,
        issues,
        fixableIssues: issues.filter(i => i.fixable).length,
        totalIssues: issues.length
      }
    } catch (error) {
      throw new Error(`Linting failed for ${filePath}: ${error}`)
    }
  }

  private getCachedResult(filePath: string): ValidationResult | null {
    const cached = this.cache.get(filePath)
    if (cached && Date.now() - cached.validatedAt.getTime() < this.cacheExpiry) {
      return cached
    }
    return null
  }

  private initializeValidationRules(): void {
    this.validationRules = [
      {
        id: 'elavon-endpoint-format',
        name: 'Elavon Endpoint Format',
        description: 'API endpoints should follow Elavon L1 naming conventions',
        category: 'schema',
        severity: 'error',
        pattern: '/api/v[0-9]+/.*'
      },
      {
        id: 'elavon-auth-header',
        name: 'Elavon Authentication Header',
        description: 'Requests should use proper Elavon authentication headers',
        category: 'security',
        severity: 'error',
        pattern: 'Authorization: Bearer.*'
      },
      {
        id: 'elavon-response-format',
        name: 'Elavon Response Format',
        description: 'Responses should follow Elavon L1 schema format',
        category: 'schema',
        severity: 'warning'
      },
      {
        id: 'elavon-error-handling',
        name: 'Elavon Error Handling',
        description: 'Error responses should follow Elavon L1 error format',
        category: 'semantic',
        severity: 'error'
      },
      {
        id: 'elavon-field-naming',
        name: 'Elavon Field Naming',
        description: 'Field names should follow Elavon L1 conventions (camelCase)',
        category: 'style',
        severity: 'warning',
        pattern: '[a-z][a-zA-Z0-9]*'
      }
    ]
  }

  private async validateSchema(content: string, language: string, filePath: string): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      
      const lineNumber = i + 1

      // Check for proper API endpoint format
      if (line.includes('/api/') && !line.match(/\/api\/v[0-9]+\//)) {
        violations.push({
          id: `schema-${Date.now()}-${i}`,
          rule: 'elavon-endpoint-format',
          severity: 'error',
          message: 'API endpoint should include version number (e.g., /api/v1/)',
          lineNumber,
          columnNumber: line.indexOf('/api/') + 1,
          snippet: line.trim(),
          category: 'schema',
          suggestedFix: line.replace('/api/', '/api/v1/')
        })
      }

      // Check for proper response structure
      if (line.includes('response') && line.includes('{') && !line.includes('data')) {
        violations.push({
          id: `schema-${Date.now()}-${i}`,
          rule: 'elavon-response-format',
          severity: 'warning',
          message: 'Response should include "data" wrapper following Elavon L1 format',
          lineNumber,
          columnNumber: 1,
          snippet: line.trim(),
          category: 'schema'
        })
      }
    }

    return violations
  }

  private async validateSemantics(content: string, language: string, filePath: string): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      
      const lineNumber = i + 1

      // Check for proper error handling
      if (line.includes('catch') && !line.includes('error')) {
        violations.push({
          id: `semantic-${Date.now()}-${i}`,
          rule: 'elavon-error-handling',
          severity: 'error',
          message: 'Error handling should follow Elavon L1 error response format',
          lineNumber,
          columnNumber: 1,
          snippet: line.trim(),
          category: 'semantic'
        })
      }

      // Check for deprecated Converge patterns
      if (line.includes('converge') && !line.includes('//') && !line.includes('/*')) {
        violations.push({
          id: `semantic-${Date.now()}-${i}`,
          rule: 'deprecated-converge',
          severity: 'warning',
          message: 'Consider migrating from Converge to Elavon L1 patterns',
          lineNumber,
          columnNumber: line.indexOf('converge') + 1,
          snippet: line.trim(),
          category: 'semantic'
        })
      }
    }

    return violations
  }

  private async validateStyle(content: string, language: string, filePath: string): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      
      const lineNumber = i + 1

      // Check field naming conventions
      const fieldPattern = /"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g
      let match
      while ((match = fieldPattern.exec(line)) !== null) {
        const fieldName = match[1]
        if (fieldName && !fieldName.match(/^[a-z][a-zA-Z0-9]*$/)) {
          violations.push({
            id: `style-${Date.now()}-${i}`,
            rule: 'elavon-field-naming',
            severity: 'warning',
            message: 'Field names should use camelCase following Elavon L1 conventions',
            lineNumber,
            columnNumber: match.index! + 1,
            snippet: line.trim(),
            category: 'style',
            suggestedFix: `"${this.toCamelCase(fieldName)}"`
          })
        }
      }
    }

    return violations
  }

  private async validateSecurity(content: string, language: string, filePath: string): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      
      const lineNumber = i + 1

      // Check for hardcoded credentials
      if (line.match(/(password|secret|key|token)\s*[:=]\s*["'][^"']+["']/i)) {
        violations.push({
          id: `security-${Date.now()}-${i}`,
          rule: 'no-hardcoded-credentials',
          severity: 'error',
          message: 'Avoid hardcoded credentials, use environment variables',
          lineNumber,
          columnNumber: 1,
          snippet: line.replace(/["'][^"']+["']/, '"***"'),
          category: 'security'
        })
      }

      // Check for missing authentication
      if (line.includes('fetch(') || line.includes('axios.')) {
        const nextLines = lines.slice(i, i + 5).join('\n')
        if (!nextLines.includes('Authorization') && !nextLines.includes('Bearer')) {
          violations.push({
            id: `security-${Date.now()}-${i}`,
            rule: 'elavon-auth-header',
            severity: 'error',
            message: 'API requests should include proper Elavon authentication headers',
            lineNumber,
            columnNumber: 1,
            snippet: line.trim(),
            category: 'security'
          })
        }
      }
    }

    return violations
  }

  private async generateFixSuggestion(violation: ValidationViolation): Promise<FixSuggestion | null> {
    if (violation.suggestedFix) {
      return {
        violationId: violation.id,
        description: `Replace with: ${violation.suggestedFix}`,
        autoFixAvailable: true,
        fixCode: violation.suggestedFix,
        confidence: 0.9
      }
    }

    // Generate manual fix suggestions based on rule
    switch (violation.rule) {
      case 'elavon-auth-header':
        return {
          violationId: violation.id,
          description: 'Add Elavon authentication header',
          autoFixAvailable: false,
          manualSteps: [
            'Add Authorization header to your request',
            'Use format: Authorization: Bearer <your-token>',
            'Obtain token from Elavon L1 authentication endpoint'
          ],
          confidence: 0.8
        }

      case 'elavon-error-handling':
        return {
          violationId: violation.id,
          description: 'Implement proper error handling',
          autoFixAvailable: false,
          manualSteps: [
            'Catch and handle errors appropriately',
            'Return errors in Elavon L1 format: { error: { code, message, details } }',
            'Log errors for debugging purposes'
          ],
          confidence: 0.7
        }

      default:
        return null
    }
  }

  private calculateComplianceScore(violations: ValidationViolation[], warnings: ValidationWarning[]): number {
    const errorWeight = 10
    const warningWeight = 5
    const infoWeight = 1

    const errorCount = violations.filter(v => v.severity === 'error').length
    const warningCount = violations.filter(v => v.severity === 'warning').length
    const infoCount = violations.filter(v => v.severity === 'info').length

    const totalPenalty = (errorCount * errorWeight) + (warningCount * warningWeight) + (infoCount * infoWeight)
    const maxScore = 100
    
    return Math.max(0, maxScore - totalPenalty)
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    }
    
    return languageMap[ext] || 'text'
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}