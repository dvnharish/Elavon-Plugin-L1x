import { Logger } from './logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('log', () => {
    it('should log message with L1X prefix', () => {
      Logger.log('test message');
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] test message');
    });

    it('should log message with additional arguments', () => {
      Logger.log('test message', 'arg1', 'arg2');
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] test message', 'arg1', 'arg2');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('test error');
      
      Logger.error('error message', error);
      
      expect(errorSpy).toHaveBeenCalledWith('[L1X] ERROR: error message', error);
      errorSpy.mockRestore();
    });
  });

  describe('buttonClicked', () => {
    it('should log button click with correct format', () => {
      Logger.buttonClicked('scanProject');
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] l1x_button_clicked:scanProject');
    });
  });

  describe('activate', () => {
    it('should log activation event', () => {
      Logger.activate();
      expect(consoleSpy).toHaveBeenCalledWith('[L1X] l1x_activate');
    });
  });
});