const { encrypt, decrypt, parseCookies, setCookie, clearCookie, redirectUri } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    const query = req.query || {};
    if (query.error) return res.status(400).send("Deriv authorization was not completed. Please return to VictorTrade and try again.");
    if (!query.code || !query.state) return res.status(400).send("Missing authorization details. Please restart Deriv login.");
    const cookies = parseCookies(req);
    if (!cookies.vt_oauth) return res.status(400).send("Login session expired. Return to VictorTrade and connect again.");
    const saved = JSON.parse(decrypt(cookies.vt_oauth));
    clearCookie(res, "vt_oauth");
    if (!saved.state || saved.state !== query.state) return res.status(400).send("Security check failed. Please restart Deriv login.");
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.DERIV_CLIENT_ID || "",
      code: String(query.code),
      code_verifier: saved.verifier,
      redirect_uri: redirectUri()
    });
    const response = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form
    });
    const tokenData = await response.json();
    if (!response.ok || !tokenData.access_token) {
      return res.status(502).send("Deriv did not complete the secure connection. Check the registered callback URL and try again.");
    }
    const expiresIn = Math.max(60, Number(tokenData.expires_in) || 3600);
    setCookie(res, "vt_session", encrypt(JSON.stringify({
      access_token: tokenData.access_token,
      expires_at: Date.now() + expiresIn * 1000 - 30000
    })), expiresIn);
    res.writeHead(302, { Location: "/" });
    res.end();
  } catch (error) {
    res.status(500).send("Secure login could not be completed. Please restart the connection from VictorTrade.");
  }
};
