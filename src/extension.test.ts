import * as vscode from 'vscode';
import { activate, deactivate } from './extension';
import { createMockContext } from './test/mocks';

// Mock the panel classes
jest.mock('./panels/ScanPanel');
jest.mock('./panels/CredentialsPanel.simple');
jest.mock('./panels/DocsPanel');
jest.mock('./panels/MigrationPanel');

describe('Extension', () => {
  let mockContext: vscode.ExtensionContext;
  let registerTreeDataProviderSpy: jest.SpyInstance;
  let registerWebviewViewProviderSpy: jest.SpyInstance;

  beforeEach(() => {
    mockContext = createMockContext();
    registerTreeDataProviderSpy = jest.spyOn(vscode.window, 'registerTreeDataProvider');
    registerWebviewViewProviderSpy = jest.spyOn(vscode.window, 'registerWebviewViewProvider');
    jest.clearAllMocks();
  });

  describe('activate', () => {
    it('should activate successfully and register all providers', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      activate(mockContext);
      
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] l1x_activate');
      
      // Verify all tree data provider registrations
      expect(registerTreeDataProviderSpy).toHaveBeenCalledWith('l1x.scanPanel', expect.any(Object));
      expect(registerTreeDataProviderSpy).toHaveBeenCalledWith('l1x.credentialsPanel', expect.any(Object));
      expect(registerTreeDataProviderSpy).toHaveBeenCalledWith('l1x.docsPanel', expect.any(Object));
      expect(registerTreeDataProviderSpy).toHaveBeenCalledWith('l1x.migrationPanel', expect.any(Object));
    });
  });

  describe('deactivate', () => {
    it('should deactivate successfully', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      // First activate to have something to deactivate
      activate(mockContext);
      
      deactivate();
      
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] Extension deactivated');
    });
  });
});