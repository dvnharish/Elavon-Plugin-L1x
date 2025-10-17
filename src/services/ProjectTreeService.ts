import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { ScanResult } from './CodeScannerService';
import { ApiMapping, VariableMapping } from './ApiMappingService';

export interface ProjectTreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file' | 'method' | 'class' | 'variable' | 'endpoint';
  filePath?: string | undefined;
  line?: number | undefined;
  children: ProjectTreeNode[];
  scanResults: ScanResult[];
  apiMappings: ApiMapping[];
  migrationSuggestions: string[];
  confidence: number;
  icon?: string;
  contextValue?: string;
}

export interface ProjectScanSummary {
  totalFiles: number;
  filesWithConvergeReferences: number;
  totalConvergeReferences: number;
  endpointsByType: Record<string, number>;
  variablesByType: Record<string, number>;
  languageDistribution: Record<string, number>;
  migrationComplexity: 'low' | 'medium' | 'high';
  estimatedMigrationTime: string;
}

export class ProjectTreeService {
  private workspaceRoot: string;

  constructor() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.workspaceRoot = workspaceFolder?.uri.fsPath || '';
  }

  /**
   * Build a detailed project tree view with Converge references and L1 mappings
   */
  buildProjectTree(scanResults: ScanResult[]): ProjectTreeNode {
    Logger.info('Building detailed project tree from scan results');

    const rootNode: ProjectTreeNode = {
      id: 'project-root',
      label: '📁 Project Structure',
      type: 'folder',
      children: [],
      scanResults: [],
      apiMappings: [],
      migrationSuggestions: [],
      confidence: 0,
      contextValue: 'projectRoot'
    };

    // Group scan results by file path
    const fileGroups = this.groupResultsByFile(scanResults);

    // Build folder structure
    const folderMap = new Map<string, ProjectTreeNode>();
    
    for (const [filePath, results] of fileGroups.entries()) {
      this.addFileToTree(rootNode, filePath, results, folderMap);
    }

    // Calculate confidence and add summary information
    this.calculateTreeConfidence(rootNode);
    this.addSummaryNodes(rootNode, scanResults);

    Logger.info(`Built project tree with ${this.countNodes(rootNode)} nodes`);
    return rootNode;
  }

  /**
   * Generate a comprehensive project scan summary
   */
  generateProjectSummary(scanResults: ScanResult[]): ProjectScanSummary {
    const uniqueFiles = new Set(scanResults.map(r => r.filePath));
    const endpointTypes: Record<string, number> = {};
    const variableTypes: Record<string, number> = {};
    const languages: Record<string, number> = {};

    for (const result of scanResults) {
      // Count endpoint types
      endpointTypes[result.endpointType] = (endpointTypes[result.endpointType] || 0) + 1;

      // Count variable types
      if (result.variableName) {
        const varType = this.categorizeVariable(result.variableName);
        variableTypes[varType] = (variableTypes[varType] || 0) + 1;
      }

      // Count languages
      languages[result.language] = (languages[result.language] || 0) + 1;
    }

    const migrationComplexity = this.assessMigrationComplexity(scanResults);
    const estimatedTime = this.estimateMigrationTime(scanResults, migrationComplexity);

    return {
      totalFiles: uniqueFiles.size,
      filesWithConvergeReferences: uniqueFiles.size,
      totalConvergeReferences: scanResults.length,
      endpointsByType: endpointTypes,
      variablesByType: variableTypes,
      languageDistribution: languages,
      migrationComplexity,
      estimatedMigrationTime: estimatedTime
    };
  }

  /**
   * Find files that need migration based on scan results
   */
  findMigrationCandidates(scanResults: ScanResult[]): Array<{
    filePath: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    estimatedEffort: string;
    results: ScanResult[];
  }> {
    const fileGroups = this.groupResultsByFile(scanResults);
    const candidates: Array<{
      filePath: string;
      priority: 'high' | 'medium' | 'low';
      reason: string;
      estimatedEffort: string;
      results: ScanResult[];
    }> = [];

    for (const [filePath, results] of fileGroups.entries()) {
      const priority = this.calculateFilePriority(results);
      const reason = this.generatePriorityReason(results);
      const effort = this.estimateFileEffort(results);

      candidates.push({
        filePath,
        priority,
        reason,
        estimatedEffort: effort,
        results
      });
    }

    // Sort by priority (high first)
    return candidates.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private groupResultsByFile(scanResults: ScanResult[]): Map<string, ScanResult[]> {
    const fileGroups = new Map<string, ScanResult[]>();
    
    for (const result of scanResults) {
      if (!fileGroups.has(result.filePath)) {
        fileGroups.set(result.filePath, []);
      }
      fileGroups.get(result.filePath)!.push(result);
    }

    return fileGroups;
  }

  private addFileToTree(
    rootNode: ProjectTreeNode,
    filePath: string,
    results: ScanResult[],
    folderMap: Map<string, ProjectTreeNode>
  ): void {
    const pathParts = filePath.split('/');
    let currentNode = rootNode;

    // Create folder structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderPath = pathParts.slice(0, i + 1).join('/');
      const folderName = pathParts[i]!;

      if (!folderMap.has(folderPath)) {
        const folderNode: ProjectTreeNode = {
          id: `folder-${folderPath}`,
          label: `📁 ${folderName}`,
          type: 'folder',
          filePath: folderPath,
          children: [],
          scanResults: [],
          apiMappings: [],
          migrationSuggestions: [],
          confidence: 0,
          contextValue: 'projectFolder'
        };

        folderMap.set(folderPath, folderNode);
        currentNode.children.push(folderNode);
      }

      currentNode = folderMap.get(folderPath)!;
    }

    // Add file node
    const fileName = pathParts[pathParts.length - 1]!;
    const fileNode: ProjectTreeNode = {
      id: `file-${filePath}`,
      label: `📄 ${fileName}`,
      type: 'file',
      filePath,
      children: [],
      scanResults: results,
      apiMappings: results.map(r => r.apiMapping).filter(Boolean) as ApiMapping[],
      migrationSuggestions: this.generateFileMigrationSuggestions(results),
      confidence: this.calculateFileConfidence(results),
      contextValue: 'projectFile'
    };

    // Add method/class/variable nodes
    this.addCodeElementNodes(fileNode, results);

    currentNode.children.push(fileNode);
  }

  private addCodeElementNodes(fileNode: ProjectTreeNode, results: ScanResult[]): void {
    // Group by code element type
    const classes = results.filter(r => r.className);
    const methods = results.filter(r => r.methodName);
    const variables = results.filter(r => r.variableName);
    const endpoints = results.filter(r => r.endpointUrl);

    // Add class nodes
    const classGroups = new Map<string, ScanResult[]>();
    for (const result of classes) {
      const className = result.className!;
      if (!classGroups.has(className)) {
        classGroups.set(className, []);
      }
      classGroups.get(className)!.push(result);
    }

    for (const [className, classResults] of classGroups.entries()) {
      const classNode: ProjectTreeNode = {
        id: `class-${fileNode.filePath}-${className}`,
        label: `🏛️ ${className}`,
        type: 'class',
        filePath: fileNode.filePath || undefined,
        line: classResults[0]?.line || undefined,
        children: [],
        scanResults: classResults,
        apiMappings: classResults.map(r => r.apiMapping).filter(Boolean) as ApiMapping[],
        migrationSuggestions: this.generateElementMigrationSuggestions(classResults),
        confidence: this.calculateElementConfidence(classResults),
        contextValue: 'projectClass'
      };

      fileNode.children.push(classNode);
    }

    // Add method nodes
    const methodGroups = new Map<string, ScanResult[]>();
    for (const result of methods) {
      const methodName = result.methodName!;
      if (!methodGroups.has(methodName)) {
        methodGroups.set(methodName, []);
      }
      methodGroups.get(methodName)!.push(result);
    }

    for (const [methodName, methodResults] of methodGroups.entries()) {
      const methodNode: ProjectTreeNode = {
        id: `method-${fileNode.filePath}-${methodName}`,
        label: `⚙️ ${methodName}()`,
        type: 'method',
        filePath: fileNode.filePath || undefined,
        line: methodResults[0]?.line || undefined,
        children: [],
        scanResults: methodResults,
        apiMappings: methodResults.map(r => r.apiMapping).filter(Boolean) as ApiMapping[],
        migrationSuggestions: this.generateElementMigrationSuggestions(methodResults),
        confidence: this.calculateElementConfidence(methodResults),
        contextValue: 'projectMethod'
      };

      fileNode.children.push(methodNode);
    }

    // Add variable nodes
    for (const result of variables) {
      const variableNode: ProjectTreeNode = {
        id: `variable-${fileNode.filePath}-${result.line}-${result.variableName}`,
        label: `🔧 ${result.variableName}`,
        type: 'variable',
        filePath: fileNode.filePath || undefined,
        line: result.line,
        children: [],
        scanResults: [result],
        apiMappings: result.apiMapping ? [result.apiMapping] : [],
        migrationSuggestions: result.migrationNotes || [],
        confidence: result.confidence,
        contextValue: 'projectVariable'
      };

      fileNode.children.push(variableNode);
    }

    // Add endpoint nodes
    for (const result of endpoints) {
      const endpointNode: ProjectTreeNode = {
        id: `endpoint-${fileNode.filePath}-${result.line}-${result.endpointUrl}`,
        label: `🌐 ${result.endpointUrl}`,
        type: 'endpoint',
        filePath: fileNode.filePath || undefined,
        line: result.line,
        children: [],
        scanResults: [result],
        apiMappings: result.apiMapping ? [result.apiMapping] : [],
        migrationSuggestions: result.migrationNotes || [],
        confidence: result.confidence,
        contextValue: 'projectEndpoint'
      };

      fileNode.children.push(endpointNode);
    }
  }

  private generateFileMigrationSuggestions(results: ScanResult[]): string[] {
    const suggestions: string[] = [];
    const endpointCount = results.filter(r => r.endpointType === 'endpoint').length;
    const variableCount = results.filter(r => r.variableName).length;
    const classCount = results.filter(r => r.className).length;

    if (endpointCount > 0) {
      suggestions.push(`Update ${endpointCount} endpoint reference(s) to L1 API`);
    }
    if (variableCount > 0) {
      suggestions.push(`Migrate ${variableCount} Converge variable(s) to L1 format`);
    }
    if (classCount > 0) {
      suggestions.push(`Refactor ${classCount} service class(es) for L1 integration`);
    }

    return suggestions;
  }

  private generateElementMigrationSuggestions(results: ScanResult[]): string[] {
    const suggestions: string[] = [];
    
    for (const result of results) {
      if (result.apiMapping) {
        suggestions.push(`Map to ${result.apiMapping.elavonEndpoint}`);
      }
      if (result.migrationNotes) {
        suggestions.push(...result.migrationNotes);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  private calculateFileConfidence(results: ScanResult[]): number {
    if (results.length === 0) return 0;
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / results.length;
  }

  private calculateElementConfidence(results: ScanResult[]): number {
    return this.calculateFileConfidence(results);
  }

  private calculateTreeConfidence(node: ProjectTreeNode): void {
    if (node.children.length === 0) {
      return;
    }

    // Recursively calculate confidence for children
    for (const child of node.children) {
      this.calculateTreeConfidence(child);
    }

    // Calculate this node's confidence based on children
    const childConfidences = node.children.map(c => c.confidence).filter(c => c > 0);
    if (childConfidences.length > 0) {
      node.confidence = childConfidences.reduce((sum, c) => sum + c, 0) / childConfidences.length;
    }
  }

  private addSummaryNodes(rootNode: ProjectTreeNode, scanResults: ScanResult[]): void {
    const summary = this.generateProjectSummary(scanResults);
    
    const summaryNode: ProjectTreeNode = {
      id: 'project-summary',
      label: `📊 Migration Summary`,
      type: 'folder',
      children: [
        {
          id: 'summary-files',
          label: `📁 ${summary.totalFiles} files with Converge references`,
          type: 'folder',
          children: [],
          scanResults: [],
          apiMappings: [],
          migrationSuggestions: [],
          confidence: 0,
          contextValue: 'summaryItem'
        },
        {
          id: 'summary-references',
          label: `🔍 ${summary.totalConvergeReferences} total references found`,
          type: 'folder',
          children: [],
          scanResults: [],
          apiMappings: [],
          migrationSuggestions: [],
          confidence: 0,
          contextValue: 'summaryItem'
        },
        {
          id: 'summary-complexity',
          label: `⚡ Migration complexity: ${summary.migrationComplexity.toUpperCase()}`,
          type: 'folder',
          children: [],
          scanResults: [],
          apiMappings: [],
          migrationSuggestions: [],
          confidence: 0,
          contextValue: 'summaryItem'
        },
        {
          id: 'summary-time',
          label: `⏱️ Estimated time: ${summary.estimatedMigrationTime}`,
          type: 'folder',
          children: [],
          scanResults: [],
          apiMappings: [],
          migrationSuggestions: [],
          confidence: 0,
          contextValue: 'summaryItem'
        }
      ],
      scanResults: [],
      apiMappings: [],
      migrationSuggestions: [],
      confidence: 0,
      contextValue: 'projectSummary'
    };

    rootNode.children.unshift(summaryNode);
  }

  private countNodes(node: ProjectTreeNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  private categorizeVariable(variableName: string): string {
    if (variableName.includes('merchant') || variableName.includes('user') || variableName.includes('pin')) {
      return 'credential';
    }
    if (variableName.includes('amount') || variableName.includes('currency')) {
      return 'transaction';
    }
    if (variableName.includes('card') || variableName.includes('exp') || variableName.includes('cvv')) {
      return 'payment';
    }
    return 'other';
  }

  private assessMigrationComplexity(scanResults: ScanResult[]): 'low' | 'medium' | 'high' {
    const uniqueFiles = new Set(scanResults.map(r => r.filePath)).size;
    const totalReferences = scanResults.length;
    const lowConfidenceCount = scanResults.filter(r => r.confidence < 0.7).length;

    if (uniqueFiles > 20 || totalReferences > 100 || lowConfidenceCount > totalReferences * 0.3) {
      return 'high';
    }
    if (uniqueFiles > 10 || totalReferences > 50 || lowConfidenceCount > totalReferences * 0.2) {
      return 'medium';
    }
    return 'low';
  }

  private estimateMigrationTime(scanResults: ScanResult[], complexity: 'low' | 'medium' | 'high'): string {
    const uniqueFiles = new Set(scanResults.map(r => r.filePath)).size;
    
    let baseHours = 0;
    switch (complexity) {
      case 'low':
        baseHours = uniqueFiles * 2;
        break;
      case 'medium':
        baseHours = uniqueFiles * 4;
        break;
      case 'high':
        baseHours = uniqueFiles * 8;
        break;
    }

    if (baseHours < 8) {
      return `${baseHours} hours`;
    }
    if (baseHours < 40) {
      return `${Math.ceil(baseHours / 8)} days`;
    }
    return `${Math.ceil(baseHours / 40)} weeks`;
  }

  private calculateFilePriority(results: ScanResult[]): 'high' | 'medium' | 'low' {
    const hasEndpoints = results.some(r => r.endpointType === 'endpoint' || r.endpointUrl);
    const hasCredentials = results.some(r => r.businessLogicType === 'credential');
    const hasServiceClasses = results.some(r => r.businessLogicType === 'service-class');
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    if ((hasEndpoints || hasCredentials) && avgConfidence > 0.8) {
      return 'high';
    }
    if (hasServiceClasses || avgConfidence > 0.6) {
      return 'medium';
    }
    return 'low';
  }

  private generatePriorityReason(results: ScanResult[]): string {
    const reasons: string[] = [];
    
    if (results.some(r => r.endpointType === 'endpoint')) {
      reasons.push('Contains API endpoints');
    }
    if (results.some(r => r.businessLogicType === 'credential')) {
      reasons.push('Contains authentication credentials');
    }
    if (results.some(r => r.businessLogicType === 'service-class')) {
      reasons.push('Contains service classes');
    }
    if (results.some(r => r.confidence > 0.9)) {
      reasons.push('High confidence matches');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Contains Converge references';
  }

  private estimateFileEffort(results: ScanResult[]): string {
    const referenceCount = results.length;
    const hasComplexLogic = results.some(r => r.businessLogicType === 'service-class' || r.businessLogicType === 'endpoint-definition');
    
    let hours = referenceCount * 0.5; // Base 30 minutes per reference
    
    if (hasComplexLogic) {
      hours += 2; // Additional 2 hours for complex logic
    }

    if (hours < 1) {
      return '< 1 hour';
    }
    if (hours < 8) {
      return `${Math.ceil(hours)} hours`;
    }
    return `${Math.ceil(hours / 8)} days`;
  }
}