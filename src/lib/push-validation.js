const { ECDH } = require("node:crypto");
function badInput() {
  const error = new Error("Некорректная push-подписка.");
  error.status = 400;
  return error;
}
function validateEndpoint(value) {
  if (typeof value !== "string" || value.length > 3000) throw badInput();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw badInput();
  }
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host === "web.push.apple.com" ||
    /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  if (
    !allowed ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash
  )
    throw badInput();
  return url.href;
}
function decodeKey(value, size) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(value) ||
    value.length > 128
  )
    throw badInput();
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.length !== size ||
    decoded.toString("base64url") !== value.replace(/=+$/, "")
  )
    throw badInput();
  return decoded;
}
function validateSubscription(body) {
  if (!body || typeof body !== "object") throw badInput();
  const endpoint = validateEndpoint(body.endpoint);
  const p256dh = decodeKey(body.keys?.p256dh, 65);
  decodeKey(body.keys?.auth, 16);
  try {
    ECDH.convertKey(p256dh, "prime256v1");
  } catch {
    throw badInput();
  }
  return {
    endpoint,
    p256dh: p256dh.toString("base64url"),
    auth: Buffer.from(body.keys.auth, "base64url").toString("base64url"),
  };
}
module.exports = { validateEndpoint, validateSubscription };
