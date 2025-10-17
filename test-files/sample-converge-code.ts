// Sample TypeScript file with Converge API usage for testing
import { ConvergeAPI, PaymentData, RefundData } from 'converge-sdk';

// Regex Scan: This will find endpoint URLs
const CONVERGE_ENDPOINT = 'https://api.eu.convergepay.com/v2';
const SANDBOX_URL = 'https://uat.api.converge.eu.elavonaws.com/sandbox';

// DTO Scan: This will find Data Transfer Objects
interface PaymentRequestDTO {
  merchantId: string;
  apiKey: string;
  transactionId: string;
  amount: number;
  currency: string;
}

interface PaymentResponseDTO {
  transactionId: string;
  status: string;
  amount: number;
  timestamp: Date;
}

interface ConvergeConfigModel {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
}

// AST Scan: This will find service classes
export class ConvergePaymentProcessor {
  private convergeClient: ConvergeAPI;

  constructor(config: ConvergeConfigModel) {
    this.convergeClient = new ConvergeAPI(config);
  }

  // AST Scan: This will find method definitions
  async processTransaction(paymentData: PaymentData): Promise<PaymentResponseDTO> {
    try {
      // Process transaction using Converge API
      const response = await this.convergeClient.transaction.create(paymentData);
      
      if (response.success) {
        console.log('Transaction successful:', response.transactionId);
        return response;
      } else {
        throw new Error('Transaction failed: ' + response.message);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  async processRefund(refundData: RefundData): Promise<any> {
    try {
      // Process refund using Converge API
      const response = await this.convergeClient.refund.process(refundData);
      
      if (response.success) {
        console.log('Refund successful:', response.refundId);
        return response;
      } else {
        throw new Error('Refund failed: ' + response.message);
      }
    } catch (error) {
      console.error('Refund error:', error);
      throw error;
    }
  }

  async authenticateUser(credentials: any): Promise<string> {
    try {
      // Authenticate using Converge API
      const authResponse = await this.convergeClient.auth.authenticate(credentials);
      
      if (authResponse.token) {
        console.log('Authentication successful');
        return authResponse.token;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }
}

// Usage example
const processor = new ConvergePaymentProcessor({
  merchantId: 'merchant_123',
  apiKey: 'api_key_456',
  apiSecret: 'secret_789'
});

export default processor;