import express, { json } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { MonitoAPI } from "monito-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 4000;

app.use(json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.BASE_URI,
  credentials: true,
}));

// ============================================================================
// 1. SDK PROXY CONFIGURATION 
// ============================================================================
let activeSdk = null;
let isConfigured = false;

app.use((req, res, next) => {
  // Try to wake up the SDK from cookies if the server restarted
  if (!activeSdk && req.cookies?.monito_apiKey) {
    activeSdk = new MonitoAPI({
      apiKey: req.cookies.monito_apiKey,
      apiSecret: req.cookies.monito_apiSecret,
      serverUrl: req.cookies.monito_url || "https://monito-api-hrtu4.ondigitalocean.app/",
      environment: "development",
      excludePaths: ["/health", "/config"],
      batchSize: 1, // Flush instantly for demo purposes
      flushInterval: 1000,
      debug: true,
    });
    isConfigured = true;
    console.log(`[monito] Waking up SDK for ${req.cookies.monito_apiKey.substring(0, 8)}...`);
  }

  if (!activeSdk) return next();
  return activeSdk.init()(req, res, next);
});

// Helper to label services even when SDK is not yet initialized
const serviceLabel = (name) => (req, res, next) => {
  if (activeSdk) return activeSdk.service(name)(req, res, next);
  next();
};

app.get("/health", (req, res) => {
  res.json({ status: "ok", configured: isConfigured });
});

// ============================================================================
// 2. CONFIGURATION ENDPOINTS (Linked to React Frontend)
// ============================================================================

app.post("/config", (req, res) => {
  const { apiKey, apiSecret, monitorUrl } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ success: false, message: "Missing credentials" });
  }

  const url = monitorUrl?.trim() || "https://monito-api-hrtu4.ondigitalocean.app/";

  if (activeSdk) activeSdk.destroy();

  activeSdk = new MonitoAPI({
    apiKey,
    apiSecret,
    serverUrl: url,
    environment: "development",
    excludePaths: ["/health", "/config"],
    batchSize: 1,
    flushInterval: 1000,
    debug: true,
  });

  isConfigured = true;

  const cookieOpts = { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax" };
  res.cookie("monito_apiKey", apiKey, cookieOpts);
  res.cookie("monito_apiSecret", apiSecret, cookieOpts);
  res.cookie("monito_url", url, cookieOpts);

  res.json({ success: true });
});

app.post("/config/reset", (req, res) => {
  if (activeSdk) activeSdk.destroy();
  activeSdk = null;
  isConfigured = false;
  res.clearCookie("monito_apiKey");
  res.clearCookie("monito_apiSecret");
  res.clearCookie("monito_url");
  res.json({ success: true });
});

// ============================================================================
// 3. MONOLITH SERVICE DOMAINS
// Break domains into Express Routers
// ============================================================================

// --- Auth Domain ---
const authRouter = express.Router();
authRouter.get("/profile", (req, res) => {
  res.json({ id: "u_1", name: "Demo User", role: "admin", plan: "pro" });
});
authRouter.post("/login", (req, res) => {
  const { email } = req.body || {};
  if (!email || email === "error@demo.com") {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  res.json({ success: true, token: "jwt_demo_token_xxx", expiresIn: 3600 });
});
authRouter.post("/logout", (req, res) => res.json({ success: true }));

// --- Billing Domain ---
const billingRouter = express.Router();
billingRouter.get("/invoices", (req, res) => {
  res.json([
    { id: "inv_1", amount: 29.99, status: "paid", date: "2025-03-01" },
    { id: "inv_2", amount: 49.99, status: "pending", date: "2025-04-01" },
  ]);
});
billingRouter.post("/charge", (req, res) => {
  if (Math.random() < 0.35) return res.status(402).json({ success: false, message: "Insufficient funds" });
  res.json({ success: true, transactionId: `txn_${Math.random().toString(36).substr(2, 9)}` });
});
billingRouter.get("/plan", (req, res) => res.json({ plan: "pro", seats: 5, renewsAt: "2025-05-01" }));

// --- Data / Inventory Domain ---
const dataRouter = express.Router();
dataRouter.get("/stats", (req, res) => {
  res.json({ uptime: "99.9%", load: +(Math.random() * 0.8).toFixed(2), connections: Math.floor(Math.random() * 200) + 50 });
});
dataRouter.get("/slow-query", (req, res) => {
  const delay = 1500 + Math.random() * 2000;
  setTimeout(() => res.json({ success: true, queryTime: Math.round(delay) }), delay);
});
dataRouter.get("/crash", (req, res) => {
  res.status(500).json({ success: false, message: "Unhandled exception - simulated crash" });
});
dataRouter.get("/not-found", (req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

// ============================================================================
// 4. MOUNT ROUTERS WITH SDK LABELS
// ============================================================================

app.use("/api/auth", serviceLabel("auth-service"), authRouter);
app.use("/api/billing", serviceLabel("billing-service"), billingRouter);
app.use("/api/data", serviceLabel("data-service"), dataRouter);

app.all("/api/echo", serviceLabel("echo-service"), (req, res) => {
  res.json({ method: req.method, path: req.path, body: req.body, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[monito] Backend Demo running`);
});