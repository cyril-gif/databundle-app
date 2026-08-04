const axios = require('axios');

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.apiUrl = process.env.PAYSTACK_API_URL || 'https://api.paystack.co';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Initialize a transaction
   */
  async initializeTransaction(email, amount, metadata = {}) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Convert to kobo
          metadata: metadata,
          callback_url: `${this.frontendUrl}/payment-callback.html`
        },
        { headers: this.getHeaders() }
      );
      
      if (!response.data.status) {
        throw new Error(response.data.message || 'Transaction initialization failed');
      }
      
      return response.data;
    } catch (error) {
      console.error('Paystack init error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment initialization failed');
    }
  }

  /**
   * Verify a transaction
   */
  async verifyTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );
      
      if (!response.data.status) {
        throw new Error(response.data.message || 'Transaction verification failed');
      }
      
      return response.data;
    } catch (error) {
      console.error('Paystack verify error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment verification failed');
    }
  }

  /**
   * Get public key (safe to expose)
   */
  getPublicKey() {
    return this.publicKey;
  }

  /**
   * Check if Paystack is configured
   */
  isConfigured() {
    return !!(this.secretKey && this.publicKey);
  }
}

module.exports = new PaystackService();
