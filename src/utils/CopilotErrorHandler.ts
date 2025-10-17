import * as vscode from 'vscode';
import { Logger } from './logger';
import { MigrationContext } from '../types/copilot';

export class CopilotNotAvailableError extends Error {
  constructor(message: string = 'GitHub Copilot is not available') {
    super(message);
    this.name = 'CopilotNotAvailableError';
  }
}

export class FileAccessError extends Error {
  constructor(filePath: string, originalError?: Error) {
    super(`Unable to access file: ${filePath}${originalError ? ` - ${originalError.message}` : ''}`);
    this.name = 'FileAccessError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeout: number) {
    super(`GitHub Copilot API request timed out after ${timeout}ms`);
    this.name = 'ApiTimeoutError';
  }
}

export class ContextBuildingError extends Error {
  constructor(filePath: string, originalError?: Error) {
    super(`Failed to build context for file: ${filePath}${originalError ? ` - ${originalError.message}` : ''}`);
    this.name = 'ContextBuildingError';
  }
}

export class CopilotErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second

  static async handleError(error: Error, context?: Partial<MigrationContext>): Promise<void> {
    Logger.error('Copilot integration error', error);
    
    const errorKey = context?.fileContext?.filePath || 'unknown';
    const currentAttempts = this.retryAttempts.get(errorKey) || 0;

    switch (error.name) {
      case 'CopilotNotAvailableError':
        await this.showCopilotInstallationGuidance();
        break;
      
      case 'FileAccessError':
        await this.showFileAccessError(context?.fileContext?.filePath || 'unknown file');
        break;
      
      case 'ApiTimeoutError':
        if (currentAttempts < this.MAX_RETRY_ATTEMPTS) {
          await this.showRetryOption(errorKey, currentAttempts);
        } else {
          await this.showMaxRetriesReached();
        }
        break;
      
      case 'ContextBuildingError':
        await this.showContextBuildingError(context?.fileContext?.filePath || 'unknown file');
        break;
      
      default:
        await this.showGenericError(error.message);
    }
  }

  private static async showCopilotInstallationGuidance(): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      '🤖 GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension to use migration assistance.',
      'Install Copilot',
      'Learn More',
      'Dismiss'
    );

    switch (choice) {
      case 'Install Copilot':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat')
        );
        break;
      
      case 'Learn More':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://docs.github.com/en/copilot/getting-started-with-github-copilot')
        );
        break;
    }
  }

  private static async showFileAccessError(filePath: string): Promise<void> {
    const fileName = filePath.split('/').pop() || filePath;
    
    const choice = await vscode.window.showErrorMessage(
      `📁 Unable to access file "${fileName}". Please ensure the file exists and is readable.`,
      'Open File',
      'Refresh',
      'Dismiss'
    );

    switch (choice) {
      case 'Open File':
        try {
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        } catch (error) {
          Logger.warn('Failed to open file from error handler', error as Error);
        }
        break;
      
      case 'Refresh':
        await vscode.commands.executeCommand('l1x.refresh');
        break;
    }
  }

  private static async showRetryOption(errorKey: string, currentAttempts: number): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      `⏱️ GitHub Copilot request timed out. This might be due to network issues or high API load.`,
      'Retry',
      'Cancel'
    );

    if (choice === 'Retry') {
      // Increment retry count
      this.retryAttempts.set(errorKey, currentAttempts + 1);
      
      // Exponential backoff delay
      const delay = this.RETRY_DELAY_BASE * Math.pow(2, currentAttempts);
      
      vscode.window.showInformationMessage(
        `Retrying in ${delay / 1000} seconds... (Attempt ${currentAttempts + 1}/${this.MAX_RETRY_ATTEMPTS})`
      );
      
      setTimeout(() => {
        vscode.commands.executeCommand('l1x.askGitHubCopilot');
      }, delay);
    } else {
      // Reset retry count on cancel
      this.retryAttempts.delete(errorKey);
    }
  }

  private static async showMaxRetriesReached(): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      '❌ Maximum retry attempts reached. GitHub Copilot may be experiencing issues.',
      'Check Status',
      'Try Later',
      'Dismiss'
    );

    switch (choice) {
      case 'Check Status':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://www.githubstatus.com/')
        );
        break;
      
      case 'Try Later':
        vscode.window.showInformationMessage(
          'You can try the migration request again later when GitHub Copilot is more responsive.'
        );
        break;
    }
  }

  private static async showContextBuildingError(filePath: string): Promise<void> {
    const fileName = filePath.split('/').pop() || filePath;
    
    const choice = await vscode.window.showWarningMessage(
      `⚠️ Could not fully analyze "${fileName}". Migration assistance will proceed with limited context.`,
      'Continue Anyway',
      'Cancel'
    );

    if (choice === 'Continue Anyway') {
      vscode.window.showInformationMessage(
        'Proceeding with basic file information. The migration suggestions may be less accurate.'
      );
    }
  }

  private static async showGenericError(errorMessage: string): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      `❌ GitHub Copilot integration failed: ${errorMessage}`,
      'Report Issue',
      'Retry',
      'Dismiss'
    );

    switch (choice) {
      case 'Report Issue':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/elavon/l1x-elavonx-migrator/issues/new')
        );
        break;
      
      case 'Retry':
        await vscode.commands.executeCommand('l1x.askGitHubCopilot');
        break;
    }
  }

  /**
   * Clear retry attempts for a specific file or all files
   */
  static clearRetryAttempts(filePath?: string): void {
    if (filePath) {
      this.retryAttempts.delete(filePath);
    } else {
      this.retryAttempts.clear();
    }
  }

  /**
   * Get retry statistics for telemetry
   */
  static getRetryStats(): { totalRetries: number; filesWithRetries: number } {
    const totalRetries = Array.from(this.retryAttempts.values()).reduce((sum, count) => sum + count, 0);
    const filesWithRetries = this.retryAttempts.size;
    
    return { totalRetries, filesWithRetries };
  }

  /**
   * Check if a file has exceeded retry limits
   */
  static hasExceededRetryLimit(filePath: string): boolean {
    const attempts = this.retryAttempts.get(filePath) || 0;
    return attempts >= this.MAX_RETRY_ATTEMPTS;
  }

  /**
   * Create appropriate error based on the original error
   */
  static createTypedError(originalError: Error, context?: { filePath?: string; operation?: string }): Error {
    const message = originalError.message.toLowerCase();
    
    if (message.includes('copilot') && (message.includes('not found') || message.includes('not available'))) {
      return new CopilotNotAvailableError(originalError.message);
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new ApiTimeoutError(30000); // Default timeout
    }
    
    if (context?.filePath && (message.includes('file') || message.includes('access') || message.includes('read'))) {
      return new FileAccessError(context.filePath, originalError);
    }
    
    if (context?.operation === 'context_building') {
      return new ContextBuildingError(context.filePath || 'unknown', originalError);
    }
    
    return originalError; // Return original if no specific type matches
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: { filePath?: string; operation?: string }
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const typedError = this.createTypedError(error as Error, context);
      await this.handleError(typedError);
      return null;
    }
  }
}