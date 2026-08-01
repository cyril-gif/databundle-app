// Thin wrapper around Paystack's Charge API for direct Ghana Mobile Money payments.
// Docs: https://paystack.com/docs/payments/payment-channels/#mobile-money

const PAYSTACK_BASE = "https://api.paystack.co";

// Maps our payment method labels to Paystack's mobile money provider codes
export const PAYSTACK_PROVIDER_MAP = {
  "MTN MoMo": "mtn",
  "Telecel Cash": "vod", // Paystack still uses the legacy "vod" (Vodafone) code for Telecel Cash
  "AirtelTigo Money": "atl",
};

async function paystackRequest(path, options = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message || "Paystack request failed");
  }
  return data;
}

/**
 * Initiates a direct Mobile Money charge.
 * For Ghana, Paystack responds with data.status = "pay_offline" — the customer
 * must approve a prompt sent to their phone. The actual outcome (success/failure)
 * arrives later via the `charge.success` webhook event, not this response.
 */
export const initiateMobileMoneyCharge = ({ amountPesewas, email, phone, provider, reference }) => {
  return paystackRequest("/charge", {
    method: "POST",
    body: JSON.stringify({
      amount: amountPesewas, // Paystack expects the amount in the lowest currency unit (pesewas)
      email,
      currency: "GHS",
      reference,
      mobile_money: { phone, provider },
    }),
  });
};

// Optional: used if you ever want to double-check a transaction manually (e.g. admin tools)
export const verifyTransaction = (reference) => {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
};

// Some Mobile Money charges come back with data.status = "send_otp" — the customer
// gets a code via SMS and it must be submitted here before the charge proceeds.
export const submitOtp = ({ otp, reference }) => {
  return paystackRequest("/charge/submit_otp", {
    method: "POST",
    body: JSON.stringify({ otp, reference }),
  });
};
