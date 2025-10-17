import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CopilotResponse, FileContext } from '../types/copilot';
import { CopilotNotAvailableError, ApiTimeoutError, CopilotErrorHandler } from '../utils/CopilotErrorHandler';

export interface ICopilotService {
  checkAvailability(): Promise<boolean>;
  sendMigrationRequest(context: FileContext): Promise<CopilotResponse>;
  openChatWithPrompt(prompt: string): Promise<void>;
}

export class CopilotService implements ICopilotService {
  private readonly COPILOT_EXTENSION_ID = 'github.copilot-chat';
  private readonly COPILOT_COMMAND = 'github.copilot.chat.ask';

  async checkAvailability(): Promise<boolean> {
    try {
      Logger.info('Checking GitHub Copilot availability');
      
      // Check if GitHub Copilot Chat extension is installed
      const extension = vscode.extensions.getExtension(this.COPILOT_EXTENSION_ID);
      
      if (!extension) {
        Logger.warn('GitHub Copilot Chat extension not found');
        throw new CopilotNotAvailableError('GitHub Copilot Chat extension is not installed');
      }

      // Check if extension is active
      if (!extension.isActive) {
        Logger.info('Activating GitHub Copilot Chat extension');
        try {
          await extension.activate();
        } catch (error) {
          Logger.error('Failed to activate GitHub Copilot Chat extension', error as Error);
          throw new CopilotNotAvailableError('Failed to activate GitHub Copilot Chat extension');
        }
      }

      // Verify the command is available
      const commands = await vscode.commands.getCommands();
      const hasCommand = commands.includes(this.COPILOT_COMMAND);
      
      if (!hasCommand) {
        Logger.warn(`GitHub Copilot command ${this.COPILOT_COMMAND} not available`);
        throw new CopilotNotAvailableError('GitHub Copilot Chat command is not available');
      }

      Logger.info('GitHub Copilot is available and ready');
      return true;
    } catch (error) {
      if (error instanceof CopilotNotAvailableError) {
        throw error;
      }
      Logger.error('Error checking GitHub Copilot availability', error as Error);
      throw new CopilotNotAvailableError('Unable to verify GitHub Copilot availability');
    }
  }

  async sendMigrationRequest(context: FileContext): Promise<CopilotResponse> {
    try {
      Logger.info(`Sending migration request for file: ${context.filePath}`);
      
      // Build the migration prompt
      const prompt = this.buildMigrationPrompt(context);
      
      // Send to GitHub Copilot Chat
      await this.invokeCopilotChat(prompt);
      
      return {
        success: true,
        conversationId: `migration-${Date.now()}`
      };
    } catch (error) {
      Logger.error('Failed to send migration request to GitHub Copilot', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async openChatWithPrompt(prompt: string): Promise<void> {
    try {
      Logger.info('Opening GitHub Copilot Chat with custom prompt');
      await this.invokeCopilotChat(prompt);
    } catch (error) {
      Logger.error('Failed to open GitHub Copilot Chat', error as Error);
      throw error;
    }
  }

  private async invokeCopilotChat(prompt: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('l1x.copilot');
    const timeoutMs = config.get('timeoutMs', 30000);
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new ApiTimeoutError(timeoutMs)), timeoutMs);
      });

      // Race between the command execution and timeout
      await Promise.race([
        vscode.commands.executeCommand(this.COPILOT_COMMAND, prompt),
        timeoutPromise
      ]);
      
      Logger.info('Successfully sent prompt to GitHub Copilot Chat');
    } catch (error) {
      if (error instanceof ApiTimeoutError) {
        throw error;
      }
      Logger.error('Failed to invoke GitHub Copilot Chat command', error as Error);
      throw new Error(`GitHub Copilot Chat API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildMigrationPrompt(context: FileContext): string {
    const detectedStandard = context.detectedStandard;
    const hasEndpoints = detectedStandard?.details?.detectedEndpoints && detectedStandard.details.detectedEndpoints.length > 0;
    const hasSpecs = context.relevantSpecs.length > 0;

    let prompt = `# Converge to Elavon L1 Migration Request

## File Information
- **File**: ${context.filePath}
- **Language**: ${context.language}
- **Size**: ${context.fileSize} bytes`;

    if (detectedStandard) {
      prompt += `
- **Detected Standard**: ${detectedStandard.standard} (${detectedStandard.confidence}% confidence)`;
    }

    prompt += `

## Current Code
\`\`\`${context.language}
${context.content}
\`\`\``;

    if (hasEndpoints && detectedStandard?.details?.detectedEndpoints) {
      prompt += `

## Detected API Patterns`;
      detectedStandard.details.detectedEndpoints.forEach(endpoint => {
        prompt += `
- ${endpoint.name} (${endpoint.standard}, ${endpoint.confidence}% confidence)`;
      });
    }

    if (hasSpecs) {
      prompt += `

## Relevant API Specifications`;
      context.relevantSpecs.forEach(spec => {
        prompt += `
### ${spec.title}
\`\`\`json
${JSON.stringify(spec.content, null, 2)}
\`\`\``;
      });
    }

    prompt += `

## Migration Request
Please help migrate this ${context.language} code from Converge API to Elavon L1 API:

1. **Identify** all Converge API calls and patterns in the code
2. **Map** them to equivalent Elavon L1 endpoints and patterns
3. **Provide** specific code changes needed for the migration
4. **Explain** the key differences and any manual steps required
5. **Highlight** any potential issues or breaking changes

Please provide both the migrated code and a clear explanation of the changes made.`;

    return prompt;
  }
}