const crypto = require("crypto");

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}
function b64(buffer) { return Buffer.from(buffer).toString("base64url"); }
function unb64(value) { return Buffer.from(value, "base64url"); }
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [b64(iv), b64(cipher.getAuthTag()), b64(encrypted)].join(".");
}
function decrypt(value) {
  const [iv, tag, data] = String(value || "").split(".");
  if (!iv || !tag || !data) throw new Error("Invalid session.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey(), unb64(iv));
  decipher.setAuthTag(unb64(tag));
  return Buffer.concat([decipher.update(unb64(data)), decipher.final()]).toString("utf8");
}
function parseCookies(req) {
  const output = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      const key = part.slice(0, i).trim();
      try { output[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) {}
    }
  }
  return output;
}
function setCookie(res, name, value, maxAge) {
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const existing = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", existing ? [...(Array.isArray(existing) ? existing : [existing]), cookie] : cookie);
}
function clearCookie(res, name) { setCookie(res, name, "", 0); }
function randomBase64Url(bytes) { return b64(crypto.randomBytes(bytes)); }
function pkceChallenge(verifier) { return b64(crypto.createHash("sha256").update(verifier).digest()); }
function redirectUri() {
  return process.env.DERIV_REDIRECT_URI || "https://victortrade.vercel.app/api/auth/callback";
}
module.exports = { encrypt, decrypt, parseCookies, setCookie, clearCookie, randomBase64Url, pkceChallenge, redirectUri };
