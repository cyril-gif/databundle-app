# DataHubGH — Data Bundle & BECE Result Checker Platform

Full-stack site: Node.js/Express/MongoDB backend + vanilla HTML/CSS/JS dark-themed frontend.

## Folder Structure
```
databundle-app/
├── server/          Express + MongoDB API
└── public/          Frontend (plain HTML/CSS/JS, no build step)
```

## 1. Backend Setup
```
cd server
npm install
cp .env.example .env
```
Edit `.env`:
- `MONGO_URI` → your MongoDB Atlas connection string
- `JWT_SECRET` → any long random string
- `CLIENT_URL` → where your frontend is hosted (e.g. http://localhost:5500 or your live domain)
- `ADMIN_PHONE` / `ADMIN_PIN` → login used to seed your first admin account

Seed your admin account:
```
npm run seed
```

Pull live bundle pricing from iDataGH (do this before anyone can buy — see section 4):
```
npm run sync-packages
```

Start the server:
```
node index.js
```
API runs on `http://localhost:5000/api` by default.

## 2. Frontend Setup
No build step needed. Just open `public/index.html` with a live server (VS Code "Live Server" extension, or `npx serve public`).

Update the API URL in `public/js/api.js` if your backend isn't on `localhost:5000`:
```js
const API_BASE = "http://localhost:5000/api";
```

## 3. Paystack Mobile Money Setup (already wired in)
The site charges customers directly via Paystack's Mobile Money Charge API — no redirect, no popup. Here's how it works and what you need to do:

**How the flow works:**
1. Customer submits the order/voucher form → backend calls Paystack's `/charge` endpoint with their MoMo number.
2. Paystack sends an approval prompt straight to the customer's phone. Your API response only confirms the prompt was *sent* — not that it was approved.
3. The customer approves and enters their MoMo PIN on their phone.
4. Paystack then calls **your webhook** (`POST /api/payments/paystack/webhook`) with a `charge.success` event — this is the only trusted signal that payment actually happened.
5. The webhook triggers `fulfillOrder` / `fulfillCheckerOrder`, which delivers the data / issues the voucher PIN.
6. The frontend polls `GET /api/orders/:reference` (or `/api/checker/:reference`) every 3 seconds until it sees `delivered` or `failed`.

**What you need to set up:**
1. Add your Paystack secret key to `.env`:
   ```
   PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY=REPLACE_WITH_YOUR_PAYSTACK_LIVE_SECRET_KEY
   ```
2. In the Paystack Dashboard → Settings → API Keys & Webhooks, set your webhook URL to:
   ```
   https://your-deployed-backend.com/api/payments/paystack/webhook
   ```
   This must be a **publicly reachable HTTPS URL** — Paystack cannot call `localhost`. For local testing, use a tunnel like `ngrok http 5000` and put the ngrok URL in the dashboard temporarily.
3. Deploy your `DATA_API_KEY` / `DATA_API_BASE_URL` (see section 4) so `fulfillOrder` can actually deliver data once payment is confirmed.

**Testing locally without a public webhook URL yet:**
Each order/voucher route has a temporary dev-only endpoint:
```
POST /api/orders/:reference/dev-confirm
POST /api/checker/:reference/dev-confirm
```
These manually trigger fulfillment so you can test the full flow before your webhook is live. **Delete these routes (or lock them behind admin auth) before going live** — in production, only the Paystack webhook should ever mark an order as paid.

## 4. iDataGH Data Delivery (already wired in)
`fulfillOrder` (in `server/controllers/orderController.js`) calls iDataGH's `place-order` endpoint once Paystack confirms payment.

**Setup:**
1. Get your API key from iDataGH and add it to `.env`:
   ```
   IDATAGH_API_KEY=your_real_key
   PRICE_MARKUP_PERCENT=8
   ```
2. Pull their live package catalog into your `Bundle` collection (this replaces the old hardcoded bundle list — run it any time their prices change):
   ```
   npm run sync-packages
   ```
   This applies your `PRICE_MARKUP_PERCENT` on top of their cost price automatically.
3. Keep your iDataGH wallet topped up — orders fail if the balance runs out. Check it any time via:
   ```
   GET /api/admin/wallet-balance   (admin token required)
   ```

**Why some orders may sit at "processing":**
iDataGH's `place-order` can return before the top-up actually finishes (their `order-status` returns `Pending` → `Completed`). `fulfillOrder` does one immediate status check, but if it's still pending it leaves the order as `processing`. Sweep those periodically:
```
POST /api/admin/reconcile-orders   (admin token required)
```
In production, put this behind a scheduled job (cron, or your host's scheduled tasks feature) running every few minutes so pending orders get marked delivered automatically instead of needing a manual trigger.

**If delivery fails after the customer already paid** (e.g. insufficient iDataGH wallet balance): the order is marked `failed` and logged to the console with its reference. Since Paystack has already been charged at that point, you'll need to either manually retry delivery or refund the customer — there's no auto-refund wired in yet.

## 5. Loading BECE Voucher Stock (Admin)
Vouchers must be loaded before customers can buy them. Use the admin-only endpoint:
```
POST /api/checker/vouchers/bulk
Authorization: Bearer <admin_token>
Body: { "year": 2026, "vouchers": [{ "serial": "XXXXX", "pin": "1234567" }, ...] }
```
Get an admin token by logging in with `ADMIN_PHONE` / `ADMIN_PIN` via `POST /api/auth/login`.

## 6. Deployment
- Backend → Render, Railway, or Fly.io (Node + MongoDB Atlas)
- Frontend → Vercel, Netlify, or GitHub Pages (it's fully static)

## Notes
- Guest checkout is supported — users don't need an account to buy data.
- Duplicate order protection blocks repeat orders to the same number within 5 minutes.
- Referral reward (GH₵2) is credited automatically when a referred user's first order is confirmed.
"# databundle-app" 
