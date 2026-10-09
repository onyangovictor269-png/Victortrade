const { decrypt, parseCookies } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") return res.status(405).json({ connected: false, error: "Method not allowed" });
    const cookies = parseCookies(req);
    if (!cookies.vt_session) return res.status(200).json({ connected: false });
    const session = JSON.parse(decrypt(cookies.vt_session));
    if (!session.access_token || !session.expires_at || Date.now() >= session.expires_at) {
      return res.status(200).json({ connected: false, expired: true });
    }
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: "Bearer " + session.access_token, Accept: "application/json" }
    });
    if (!response.ok) return res.status(200).json({ connected: false, error: "Deriv connection needs to be refreshed." });
    const data = await response.json();
    const accounts = Array.isArray(data.accounts) ? data.accounts : (Array.isArray(data.data) ? data.data : []);
    const demo = accounts.find(account => String(account.account_type || "").toLowerCase() === "demo");
    return res.status(200).json({
      connected: true,
      demoAvailable: Boolean(demo),
      accountType: demo ? "demo" : "authorized",
      message: demo ? "Connected. Demo account found. You can request one confirmed demo order from the demo-trading panel." : "Authorization received, but no demo account was found. Demo execution remains disabled."
    });
  } catch (error) {
    return res.status(200).json({ connected: false, error: "Connection status could not be verified. Please reconnect." });
  }
};
