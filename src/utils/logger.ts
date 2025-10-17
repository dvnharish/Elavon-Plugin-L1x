export class Logger {
  private static readonly PREFIX = '[L1X]';

  static log(message: string, ...args: any[]): void {
    console.log(`${this.PREFIX} ${message}`, ...args);
  }

  static error(message: string, error?: Error): void {
    console.error(`${this.PREFIX} ERROR: ${message}`, error);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`${this.PREFIX} WARN: ${message}`, ...args);
  }

  static info(message: string, ...args: any[]): void {
    console.info(`${this.PREFIX} INFO: ${message}`, ...args);
  }

  static buttonClicked(buttonName: string): void {
    this.log(`l1x_button_clicked:${buttonName}`);
  }

  static activate(): void {
    this.log('l1x_activate');
  }
}