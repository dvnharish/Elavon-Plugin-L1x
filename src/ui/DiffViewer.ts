import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface DiffViewOptions {
  title?: string;
  originalLabel?: string;
  modifiedLabel?: string;
  language?: string;
}

export class DiffViewer {
  /**
   * Show a diff comparison between original and suggested code
   */
  static async showDiff(
    originalContent: string,
    suggestedContent: string,
    filePath: string,
    options: DiffViewOptions = {}
  ): Promise<void> {
    Logger.info(`Opening diff viewer for: ${filePath}`);

    try {
      const fileName = filePath.split('/').pop() || 'file';
      const language = options.language || this.detectLanguageFromPath(filePath);

      // Create temporary documents for the diff
      const originalUri = vscode.Uri.parse(`untitled:Original-${fileName}`);
      const suggestedUri = vscode.Uri.parse(`untitled:Suggested-${fileName}`);

      // Create the documents
      const originalDoc = await vscode.workspace.openTextDocument({
        content: originalContent,
        language: language
      });

      const suggestedDoc = await vscode.workspace.openTextDocument({
        content: suggestedContent,
        language: language
      });

      // Open the diff editor
      const title = options.title || `Migration Suggestions: ${fileName}`;
      
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalDoc.uri,
        suggestedDoc.uri,
        title,
        {
          preview: false,
          preserveFocus: false
        }
      );

      Logger.info('Diff viewer opened successfully');
    } catch (error) {
      Logger.error('Failed to open diff viewer', error as Error);
      
      // Fallback: show content in separate editors
      await this.showFallbackComparison(originalContent, suggestedContent, filePath, options);
    }
  }

  /**
   * Show side-by-side comparison in separate editor tabs (fallback)
   */
  private static async showFallbackComparison(
    originalContent: string,
    suggestedContent: string,
    filePath: string,
    options: DiffViewOptions
  ): Promise<void> {
    try {
      Logger.info('Using fallback comparison method');
      
      const fileName = filePath.split('/').pop() || 'file';
      const language = options.language || this.detectLanguageFromPath(filePath);

      // Create original document
      const originalDoc = await vscode.workspace.openTextDocument({
        content: originalContent,
        language: language
      });

      // Create suggested document with header
      const suggestedContentWithHeader = `// GitHub Copilot Migration Suggestions for: ${fileName}
// Original file: ${filePath}
// Generated: ${new Date().toLocaleString()}

${suggestedContent}`;

      const suggestedDoc = await vscode.workspace.openTextDocument({
        content: suggestedContentWithHeader,
        language: language
      });

      // Open both documents
      await vscode.window.showTextDocument(originalDoc, vscode.ViewColumn.One);
      await vscode.window.showTextDocument(suggestedDoc, vscode.ViewColumn.Two);

      // Show information message
      vscode.window.showInformationMessage(
        'Migration suggestions opened in side-by-side view. Compare the original (left) with suggestions (right).',
        'Got it'
      );

    } catch (error) {
      Logger.error('Fallback comparison also failed', error as Error);
      throw error;
    }
  }

  /**
   * Extract code suggestions from Copilot response text
   */
  static extractCodeSuggestions(responseText: string, language: string): string[] {
    const suggestions: string[] = [];

    try {
      // Look for code blocks in the response
      const codeBlockRegex = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'gi');
      let match;

      while ((match = codeBlockRegex.exec(responseText)) !== null) {
        const codeContent = match[1]?.trim();
        if (codeContent && codeContent.length > 0) {
          suggestions.push(codeContent);
        }
      }

      // Also look for generic code blocks if language-specific ones aren't found
      if (suggestions.length === 0) {
        const genericCodeBlockRegex = /```[\w]*\s*\n([\s\S]*?)\n```/gi;
        let genericMatch;

        while ((genericMatch = genericCodeBlockRegex.exec(responseText)) !== null) {
          const codeContent = genericMatch[1]?.trim();
          if (codeContent && codeContent.length > 0 && this.looksLikeCode(codeContent)) {
            suggestions.push(codeContent);
          }
        }
      }

      Logger.info(`Extracted ${suggestions.length} code suggestions from response`);
      return suggestions;
    } catch (error) {
      Logger.error('Error extracting code suggestions', error as Error);
      return [];
    }
  }

  /**
   * Check if text looks like code (heuristic)
   */
  private static looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /\{\s*$/m,
      /;\s*$/m
    ];

    return codeIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Detect programming language from file path
   */
  private static detectLanguageFromPath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'java': 'java',
      'cs': 'csharp',
      'py': 'python',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'cpp': 'cpp',
      'c': 'c',
      'vb': 'vb'
    };

    return languageMap[extension || ''] || 'text';
  }

  /**
   * Show migration explanation alongside diff
   */
  static async showMigrationExplanation(
    explanation: string,
    filePath: string
  ): Promise<void> {
    try {
      const fileName = filePath.split('/').pop() || 'file';
      
      const explanationContent = `# Migration Explanation: ${fileName}

**File**: ${filePath}
**Generated**: ${new Date().toLocaleString()}

---

${explanation}

---

*This explanation was generated by GitHub Copilot to help with your Converge to Elavon L1 migration.*`;

      const doc = await vscode.workspace.openTextDocument({
        content: explanationContent,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Three);
      
      Logger.info('Migration explanation displayed');
    } catch (error) {
      Logger.error('Failed to show migration explanation', error as Error);
      
      // Fallback: show as information message
      vscode.window.showInformationMessage(
        'Migration Explanation',
        { modal: false },
        'View Details'
      ).then(choice => {
        if (choice === 'View Details') {
          vscode.env.openExternal(vscode.Uri.parse(`data:text/plain,${encodeURIComponent(explanation)}`));
        }
      });
    }
  }

  /**
   * Offer to apply suggestions to the original file
   */
  static async offerToApplySuggestions(
    originalFilePath: string,
    suggestedContent: string
  ): Promise<boolean> {
    const fileName = originalFilePath.split('/').pop() || 'file';
    
    const choice = await vscode.window.showInformationMessage(
      `Apply GitHub Copilot's migration suggestions to ${fileName}?`,
      { modal: true },
      'Apply Changes',
      'Keep Original',
      'Save as New File'
    );

    if (choice === 'Apply Changes') {
      return await this.applyChangesToFile(originalFilePath, suggestedContent);
    } else if (choice === 'Save as New File') {
      return await this.saveAsNewFile(originalFilePath, suggestedContent);
    }

    return false;
  }

  private static async applyChangesToFile(filePath: string, newContent: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      const edit = new vscode.WorkspaceEdit();
      
      // Read current content to replace entirely
      const document = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      
      edit.replace(uri, fullRange, newContent);
      
      const success = await vscode.workspace.applyEdit(edit);
      
      if (success) {
        vscode.window.showInformationMessage(`✅ Applied migration suggestions to ${filePath}`);
        Logger.info(`Applied suggestions to file: ${filePath}`);
      } else {
        vscode.window.showErrorMessage(`❌ Failed to apply changes to ${filePath}`);
      }
      
      return success;
    } catch (error) {
      Logger.error('Failed to apply changes to file', error as Error);
      vscode.window.showErrorMessage(`Error applying changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private static async saveAsNewFile(originalPath: string, newContent: string): Promise<boolean> {
    try {
      const originalName = originalPath.split('/').pop() || 'file';
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
      const extension = originalName.includes('.') ? originalName.split('.').pop() : '';
      const newFileName = `${nameWithoutExt}_migrated${extension ? '.' + extension : ''}`;

      const newUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(newFileName),
        filters: {
          'All Files': ['*']
        }
      });

      if (newUri) {
        await vscode.workspace.fs.writeFile(newUri, Buffer.from(newContent, 'utf8'));
        vscode.window.showInformationMessage(`✅ Saved migration suggestions to ${newUri.fsPath}`);
        
        // Open the new file
        const doc = await vscode.workspace.openTextDocument(newUri);
        await vscode.window.showTextDocument(doc);
        
        Logger.info(`Saved suggestions to new file: ${newUri.fsPath}`);
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Failed to save as new file', error as Error);
      vscode.window.showErrorMessage(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}