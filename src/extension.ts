import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { DIContainer, SERVICE_TOKENS } from './di/container';
import { CommandRegistry } from './commands';
import { ScanPanel } from './panels/ScanPanel';
import { CredentialsPanel } from './panels/CredentialsPanel';
import { DocsPanel } from './panels/DocsPanel';
import { MigrationPanel } from './panels/MigrationPanel';

let container: DIContainer;
let commandRegistry: CommandRegistry;

export function activate(context: vscode.ExtensionContext) {
    Logger.activate();
    
    try {
        // Initialize DI container and register services
        container = new DIContainer();
        container.register(SERVICE_TOKENS.EXTENSION_CONTEXT, () => context);
        
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