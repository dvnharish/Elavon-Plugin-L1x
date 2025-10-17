import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { DIContainer, SERVICE_TOKENS } from './di/container';
import { CommandRegistry } from './commands';
import { ScanPanel } from './panels/ScanPanel';
import { CredentialsPanel } from './panels/CredentialsPanel.simple';
import { DocsPanel } from './panels/DocsPanel';
import { MigrationPanel } from './panels/MigrationPanel';
import { CodeScannerService } from './services/CodeScannerService';

let container: DIContainer;
let commandRegistry: CommandRegistry;

// Export container for use in other modules
export { container };

export function activate(context: vscode.ExtensionContext) {
    Logger.activate();
    
    try {
        // Initialize DI container and register services
        container = new DIContainer();
        container.register(SERVICE_TOKENS.EXTENSION_CONTEXT, () => context);
        container.register(SERVICE_TOKENS.CODE_SCANNER, () => new CodeScannerService());
        
        // Register GitHub Copilot integration services
        container.register(SERVICE_TOKENS.FILE_STANDARD_ANALYZER, () => new (require('./services/FileStandardAnalyzer').FileStandardAnalyzer)());
        container.register(SERVICE_TOKENS.OPENAPI_SERVICE, () => new (require('./services/OpenApiService').OpenApiService)());
        container.register(SERVICE_TOKENS.REDACTION_SERVICE, () => new (require('./services/RedactionService').RedactionService)());
        container.register(SERVICE_TOKENS.PROMPT_BUILDER, () => new (require('./services/PromptBuilder').PromptBuilder)());
        container.register(SERVICE_TOKENS.CONTEXT_BUILDER, (container) => {
            const fileStandardAnalyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER);
            const openApiService = container.get(SERVICE_TOKENS.OPENAPI_SERVICE);
            return new (require('./services/FileContextBuilder').FileContextBuilder)(fileStandardAnalyzer, openApiService);
        });
        container.register(SERVICE_TOKENS.COPILOT_SERVICE, () => new (require('./services/CopilotService').CopilotService)());
        
        // Register OpenAPI comparison services
        container.register(SERVICE_TOKENS.SPEC_DIFF_ENGINE, () => new (require('./services/SpecDiffEngine').SpecDiffEngine)());
        container.register(SERVICE_TOKENS.FIELD_MAPPING_SERVICE, () => new (require('./services/FieldMappingService').FieldMappingService)());
        container.register(SERVICE_TOKENS.SPEC_COMPARISON_SERVICE, (container) => {
            const openApiService = container.get(SERVICE_TOKENS.OPENAPI_SERVICE);
            const specDiffEngine = container.get(SERVICE_TOKENS.SPEC_DIFF_ENGINE);
            const fieldMappingService = container.get(SERVICE_TOKENS.FIELD_MAPPING_SERVICE);
            const fileStandardAnalyzer = container.get(SERVICE_TOKENS.FILE_STANDARD_ANALYZER);
            return new (require('./services/SpecComparisonService').SpecComparisonService)(
                openApiService, specDiffEngine, fieldMappingService, fileStandardAnalyzer
            );
        });
        
        // Register validation services
        container.register(SERVICE_TOKENS.VALIDATION_ENGINE, () => new (require('./services/ValidationEngine').ValidationEngine)());
        
        // Register infrastructure services
        const { PerformanceMonitor } = require('./utils/PerformanceMonitor');
        const { ErrorRecoveryManager } = require('./utils/ErrorRecovery');
        
        const performanceMonitor = new PerformanceMonitor(context);
        const errorRecovery = new ErrorRecoveryManager();
        
        // Make infrastructure services available globally
        (global as any).performanceMonitor = performanceMonitor;
        (global as any).errorRecovery = errorRecovery;
        
        // Register commands
        commandRegistry = new CommandRegistry(context);
        commandRegistry.registerAllCommands();
        
        // Register panel providers
        registerPanelProviders(context);
        
        Logger.info('Extension activated successfully');
    } catch (error) {
        Logger.error('Failed to activate extension', error as Error);
        throw error;
    }
}

function registerPanelProviders(context: vscode.ExtensionContext): void {
    // Register all panels as TreeDataProviders
    const scanPanel = new ScanPanel(context);
    const credentialsPanel = new CredentialsPanel(context);
    const docsPanel = new DocsPanel(context);
    const migrationPanel = new MigrationPanel(context);
    
    vscode.window.registerTreeDataProvider('l1x.scanPanel', scanPanel);
    vscode.window.registerTreeDataProvider('l1x.credentialsPanel', credentialsPanel);
    vscode.window.registerTreeDataProvider('l1x.docsPanel', docsPanel);
    vscode.window.registerTreeDataProvider('l1x.migrationPanel', migrationPanel);
    
    // Connect panels to command registry
    commandRegistry.setScanPanel(scanPanel);
    commandRegistry.setCredentialsPanel(credentialsPanel);
    commandRegistry.setDocsPanel(docsPanel);
    commandRegistry.setMigrationPanel(migrationPanel);
    
    Logger.info('Panel providers registered successfully');
}

export function deactivate() {
    Logger.log('Extension deactivated');
    
    try {
        commandRegistry?.dispose();
        container?.dispose();
    } catch (error) {
        Logger.error('Error during deactivation', error as Error);
    }
}