const { decrypt, parseCookies } = require("../_lib/auth");

const ALLOWED_SYMBOLS = new Set(["1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100"]);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const cookies = parseCookies(req);
    if (!cookies.vt_session) return res.status(401).json({ ok: false, error: "Connect Deriv again before placing a demo trade." });

    const session = JSON.parse(decrypt(cookies.vt_session));
    if (!session.access_token || !session.expires_at || Date.now() >= session.expires_at) {
      return res.status(401).json({ ok: false, error: "Your Deriv session expired. Reconnect and try again." });
    }

    const accountsResponse = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: "Bearer " + session.access_token, Accept: "application/json" }
    });
    if (!accountsResponse.ok) return res.status(502).json({ ok: false, error: "Deriv could not verify your accounts. Reconnect and try again." });

    const accountData = await accountsResponse.json();
    const accounts = Array.isArray(accountData.accounts) ? accountData.accounts : (Array.isArray(accountData.data) ? accountData.data : []);
    const demo = accounts.find(account => String(account.account_type || account.accountType || "").toLowerCase() === "demo");
    if (!demo) return res.status(403).json({ ok: false, error: "No Deriv demo account was found. No trade was placed." });

    const accountId = demo.account_id || demo.accountId || demo.id;
    const currency = String(demo.currency || "").toUpperCase();
    if (!accountId || !/^[A-Z0-9]{2,20}$/.test(currency)) {
      return res.status(502).json({ ok: false, error: "Deriv's demo account details were incomplete. No trade was placed." });
    }

    const otpResponse = await fetch("https://api.derivws.com/trading/v1/options/accounts/" + encodeURIComponent(String(accountId)) + "/otp", {
      method: "POST",
      headers: { Authorization: "Bearer " + session.access_token, Accept: "application/json" }
    });
    if (!otpResponse.ok) return res.status(502).json({ ok: false, error: "Deriv could not open the demo trading connection. No trade was placed." });

    const otpData = await otpResponse.json();
    const url = otpData && otpData.data && otpData.data.url ? otpData.data.url : otpData.url;
    let parsed;
    try { parsed = new URL(url); } catch (_) {}
    if (!parsed || parsed.protocol !== "wss:" || parsed.hostname !== "api.derivws.com" || !parsed.pathname.endsWith("/ws/demo") || !parsed.searchParams.get("otp")) {
      return res.status(502).json({ ok: false, error: "Deriv returned an unexpected trading connection. No trade was placed." });
    }

    return res.status(200).json({ ok: true, url: parsed.toString(), currency, accountType: "demo", allowedSymbols: Array.from(ALLOWED_SYMBOLS) });
  } catch (_) {
    return res.status(500).json({ ok: false, error: "The secure demo-trading connection failed. Please reconnect and try again." });
  }
};
