import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * File system utilities for the L1X extension
 */
export class FileSystemUtils {
  /**
   * Get the workspace root path
   */
  static getWorkspaceRoot(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content as string
   */
  static async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString('utf8');
  }

  /**
   * Write content to file
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const buffer = Buffer.from(content, 'utf8');
    await vscode.workspace.fs.writeFile(uri, buffer);
  }

  /**
   * Create directory if it doesn't exist
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    const uri = vscode.Uri.file(dirPath);
    try {
      await vscode.workspace.fs.createDirectory(uri);
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Get file modification time
   */
  static async getModificationTime(filePath: string): Promise<number> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return stat.mtime;
    } catch {
      return 0;
    }
  }

  /**
   * Get relative path from workspace root
   */
  static getRelativePath(filePath: string): string {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return filePath;
    }
    return path.relative(workspaceRoot, filePath);
  }

  /**
   * Get absolute path from workspace-relative path
   */
  static getAbsolutePath(relativePath: string): string {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return relativePath;
    }
    return path.join(workspaceRoot, relativePath);
  }

  /**
   * Check if path matches any of the given patterns
   */
  static matchesPatterns(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if path matches a glob pattern
   */
  static matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename chars
      .replace(/\?/g, '.')     // ? matches single char
      .replace(/\./g, '\\.');  // Escape dots
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath);
  }

  /**
   * Get file extension
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Get file name without extension
   */
  static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Get directory name
   */
  static getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Join paths
   */
  static joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Normalize path separators
   */
  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }
}