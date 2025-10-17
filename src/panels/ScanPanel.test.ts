import * as vscode from 'vscode';
import { ScanPanel, ScanTreeItem } from './ScanPanel';
import { createMockContext } from '../test/mocks';

// Mock the Logger
jest.mock('../utils/logger', () => ({
  Logger: {
    buttonClicked: jest.fn(),
  },
}));

describe('ScanPanel', () => {
  let mockContext: vscode.ExtensionContext;
  let scanPanel: ScanPanel;
  let registerCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    mockContext = createMockContext();
    registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    scanPanel = new ScanPanel(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create scan panel without registering commands', () => {
      // Commands are now registered by CommandRegistry, not ScanPanel
      expect(registerCommandSpy).not.toHaveBeenCalled();
      expect(scanPanel).toBeDefined();
    });
  });

  describe('getChildren', () => {
    it('should return empty state when no scan results', async () => {
      const children = await scanPanel.getChildren();
      
      expect(children).toHaveLength(1);
      expect(children[0]?.id).toBe('empty-state');
      expect(children[0]?.label).toBe('No scan results. Click the Scan Project button (🔍) to start scanning.');
      expect(children[0]?.type).toBe('summary');
    });

    it('should return children of provided element', async () => {
      const parentItem: ScanTreeItem = {
        id: 'test',
        label: 'Test',
        type: 'endpoint',
        children: [
          { id: 'child1', label: 'Child 1', type: 'file' },
          { id: 'child2', label: 'Child 2', type: 'file' }
        ]
      };

      const children = await scanPanel.getChildren(parentItem);
      
      expect(children).toHaveLength(2);
      expect(children[0]?.label).toBe('Child 1');
      expect(children[1]?.label).toBe('Child 2');
    });

    it('should return empty array for element with no children', async () => {
      const leafItem: ScanTreeItem = {
        id: 'leaf',
        label: 'Leaf',
        type: 'occurrence'
      };

      const children = await scanPanel.getChildren(leafItem);
      
      expect(children).toHaveLength(0);
    });
  });

  describe('getTreeItem', () => {
    it('should create tree item with correct properties for endpoint', () => {
      const element: ScanTreeItem = {
        id: 'endpoint-1',
        label: 'Test Endpoint',
        type: 'endpoint',
        children: [{ id: 'child', label: 'Child', type: 'file' }]
      };

      const treeItem = scanPanel.getTreeItem(element);
      
      expect(treeItem.label).toBe('Test Endpoint');
      expect(treeItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
      expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon('globe'));
    });

    it('should create tree item with correct properties for file', () => {
      const element: ScanTreeItem = {
        id: 'file-1',
        label: 'test.ts',
        type: 'file',
        filePath: '/path/to/test.ts'
      };

      const treeItem = scanPanel.getTreeItem(element);
      
      expect(treeItem.label).toBe('test.ts');
      expect(treeItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
      expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon('file-code'));
      expect(treeItem.contextValue).toBe('scanFile');
    });

    it('should create tree item with correct properties for occurrence', () => {
      const element: ScanTreeItem = {
        id: 'occurrence-1',
        label: 'Line 45: test code',
        type: 'occurrence',
        snippet: 'const result = test();'
      };

      const treeItem = scanPanel.getTreeItem(element);
      
      expect(treeItem.label).toBe('Line 45: test code');
      expect(treeItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
      expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon('question'));
      expect(treeItem.tooltip).toBe('Confidence: 0% | Type: unknown | const result = test();');
    });
  });

  describe('refresh', () => {
    it('should fire onDidChangeTreeData event', () => {
      // Mock the _onDidChangeTreeData fire method
      const fireSpy = jest.spyOn((scanPanel as any)._onDidChangeTreeData, 'fire');
      
      scanPanel.refresh();
      
      expect(fireSpy).toHaveBeenCalled();
    });
  });

  describe('getParent', () => {
    it('should return null for any element', () => {
      const element: ScanTreeItem = {
        id: 'test',
        label: 'Test',
        type: 'file'
      };

      const parent = scanPanel.getParent(element);
      
      expect(parent).toBeNull();
    });
  });
});