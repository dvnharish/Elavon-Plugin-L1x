// Global test setup
import * as vscode from 'vscode';

// Mock VS Code API for testing
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createTreeView: jest.fn(),
    createWebviewPanel: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
    executeCommand: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: [],
  },
  ExtensionContext: jest.fn(),
  TreeDataProvider: jest.fn(),
  WebviewViewProvider: jest.fn(),
  EventEmitter: jest.fn(() => ({
    event: jest.fn(),
    fire: jest.fn(),
  })),
  TreeItem: jest.fn().mockImplementation((label) => ({
    label,
    collapsibleState: undefined,
    iconPath: undefined,
    contextValue: undefined,
    resourceUri: undefined,
    tooltip: undefined,
  })),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: jest.fn().mockImplementation((id) => ({ id })),
  ExtensionMode: {
    Development: 1,
    Production: 2,
    Test: 3,
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    parse: jest.fn(),
    joinPath: jest.fn(),
  },
}), { virtual: true });

// Global test timeout
jest.setTimeout(10000);