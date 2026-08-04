// ============================================
// AncestorDataHub - Paystack Integration
// ============================================

class PaystackService {
  constructor() {
    this.publicKey = null;
    this.initialized = false;
    this.isLoading = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize Paystack with public key from server
   * @returns {Promise<boolean>} - True if initialized successfully
   */
  async init() {
    // If already initialized, return true
    if (this.initialized) {
      return true;
    }

    // If currently loading, wait for it to complete
    if (this.isLoading) {
      return this.initializationPromise;
    }

    this.isLoading = true;
    this.initializationPromise = new Promise(async (resolve) => {
      try {
        console.log('🔐 Initializing Paystack...');
        
        // Fetch public key from server
        const response = await fetch('/api/config/public-config');
        const data = await response.json();

        if (data.success && data.data.paystackPublicKey) {
          this.publicKey = data.data.paystackPublicKey;
          this.initialized = true;
          console.log('✅ Paystack initialized successfully');
          console.log(`🔑 Public Key: ${this.publicKey.substring(0, 10)}...`);
          resolve(true);
        } else {
          console.error('❌ Paystack initialization failed:', data.message || 'No public key received');
          this.initialized = false;
          resolve(false);
        }
      } catch (error) {
        console.error('❌ Error loading Paystack config:', error);
        this.initialized = false;
        resolve(false);
      } finally {
        this.isLoading = false;
      }
    });

    return this.initializationPromise;
  }

  /**
   * Open Paystack payment popup
   * @param {Object} config - Payment configuration
   * @param {string} config.email - Customer email
   * @param {number} config.amount - Amount in GHS (will be converted to kobo)
   * @param {string} config.reference - Unique transaction reference
   * @param {Object} config.metadata - Additional metadata for the transaction
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onSuccess - Called when payment is successful
   * @param {Function} callbacks.onClose - Called when popup is closed
   * @param {Function} callbacks.onError - Called when an error occurs
   */
  openPopup(config, callbacks = {}) {
    // Check if Paystack is initialized
    if (!this.initialized) {
      const errorMsg = 'Payment system not ready. Please refresh and try again.';
      console.error(errorMsg);
      if (callbacks.onError) {
        callbacks.onError(errorMsg);
      }
      return;
    }

    // Check if PaystackPop is available
    if (typeof PaystackPop === 'undefined') {
      const errorMsg = 'Paystack library not loaded. Please check your internet connection.';
      console.error(errorMsg);
      if (callbacks.onError) {
        callbacks.onError(errorMsg);
      }
      return;
    }

    // Validate required fields
    if (!config.email) {
      const errorMsg = 'Customer email is required';
      console.error(errorMsg);
      if (callbacks.onError) {
        callbacks.onError(errorMsg);
      }
      return;
    }

    if (!config.amount || config.amount <= 0) {
      const errorMsg = 'Invalid amount';
      console.error(errorMsg);
      if (callbacks.onError) {
        callbacks.onError(errorMsg);
      }
      return;
    }

    if (!config.reference) {
      const errorMsg = 'Transaction reference is required';
      console.error(errorMsg);
      if (callbacks.onError) {
        callbacks.onError(errorMsg);
      }
      return;
    }

    try {
      console.log('💳 Opening Paystack popup...');
      console.log(`📧 Email: ${config.email}`);
      console.log(`💰 Amount: ₵${config.amount}`);
      console.log(`🔖 Reference: ${config.reference}`);

      // Setup Paystack popup
      const handler = PaystackPop.setup({
        key: this.publicKey,
        email: config.email,
        amount: Math.round(config.amount * 100), // Convert to kobo (cents)
        ref: config.reference,
        metadata: config.metadata || {},
        currency: 'GHS',
        channels: ['mobile_money', 'card', 'bank_transfer'], // All payment channels
        callback: function(response) {
          console.log('✅ Payment callback received:', response);
          if (callbacks.onSuccess) {
            callbacks.onSuccess(response);
          }
        },
        onClose: function() {
          console.log('❌ Payment popup closed by user');
          if (callbacks.onClose) {
            callbacks.onClose();
          }
        }
      });

      // Open the popup
      handler.openIframe();
      console.log('✅ Paystack popup opened successfully');

    } catch (error) {
      console.error('❌ Error opening Paystack popup:', error);
      if (callbacks.onError) {
        callbacks.onError('Failed to open payment window: ' + error.message);
      }
    }
  }

  /**
   * Verify a transaction
   * @param {string} reference - Transaction reference
   * @param {string} endpoint - API endpoint to verify (default: '/data/verify-payment')
   * @returns {Promise<Object>} - Verification response
   */
  async verifyTransaction(reference, endpoint = '/data/verify-payment') {
    try {
      console.log(`🔍 Verifying transaction: ${reference}`);
      const response = await fetch(`${endpoint}/${reference}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      
      console.log('✅ Transaction verified:', data);
      return data;
    } catch (error) {
      console.error('❌ Verification error:', error);
      throw new Error('Failed to verify payment: ' + error.message);
    }
  }

  /**
   * Check if Paystack is available and initialized
   * @returns {boolean} - True if Paystack is ready
   */
  isReady() {
    return this.initialized && typeof PaystackPop !== 'undefined';
  }

  /**
   * Get the current status of Paystack
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      publicKey: this.publicKey ? this.publicKey.substring(0, 10) + '...' : null,
      isLoading: this.isLoading,
      paystackLoaded: typeof PaystackPop !== 'undefined'
    };
  }
}

// ============================================
// Create singleton instance
// ============================================

const paystack = new PaystackService();

// ============================================
// Auto-initialize on page load
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Check if Paystack script is loaded
  if (typeof PaystackPop === 'undefined') {
    console.log('📦 Loading Paystack script...');
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = function() {
      console.log('✅ Paystack script loaded');
      paystack.init();
    };
    script.onerror = function() {
      console.error('❌ Failed to load Paystack script');
    };
    document.head.appendChild(script);
  } else {
    // Paystack already loaded
    paystack.init();
  }
});

// ============================================
// Export for browser
// ============================================

if (typeof window !== 'undefined') {
  window.paystack = paystack;
}

// ============================================
// Export for Node.js (if using modules)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = paystack;
}

// ============================================
// Helper: Format currency
// ============================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2
  }).format(amount);
}

// ============================================
// Helper: Generate reference
// ============================================

function generateReference(prefix = 'TXN') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Export helpers
if (typeof window !== 'undefined') {
  window.formatCurrency = formatCurrency;
  window.generateReference = generateReference;
}

console.log('📦 Paystack module loaded');
