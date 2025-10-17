// Sample Elavon L1 API integration file for testing
const elavonL1SDK = require('elavon-l1-sdk');

class ElavonL1PaymentService {
  constructor() {
    this.config = {
      merchantId: process.env.ELAVON_L1_MERCHANT_ID,
      apiKey: process.env.ELAVON_L1_API_KEY,
      baseUrl: 'https://api.elavon.com/l1'
    };
  }

  async processTransaction(transactionData) {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/l1/transactions/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchant_id: this.config.merchantId,
          amount: transactionData.amount,
          payment_method: transactionData.paymentMethod,
          customer_data: transactionData.customerData
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Elavon L1 transaction processing failed:', error);
      throw error;
    }
  }

  async getAuthToken() {
    const tokenEndpoint = `/api/l1/auth/token`;
    
    try {
      const response = await elavon.l1.auth.getToken({
        merchant_id: this.config.merchantId,
        api_key: this.config.apiKey
      });

      return response.access_token;
    } catch (error) {
      console.error('Elavon L1 authentication failed:', error);
      throw error;
    }
  }

  async validateTransaction(transactionId) {
    return await elavon.transaction.validate({
      transaction_id: transactionId,
      merchant_id: this.config.merchantId
    });
  }
}

module.exports = ElavonL1PaymentService;