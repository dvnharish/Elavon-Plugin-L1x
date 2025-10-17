import * as vscode from 'vscode';
import { CodeScannerService, ScanOptions } from './CodeScannerService';

// Mock vscode module
jest.mock('vscode', () => {
  const mockWorkspace = {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace'
        }
      }
    ],
    findFiles: jest.fn(),
    openTextDocument: jest.fn(),
    asRelativePath: jest.fn((uri: any) => {
      const path = typeof uri === 'string' ? uri : uri.fsPath || uri.path || '';
      return path.replace('/test/workspace/', '');
    })
  };

  const mockUri = {
    file: jest.fn((path: string) => ({ fsPath: path }))
  };

  return {
    workspace: mockWorkspace,
    Uri: mockUri,
    CancellationTokenSource: jest.fn().mockImplementation(() => ({
      token: { isCancellationRequested: false },
      cancel: jest.fn(),
      dispose: jest.fn()
    }))
  };
});

describe('CodeScannerService', () => {
  let scannerService: CodeScannerService;
  let mockDocument: any;
  let mockWorkspace: any;

  beforeEach(() => {
    scannerService = new CodeScannerService();
    
    mockDocument = {
      getText: jest.fn()
    };
    
    // Get the mocked workspace
    const vscode = require('vscode');
    mockWorkspace = vscode.workspace;
    
    // Reset mocks
    jest.clearAllMocks();
    mockWorkspace.findFiles.mockResolvedValue([]);
    mockWorkspace.openTextDocument.mockResolvedValue(mockDocument);
  });

  describe('scanProject', () => {
    it('should scan project with default options', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      // Mock file discovery
      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/test.js' }
      ]);

      // Mock file content with Converge API call
      mockDocument.getText.mockReturnValue(`
        import converge from 'converge-api';
        
        function processPayment() {
          return converge.payment.create({
            amount: 100,
            currency: 'USD'
          });
        }
      `);

      const results = await scannerService.scanProject(options);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(mockWorkspace.findFiles).toHaveBeenCalled();
    });

    it('should handle empty workspace', async () => {
      // Temporarily set workspaceFolders to undefined
      const originalWorkspaceFolders = mockWorkspace.workspaceFolders;
      mockWorkspace.workspaceFolders = undefined;

      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      await expect(scannerService.scanProject(options)).rejects.toThrow('No workspace folder found');
      
      // Restore original workspaceFolders
      mockWorkspace.workspaceFolders = originalWorkspaceFolders;
    });

    it('should detect JavaScript Converge patterns', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/payment.js' }
      ]);

      mockDocument.getText.mockReturnValue(`
        const converge = require('converge-api');
        
        async function processTransaction() {
          const result = await converge.transaction.create({
            amount: 50.00,
            merchantId: 'test123'
          });
          return result;
        }
      `);

      const results = await scannerService.scanProject(options);

      expect(results.length).toBeGreaterThan(0);
      
      const transactionResult = results.find(r => r.endpointType === 'transaction');
      expect(transactionResult).toBeDefined();
      expect(transactionResult?.language).toBe('javascript');
      expect(transactionResult?.confidence).toBeGreaterThan(0);
    });

    it('should detect Java Converge patterns', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['java'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/PaymentService.java' }
      ]);

      mockDocument.getText.mockReturnValue(`
        import com.converge.api.ConvergeClient;
        
        public class PaymentService {
          private ConvergeClient client;
          
          public void processPayment() {
            client.processTransaction(request);
          }
        }
      `);

      const results = await scannerService.scanProject(options);

      expect(results.length).toBeGreaterThan(0);
      
      const javaResult = results.find(r => r.language === 'java');
      expect(javaResult).toBeDefined();
      expect(javaResult?.filePath).toContain('PaymentService.java');
    });

    it('should handle business-logic mode', async () => {
      const options: ScanOptions = {
        mode: 'business-logic',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/api.js' }
      ]);

      mockDocument.getText.mockReturnValue(`
        import { ConvergeAPI } from 'converge-sdk';
        
        const api = new ConvergeAPI();
        api.payment.process({ amount: 100 });
      `);

      const results = await scannerService.scanProject(options);

      expect(results.length).toBeGreaterThan(0);
      // Business logic mode should have slightly higher confidence
      const result = results[0];
      expect(result?.confidence).toBeGreaterThan(0.5);
    });

    it('should respect exclude patterns', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: ['**/test/**'],
        includePatterns: []
      };

      await scannerService.scanProject(options);

      expect(mockWorkspace.findFiles).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('**/test/**'),
        expect.any(Number)
      );
    });
  });

  describe('cancelScan', () => {
    it('should cancel ongoing scan', () => {
      const mockCancellationToken = {
        token: { isCancellationRequested: false },
        cancel: jest.fn(),
        dispose: jest.fn()
      };

      // Mock the cancellation token
      (vscode.CancellationTokenSource as jest.Mock).mockImplementation(() => mockCancellationToken);

      // Start a scan (don't await)
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      scannerService.scanProject(options);
      scannerService.cancelScan();

      expect(mockCancellationToken.cancel).toHaveBeenCalled();
    });
  });

  describe('getScanProgress', () => {
    it('should return initial progress state', () => {
      const progress = scannerService.getScanProgress();

      expect(progress).toEqual({
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        percentage: 0,
        estimatedTimeRemaining: 0,
        isComplete: false,
        isCancelled: false
      });
    });
  });

  describe('ignore list management', () => {
    it('should add patterns to ignore list', () => {
      const pattern = '**/custom-exclude/**';
      
      scannerService.addToIgnoreList(pattern);
      const ignoreList = scannerService.getIgnoreList();

      expect(ignoreList).toContain(pattern);
    });

    it('should not add duplicate patterns', () => {
      const pattern = '**/duplicate/**';
      
      scannerService.addToIgnoreList(pattern);
      scannerService.addToIgnoreList(pattern);
      
      const ignoreList = scannerService.getIgnoreList();
      const occurrences = ignoreList.filter(p => p === pattern).length;
      
      expect(occurrences).toBe(1);
    });

    it('should have default ignore patterns', () => {
      const ignoreList = scannerService.getIgnoreList();

      expect(ignoreList).toContain('**/node_modules/**');
      expect(ignoreList).toContain('**/dist/**');
      expect(ignoreList).toContain('**/build/**');
      expect(ignoreList).toContain('**/.git/**');
    });
  });

  describe('endpoint type classification', () => {
    it('should classify transaction endpoints', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/transaction.js' }
      ]);

      mockDocument.getText.mockReturnValue('converge.transaction.create()');

      const results = await scannerService.scanProject(options);
      const result = results.find(r => r.endpointType === 'transaction');

      expect(result).toBeDefined();
      expect(result?.endpointType).toBe('transaction');
    });

    it('should classify payment endpoints', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/payment.js' }
      ]);

      mockDocument.getText.mockReturnValue('converge.payment.process()');

      const results = await scannerService.scanProject(options);
      const result = results.find(r => r.endpointType === 'payment');

      expect(result).toBeDefined();
      expect(result?.endpointType).toBe('payment');
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to method calls', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/api.js' }
      ]);

      mockDocument.getText.mockReturnValue('converge.payment.process({ amount: 100 })');

      const results = await scannerService.scanProject(options);
      const result = results[0];

      expect(result?.confidence).toBeGreaterThan(0.7); // Should be high confidence for method call
    });

    it('should assign higher confidence to import statements', async () => {
      const options: ScanOptions = {
        mode: 'quick',
        languages: ['javascript'],
        excludePatterns: [],
        includePatterns: []
      };

      mockWorkspace.findFiles.mockResolvedValue([
        { fsPath: '/test/workspace/src/imports.js' }
      ]);

      mockDocument.getText.mockReturnValue('import converge from "converge-api"');

      const results = await scannerService.scanProject(options);
      const result = results[0];

      expect(result?.confidence).toBeGreaterThan(0.6); // Should be good confidence for import
    });
  });
});