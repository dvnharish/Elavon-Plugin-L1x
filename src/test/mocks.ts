import * as vscode from 'vscode';

export class MockExtensionContext implements vscode.ExtensionContext {
  subscriptions: vscode.Disposable[] = [];
  workspaceState: vscode.Memento = new MockMemento();
  globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void } = new MockGlobalState() as any;
  secrets: vscode.SecretStorage = new MockSecretStorage();
  extensionUri: vscode.Uri = vscode.Uri.file('/mock/extension/path');
  extensionPath: string = '/mock/extension/path';
  asAbsolutePath = (relativePath: string) => `/mock/extension/path/${relativePath}`;
  storageUri: vscode.Uri | undefined = undefined;
  storagePath: string | undefined = undefined;
  globalStorageUri: vscode.Uri = vscode.Uri.file('/mock/global/storage');
  globalStoragePath: string = '/mock/global/storage';
  logUri: vscode.Uri = vscode.Uri.file('/mock/log');
  logPath: string = '/mock/log';
  extensionMode: vscode.ExtensionMode = 3; // ExtensionMode.Test
  extension: vscode.Extension<any> = {} as any;
  environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection = {} as any;
  languageModelAccessInformation: vscode.LanguageModelAccessInformation = {} as any;
}

class MockMemento implements vscode.Memento {
  private storage = new Map<string, any>();
  
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.storage.get(key) ?? defaultValue;
  }
  
  update(key: string, value: any): Thenable<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }
  
  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }
}

class MockGlobalState extends MockMemento {
  setKeysForSync(keys: readonly string[]): void {
    // Mock implementation
  }
}

class MockSecretStorage implements vscode.SecretStorage {
  private secrets = new Map<string, string>();
  
  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.secrets.get(key));
  }
  
  store(key: string, value: string): Thenable<void> {
    this.secrets.set(key, value);
    return Promise.resolve();
  }
  
  delete(key: string): Thenable<void> {
    this.secrets.delete(key);
    return Promise.resolve();
  }
  
  keys(): Thenable<string[]> {
    return Promise.resolve(Array.from(this.secrets.keys()));
  }
  
  onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event;
}

export const createMockContext = (): MockExtensionContext => new MockExtensionContext();