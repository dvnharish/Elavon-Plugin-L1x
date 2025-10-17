// Sample JavaScript file with Converge API usage for testing
const converge = require('converge-api');

// Regex Scan: This will find endpoint URLs
const CONVERGE_API_URL = 'https://api.converge.elavonaws.com/v1';
const UAT_ENDPOINT = 'https://uat.api.converge.eu.elavonaws.com';

// AST Scan: This will find service classes
class ConvergePaymentService {
  constructor() {
    this.converge = new converge.Client({
      merchantId: 'demo123',
      apiKey: 'AKA_test',
      apiSecret: 'secret_key_123'
    });
  }

  // AST Scan: This will find method definitions
  async processPayment(paymentData) {
    try {
      // Process a payment transaction
      const result = await this.converge.processPayment(paymentData);
      console.log('Payment processed:', result);
      return result;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }

  async processRefund(transactionId, amount) {
    try {
      // Process a refund
      const result = await this.converge.refundPayment(transactionId, amount);
      console.log('Refund processed:', result);
      return result;
    } catch (error) {
      console.error('Refund failed:', error);
      throw error;
    }
  }

  async authenticate() {
    try {
      // Authenticate with Converge API
      const token = await this.converge.authenticate();
      console.log('Authentication successful');
      return token;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }
}

// Export the service
module.exports = ConvergePaymentService;