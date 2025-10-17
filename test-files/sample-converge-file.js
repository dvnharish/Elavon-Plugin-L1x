// Sample Converge API integration file for testing
const convergeSDK = require('converge-payment-sdk');

class ConvergePaymentService {
  constructor() {
    this.config = {
      merchantId: process.env.CONVERGE_MERCHANT_ID,
      apiKey: process.env.CONVERGE_API_KEY,
      baseUrl: 'https://api.converge.com/v2'
    };
  }

  async processPayment(paymentData) {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v2/payments/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchant_id: this.config.merchantId,
          amount: paymentData.amount,
          card_number: paymentData.cardNumber,
          expiry_date: paymentData.expiryDate
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Converge payment processing failed:', error);
      throw error;
    }
  }

  async processRefund(transactionId, amount) {
    const refundEndpoint = `/api/v2/refunds/converge/${transactionId}`;
    
    try {
      const response = await converge.refund.process({
        transaction_id: transactionId,
        refund_amount: amount,
        merchant_id: this.config.merchantId
      });

      return response;
    } catch (error) {
      console.error('Converge refund failed:', error);
      throw error;
    }
  }

  async authenticateUser(credentials) {
    return await converge.auth.authenticate({
      username: credentials.username,
      password: credentials.password,
      merchant_id: this.config.merchantId
    });
  }
}

module.exports = ConvergePaymentService;