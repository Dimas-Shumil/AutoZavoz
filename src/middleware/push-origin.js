const allowed = new Set([
  "https://avtozavoz19.ru",
  "https://www.avtozavoz19.ru",
]);
function pushOrigin(req, res, next) {
  const origin = req.get("Origin");
  let local = false;
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      local =
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.protocol === "http:" &&
        url.origin === origin;
    } catch {}
  }
  if (
    req.get("Sec-Fetch-Site") === "cross-site" ||
    (!allowed.has(origin) && !local)
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Недопустимый источник запроса" });
  }
  return next();
}
module.exports = pushOrigin;
