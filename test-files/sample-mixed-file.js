// Sample mixed standards file for testing
const convergeSDK = require('converge-payment-sdk');
const elavonL1SDK = require('elavon-l1-sdk');

class MixedPaymentService {
  constructor() {
    // Converge configuration
    this.convergeConfig = {
      merchantId: process.env.CONVERGE_MERCHANT_ID,
      apiKey: process.env.CONVERGE_API_KEY,
      baseUrl: 'https://api.converge.com/v2'
    };

    // Elavon L1 configuration
    this.elavonConfig = {
      merchantId: process.env.ELAVON_L1_MERCHANT_ID,
      apiKey: process.env.ELAVON_L1_API_KEY,
      baseUrl: 'https://api.elavon.com/l1'
    };
  }

  // Legacy Converge method
  async processConvergePayment(paymentData) {
    const response = await fetch(`${this.convergeConfig.baseUrl}/api/v2/payments/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.convergeConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchant_id: this.convergeConfig.merchantId,
        amount: paymentData.amount
      })
    });

    return await response.json();
  }

  // New Elavon L1 method
  async processElavonTransaction(transactionData) {
    const response = await fetch(`${this.elavonConfig.baseUrl}/api/l1/transactions/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.elavonConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchant_id: this.elavonConfig.merchantId,
        amount: transactionData.amount
      })
    });

    return await response.json();
  }

  // Mixed authentication
  async authenticate(provider, credentials) {
    if (provider === 'converge') {
      return await converge.auth.authenticate(credentials);
    } else if (provider === 'elavon') {
      return await elavon.l1.auth.getToken(credentials);
    }
  }
}

module.exports = MixedPaymentService;