import * as vscode from 'vscode';
import { ICodeScannerService } from '../services/CodeScannerService';

export interface ServiceContainer {
  get<T>(token: ServiceToken<T>): T;
  register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void;
}

export interface ServiceToken<T> {
  readonly name: string;
}

export type ServiceFactory<T> = (container: ServiceContainer) => T;

export class DIContainer implements ServiceContainer {
  private services = new Map<string, ServiceFactory<any>>();
  private instances = new Map<string, any>();

  register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.services.set(token.name, factory);
  }

  get<T>(token: ServiceToken<T>): T {
    // Check if we already have an instance
    if (this.instances.has(token.name)) {
      return this.instances.get(token.name);
    }

    // Get the factory
    const factory = this.services.get(token.name);
    if (!factory) {
      throw new Error(`Service not registered: ${token.name}`);
    }

    // Create and cache the instance
    const instance = factory(this);
    this.instances.set(token.name, instance);
    return instance;
  }

  dispose(): void {
    this.instances.clear();
    this.services.clear();
  }
}

// Service tokens
export const SERVICE_TOKENS = {
  EXTENSION_CONTEXT: { name: 'ExtensionContext' } as ServiceToken<vscode.ExtensionContext>,
  CODE_SCANNER: { name: 'CodeScannerService' } as ServiceToken<ICodeScannerService>,
  COPILOT_SERVICE: { name: 'CopilotService' } as ServiceToken<import('../services/CopilotService').ICopilotService>,
  CONTEXT_BUILDER: { name: 'FileContextBuilder' } as ServiceToken<import('../services/FileContextBuilder').FileContextBuilder>,
  REDACTION_SERVICE: { name: 'RedactionService' } as ServiceToken<import('../services/RedactionService').RedactionService>,
  OPENAPI_SERVICE: { name: 'OpenApiService' } as ServiceToken<import('../services/OpenApiService').OpenApiService>,
  PROMPT_BUILDER: { name: 'PromptBuilder' } as ServiceToken<import('../services/PromptBuilder').PromptBuilder>,
  FILE_STANDARD_ANALYZER: { name: 'FileStandardAnalyzer' } as ServiceToken<import('../services/FileStandardAnalyzer').FileStandardAnalyzer>,
  SPEC_COMPARISON_SERVICE: { name: 'SpecComparisonService' } as ServiceToken<import('../services/SpecComparisonService').ISpecComparisonService>,
  SPEC_DIFF_ENGINE: { name: 'SpecDiffEngine' } as ServiceToken<import('../services/SpecDiffEngine').SpecDiffEngine>,
  FIELD_MAPPING_SERVICE: { name: 'FieldMappingService' } as ServiceToken<import('../services/FieldMappingService').FieldMappingService>,
  VALIDATION_ENGINE: { name: 'ValidationEngine' } as ServiceToken<import('../services/ValidationEngine').ValidationEngine>,
} as const;