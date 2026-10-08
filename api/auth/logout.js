const { clearCookie } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  clearCookie(res, "vt_session");
  clearCookie(res, "vt_oauth");
  res.writeHead(302, { Location: "/" });
  res.end();
};
