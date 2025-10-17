import { DIContainer, ServiceToken } from './container';

interface TestService {
  getValue(): string;
}

class TestServiceImpl implements TestService {
  getValue(): string {
    return 'test-value';
  }
}

const TEST_SERVICE_TOKEN: ServiceToken<TestService> = { name: 'TestService' };

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe('register and get', () => {
    it('should register and retrieve a service', () => {
      container.register(TEST_SERVICE_TOKEN, () => new TestServiceImpl());
      
      const service = container.get(TEST_SERVICE_TOKEN);
      
      expect(service).toBeInstanceOf(TestServiceImpl);
      expect(service.getValue()).toBe('test-value');
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      container.register(TEST_SERVICE_TOKEN, () => new TestServiceImpl());
      
      const service1 = container.get(TEST_SERVICE_TOKEN);
      const service2 = container.get(TEST_SERVICE_TOKEN);
      
      expect(service1).toBe(service2);
    });

    it('should throw error for unregistered service', () => {
      expect(() => container.get(TEST_SERVICE_TOKEN)).toThrow('Service not registered: TestService');
    });
  });

  describe('dispose', () => {
    it('should clear all services and instances', () => {
      container.register(TEST_SERVICE_TOKEN, () => new TestServiceImpl());
      container.get(TEST_SERVICE_TOKEN); // Create instance
      
      container.dispose();
      
      expect(() => container.get(TEST_SERVICE_TOKEN)).toThrow('Service not registered: TestService');
    });
  });
});