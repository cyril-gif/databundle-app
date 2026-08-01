// Wrapper around the iDataGH reseller API — this is what actually tops up
// customers' phones. Docs: https://idatagh.com (place-order / wallet-balance /
// order-status / packages endpoints).

const IDATAGH_BASE = process.env.IDATAGH_BASE_URL || "https://idatagh.com/wp-json/custom/v1";

// Our app uses "MTN" / "Telecel" / "AirtelTigo"; iDataGH expects lowercase codes.
export const IDATAGH_NETWORK_MAP = {
  MTN: "mtn",
  Telecel: "telecel",
  AirtelTigo: "airteltigo",
};

async function idataghRequest(path, options = {}) {
  const res = await fetch(`${IDATAGH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.IDATAGH_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || `iDataGH request failed: ${res.status}`);
  }
  return data;
}

// @param dataSize - the GB size as a number, e.g. 2 for a 2GB bundle
export const placeOrder = ({ network, beneficiary, dataSize }) => {
  return idataghRequest("/place-order", {
    method: "POST",
    body: JSON.stringify({
      network: IDATAGH_NETWORK_MAP[network],
      beneficiary,
      "pa_data-bundle-packages": dataSize,
    }),
  });
};

export const getWalletBalance = () => {
  return idataghRequest("/wallet-balance", { method: "GET" });
};

export const getOrderStatus = (orderId) => {
  return idataghRequest(`/order-status?order_id=${encodeURIComponent(orderId)}`, { method: "GET" });
};

// @param network - "MTN" | "Telecel" | "AirtelTigo" (our format, gets mapped)
export const fetchPackages = (network) => {
  const code = IDATAGH_NETWORK_MAP[network];
  return idataghRequest(`/packages?network=${code}`, { method: "GET" });
};
