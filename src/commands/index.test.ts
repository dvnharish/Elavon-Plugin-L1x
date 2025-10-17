import * as vscode from 'vscode';
import { CommandRegistry } from './index';
import { createMockContext } from '../test/mocks';

// Mock the Logger
jest.mock('../utils/logger', () => ({
  Logger: {
    buttonClicked: jest.fn(),
  },
}));

describe('CommandRegistry', () => {
  let mockContext: vscode.ExtensionContext;
  let commandRegistry: CommandRegistry;
  let registerCommandSpy: jest.SpyInstance;
  let showInformationMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    mockContext = createMockContext();
    registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    showInformationMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage');
    
    commandRegistry = new CommandRegistry(mockContext);
  });

  afterEach(() => {
    commandRegistry.dispose();
    jest.clearAllMocks();
  });

  describe('registerAllCommands', () => {
    it('should register all commands', () => {
      commandRegistry.registerAllCommands();
      
      // Verify that commands are registered
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.scanProject', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.reScan', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.refresh', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.viewSummary', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.addCredential', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.testConnection', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.exportCredentials', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.importCredentials', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.addSpec', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.compareSpecs', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.generateMapping', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.generatePreview', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.apply', expect.any(Function));
      expect(registerCommandSpy).toHaveBeenCalledWith('l1x.rollback', expect.any(Function));
      
      // Should register 17 commands total (added testCredentialSet, openCredentialsEditor, and editCredentialField)
      expect(registerCommandSpy).toHaveBeenCalledTimes(17);
    });
  });

  describe('command execution', () => {
    beforeEach(() => {
      commandRegistry.registerAllCommands();
    });

    it('should show information message when scan project command is executed', () => {
      // Get the registered callback for scanProject
      const scanProjectCallback = registerCommandSpy.mock.calls.find(
        call => call[0] === 'l1x.scanProject'
      )?.[1];
      
      expect(scanProjectCallback).toBeDefined();
      
      // Execute the callback
      scanProjectCallback();
      
      expect(showInformationMessageSpy).toHaveBeenCalledWith(
        'Scan Project clicked - Mock data displayed'
      );
    });

    it('should show information message when add credential command is executed', () => {
      const addCredentialCallback = registerCommandSpy.mock.calls.find(
        call => call[0] === 'l1x.addCredential'
      )?.[1];
      
      expect(addCredentialCallback).toBeDefined();
      
      addCredentialCallback();
      
      expect(showInformationMessageSpy).toHaveBeenCalledWith(
        'Add Credential clicked - functionality coming in Phase 3'
      );
    });
  });

  describe('dispose', () => {
    it('should dispose all registered commands', () => {
      const mockDisposable = { dispose: jest.fn() };
      registerCommandSpy.mockReturnValue(mockDisposable);
      
      commandRegistry.registerAllCommands();
      commandRegistry.dispose();
      
      // Should dispose all 17 commands
      expect(mockDisposable.dispose).toHaveBeenCalledTimes(17);
    });
  });
});