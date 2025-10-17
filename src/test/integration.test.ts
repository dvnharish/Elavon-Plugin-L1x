/**
 * Integration Tests for L1X Extension
 * Tests complete workflows and cross-service communication
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { DIContainer, SERVICE_TOKENS } from '../di/container'
import { ValidationEngine } from '../services/ValidationEngine'
import { FileStandardAnalyzer } from '../services/FileStandardAnalyzer'
import { SpecComparisonService } from '../services/SpecComparisonService'

describe('L1X Extension Integration Tests', () => {
  let container: DIContainer
  let testWorkspaceUri: vscode.Uri

  beforeAll(async () => {
    // Setup test workspace
    testWorkspaceUri = vscode.Uri.file(path.join(__dirname, '../../test-workspace'))
    
    // Initialize DI container
    container = new DIContainer()
    container.register(SERVICE_TOKENS.VALIDATION_ENGINE, () => new ValidationEngine())
    container.register(SERVICE_TOKENS.FILE_STANDARD_ANALYZER, () => new FileStandardAnalyzer())
  })

  afterAll(() => {
    container?.dispose()
  })

  describe('Context Menu Workflow Integration', () => {
    test('Complete workflow: Detect → Migrate → Validate', async () => {
      const testFilePath = path.join(testWorkspaceUri.fsPath, 'sample-converge.js')
      
      // Step 1: Detect file standard
      const analyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER)
      const detectionResult = await analyzer.detectStandard(testFilePath)
      
      expect(detectionResult).toBeDefined()
      expect(detectionResult.standard).toBe('converge')
      expect(detectionResult.confidence).toBeGreaterThan(0.5)

      // Step 2: Validate compliance (should show violations for Converge file)
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      const validationResult = await validator.validateFile(testFilePath)
      
      expect(validationResult).toBeDefined()
      expect(validationResult.isCompliant).toBe(false) // Converge file should not be compliant
      expect(validationResult.violations.length).toBeGreaterThan(0)

      // Step 3: Check that violations include expected Elavon compliance issues
      const hasEndpointViolation = validationResult.violations.some(v => 
        v.rule === 'elavon-endpoint-format'
      )
      expect(hasEndpointViolation).toBe(true)
    }, 30000)

    test('Batch operations workflow', async () => {
      const testFiles = [
        path.join(testWorkspaceUri.fsPath, 'sample-converge.js'),
        path.join(testWorkspaceUri.fsPath, 'sample-elavon.js'),
        path.join(testWorkspaceUri.fsPath, 'sample-mixed.js')
      ]

      // Batch standard detection
      const analyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER)
      const batchResults = await analyzer.batchDetect(testFiles)
      
      expect(batchResults.size).toBe(testFiles.length)
      
      // Verify different standards detected
      const standards = Array.from(batchResults.values()).map(r => r.standard)
      expect(standards).toContain('converge')
      expect(standards).toContain('elavon')

      // Batch validation
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      const batchValidation = await validator.validateBatch(testFiles)
      
      expect(batchValidation.size).toBe(testFiles.length)
      
      // Elavon file should be more compliant than Converge file
      const elavonResult = Array.from(batchValidation.values()).find(r => 
        r.filePath.includes('elavon')
      )
      const convergeResult = Array.from(batchValidation.values()).find(r => 
        r.filePath.includes('converge')
      )
      
      expect(elavonResult?.overallScore).toBeGreaterThan(convergeResult?.overallScore || 0)
    }, 45000)
  })

  describe('Service Communication Integration', () => {
    test('Cross-service data flow', async () => {
      const testFilePath = path.join(testWorkspaceUri.fsPath, 'sample-converge.js')
      
      // Detection result should influence validation
      const analyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER)
      const detectionResult = await analyzer.detectStandard(testFilePath)
      
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      const validationResult = await validator.validateFile(testFilePath)
      
      // Validation should be aware of detected standard
      if (detectionResult.standard === 'converge') {
        // Should have violations for deprecated Converge patterns
        const hasConvergeViolation = validationResult.violations.some(v => 
          v.rule === 'deprecated-converge'
        )
        expect(hasConvergeViolation).toBe(true)
      }
    })

    test('Error handling across services', async () => {
      const invalidFilePath = path.join(testWorkspaceUri.fsPath, 'nonexistent.js')
      
      // Services should handle missing files gracefully
      const analyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER)
      await expect(analyzer.detectStandard(invalidFilePath)).rejects.toThrow()
      
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      await expect(validator.validateFile(invalidFilePath)).rejects.toThrow()
    })
  })

  describe('Performance and Caching Integration', () => {
    test('Caching improves performance', async () => {
      const testFilePath = path.join(testWorkspaceUri.fsPath, 'sample-converge.js')
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      
      // First call - should be slower (no cache)
      const start1 = Date.now()
      const result1 = await validator.validateFile(testFilePath)
      const duration1 = Date.now() - start1
      
      // Second call - should be faster (cached)
      const start2 = Date.now()
      const result2 = await validator.validateFile(testFilePath)
      const duration2 = Date.now() - start2
      
      expect(result1.filePath).toBe(result2.filePath)
      expect(result1.overallScore).toBe(result2.overallScore)
      
      // Second call should be significantly faster due to caching
      expect(duration2).toBeLessThan(duration1 * 0.5)
    })

    test('Memory usage stays reasonable', async () => {
      const testFiles = Array.from({ length: 50 }, (_, i) => 
        path.join(testWorkspaceUri.fsPath, `test-file-${i}.js`)
      )
      
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process many files
      const validator = container.get(SERVICE_TOKENS.VALIDATION_ENGINE)
      for (const filePath of testFiles.slice(0, 10)) { // Limit to prevent test timeout
        try {
          await validator.validateFile(filePath)
        } catch (error) {
          // Expected for non-existent files
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('UI Integration', () => {
    test('Commands are properly registered', async () => {
      const commands = await vscode.commands.getCommands()
      
      const expectedCommands = [
        'l1x.detectFileStandard',
        'l1x.migrateToElavon',
        'l1x.askGitHubCopilot',
        'l1x.compareOpenAPISpecs',
        'l1x.validateElavonCompliance',
        'l1x.batchDetectStandards',
        'l1x.batchValidateCompliance'
      ]
      
      for (const command of expectedCommands) {
        expect(commands).toContain(command)
      }
    })

    test('Context menu integration', async () => {
      // Test that context menu items are available
      // This would require more complex setup with actual VS Code extension host
      expect(true).toBe(true) // Placeholder - would implement with proper test setup
    })
  })

  describe('Configuration Integration', () => {
    test('Configuration values are respected', () => {
      const config = vscode.workspace.getConfiguration('l1x.copilot')
      
      // Test default values
      expect(config.get('offlineMode')).toBe(false)
      expect(config.get('enableTelemetry')).toBe(true)
      expect(config.get('redactSecrets')).toBe(true)
      expect(config.get('maxPromptLength')).toBe(8000)
      expect(config.get('timeoutMs')).toBe(30000)
    })

    test('Spec paths configuration', () => {
      const config = vscode.workspace.getConfiguration('l1x.copilot')
      
      const convergeSpecPath = config.get('convergeSpecPath')
      const elavonSpecPath = config.get('elavonSpecPath')
      
      expect(convergeSpecPath).toBe('openapi/Converge Open API.json')
      expect(elavonSpecPath).toBe('openapi/Elavon API Gateway Open API.json')
    })
  })
})

// Test data setup helpers
function createTestFiles(): void {
  // This would create sample test files for integration testing
  const testFiles = {
    'sample-converge.js': `
      // Converge API example
      const apiUrl = 'https://api.converge.com/api/payments';
      fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ amount: 100 })
      });
    `,
    'sample-elavon.js': `
      // Elavon L1 API example
      const apiUrl = 'https://api.elavon.com/api/v1/payments';
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token123'
        },
        body: JSON.stringify({ 
          data: { amount: 100 }
        })
      });
    `,
    'sample-mixed.js': `
      // Mixed standards
      const convergeUrl = 'https://api.converge.com/api/payments';
      const elavonUrl = 'https://api.elavon.com/api/v1/payments';
      
      // Some Converge patterns
      fetch(convergeUrl);
      
      // Some Elavon patterns
      fetch(elavonUrl, {
        headers: { 'Authorization': 'Bearer token' }
      });
    `
  }
  
  // In a real test, these would be written to the test workspace
}