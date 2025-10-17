import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ConsentPayload } from '../types/copilot';

export class ConsentDialog {
  private static sessionConsent = new Map<string, boolean>();

  static async showConsentDialog(payload: ConsentPayload): Promise<boolean> {
    Logger.info(`Showing consent dialog for file: ${payload.filePath}`);

    try {
      // Check if user has already consented in this session
      const sessionKey = this.getSessionKey(payload.filePath);
      if (this.sessionConsent.has(sessionKey)) {
        const previousConsent = this.sessionConsent.get(sessionKey)!;
        Logger.info(`Using session consent: ${previousConsent}`);
        return previousConsent;
      }

      const options = ['Share with GitHub Copilot', 'Review Details', 'Cancel'];
      
      const message = this.buildConsentMessage(payload);

      const choice = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        ...options
      );

      let userConsent = false;

      if (choice === options[0]) { // Share with GitHub Copilot
        userConsent = true;
        Logger.info('User approved data sharing with GitHub Copilot');
      } else if (choice === options[1]) { // Review Details
        const detailsReview = await this.showDetailedReview(payload);
        userConsent = detailsReview;
      } else { // Cancel or closed dialog
        userConsent = false;
        Logger.info('User declined data sharing with GitHub Copilot');
      }

      // Remember consent for this session
      this.sessionConsent.set(sessionKey, userConsent);

      return userConsent;
    } catch (error) {
      Logger.error('Error showing consent dialog', error as Error);
      return false; // Default to no consent on error
    }
  }

  private static buildConsentMessage(payload: ConsentPayload): string {
    const fileName = payload.filePath.split('/').pop() || payload.filePath;
    
    let message = `🤖 **GitHub Copilot Migration Assistance**\n\n`;
    message += `L1X Migrator wants to share the following data with GitHub Copilot for migration assistance:\n\n`;
    message += `📁 **File**: ${fileName}\n`;
    message += `🔒 **Redacted items**: ${payload.redactionSummary.redactionCount}\n`;
    message += `📊 **API specs**: ${payload.specSections.length} relevant sections\n\n`;

    if (payload.redactionSummary.redactionCount > 0) {
      message += `✅ Sensitive information has been automatically redacted for your protection.\n\n`;
    }

    message += `The data will be sent to GitHub Copilot to generate migration suggestions from Converge API to Elavon L1 API.\n\n`;
    message += `Do you want to proceed?`;

    return message;
  }

  private static async showDetailedReview(payload: ConsentPayload): Promise<boolean> {
    Logger.info('Showing detailed consent review');

    try {
      // Create a detailed review in a new document
      const reviewContent = this.buildDetailedReviewContent(payload);
      
      const doc = await vscode.workspace.openTextDocument({
        content: reviewContent,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, { preview: true });

      // Ask for final consent after review
      const finalOptions = ['Approve and Share', 'Cancel'];
      const finalChoice = await vscode.window.showInformationMessage(
        'After reviewing the details, do you want to share this data with GitHub Copilot?',
        { modal: true },
        ...finalOptions
      );

      const approved = finalChoice === finalOptions[0];
      Logger.info(`User ${approved ? 'approved' : 'declined'} after detailed review`);
      
      return approved;
    } catch (error) {
      Logger.error('Error showing detailed review', error as Error);
      return false;
    }
  }

  private static buildDetailedReviewContent(payload: ConsentPayload): string {
    let content = `# GitHub Copilot Data Sharing Review\n\n`;
    content += `## File Information\n`;
    content += `- **Path**: ${payload.filePath}\n`;
    content += `- **Size**: ${payload.contentPreview.length} characters\n\n`;

    // Redaction summary
    content += `## Data Protection Summary\n`;
    if (payload.redactionSummary.redactionCount > 0) {
      content += `✅ **${payload.redactionSummary.redactionCount} sensitive items** have been automatically redacted:\n\n`;
      
      const itemsByType = payload.redactionSummary.redactedItems.reduce((acc, item) => {
        if (!acc[item.type]) {acc[item.type] = 0;}
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(itemsByType).forEach(([type, count]) => {
        if (count !== undefined && type) {
          const typeLabel = type.replace('_', ' ').toUpperCase();
          content += `- ${count} ${typeLabel}${count > 1 ? 'S' : ''}\n`;
        }
      });
      content += `\n`;
    } else {
      content += `ℹ️ No sensitive data patterns detected in this file.\n\n`;
    }

    // Content preview
    content += `## Content Preview (Redacted)\n`;
    content += `\`\`\`\n`;
    content += payload.contentPreview.substring(0, 1000); // Limit preview size
    if (payload.contentPreview.length > 1000) {
      content += `\n... [Preview truncated]\n`;
    }
    content += `\`\`\`\n\n`;

    // API specifications
    if (payload.specSections.length > 0) {
      content += `## OpenAPI Specifications to Include\n`;
      payload.specSections.forEach(spec => {
        content += `- **${spec.title}** (relevance: ${Math.round(spec.relevanceScore * 100)}%)\n`;
      });
      content += `\n`;
    }

    // Data usage explanation
    content += `## How This Data Will Be Used\n`;
    content += `1. **File content** will be analyzed to identify Converge API patterns\n`;
    content += `2. **OpenAPI specifications** will provide context for accurate mappings\n`;
    content += `3. **GitHub Copilot** will generate migration suggestions and code examples\n`;
    content += `4. **No data is stored** by GitHub Copilot beyond the conversation session\n\n`;

    content += `## Privacy Notes\n`;
    content += `- Sensitive data has been automatically redacted before sharing\n`;
    content += `- Only the content shown above will be sent to GitHub Copilot\n`;
    content += `- You can cancel at any time before the data is sent\n`;
    content += `- This consent applies only to the current migration request\n\n`;

    content += `---\n`;
    content += `*Review complete. Close this tab and respond to the consent dialog.*`;

    return content;
  }

  private static getSessionKey(filePath: string): string {
    // Create a session key based on file path and current session
    return `${filePath}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Clear session consent (useful for testing or when user wants to reset)
   */
  static clearSessionConsent(): void {
    this.sessionConsent.clear();
    Logger.info('Session consent cache cleared');
  }

  /**
   * Get consent statistics for telemetry
   */
  static getConsentStats(): { total: number; approved: number; declined: number } {
    const total = this.sessionConsent.size;
    const approved = Array.from(this.sessionConsent.values()).filter(consent => consent).length;
    const declined = total - approved;

    return { total, approved, declined };
  }

  /**
   * Show a simplified consent dialog for quick approval
   */
  static async showQuickConsent(filePath: string, redactionCount: number): Promise<boolean> {
    const fileName = filePath.split('/').pop() || filePath;
    
    const message = `Share "${fileName}" with GitHub Copilot for migration assistance?\n\n` +
                   `${redactionCount > 0 ? `✅ ${redactionCount} sensitive items redacted\n` : ''}` +
                   `🤖 AI will provide Converge → Elavon L1 migration suggestions`;

    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      'Share', 'Cancel'
    );

    const approved = choice === 'Share';
    Logger.info(`Quick consent: ${approved ? 'approved' : 'declined'} for ${fileName}`);
    
    return approved;
  }
}