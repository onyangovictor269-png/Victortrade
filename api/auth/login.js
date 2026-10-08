const { setCookie, randomBase64Url, pkceChallenge, redirectUri, encrypt } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");
    const clientId = process.env.DERIV_CLIENT_ID;
    if (!clientId) return res.status(500).send("VictorTrade setup incomplete: DERIV_CLIENT_ID is missing.");
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      return res.status(500).send("VictorTrade setup incomplete: SESSION_SECRET must be at least 32 characters.");
    }
    const state = randomBase64Url(24);
    const verifier = randomBase64Url(48);
    setCookie(res, "vt_oauth", encrypt(JSON.stringify({ state, verifier })), 600);
    const url = new URL("https://auth.deriv.com/oauth2/auth");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("scope", "trade");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    res.writeHead(302, { Location: url.toString() });
    res.end();
  } catch (error) {
    res.status(500).send("Unable to start secure Deriv login. Check the Vercel environment variables.");
  }
};
