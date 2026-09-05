"use strict";

const crypto = require("crypto");

/* Passwords are never stored, only a scrypt hash with a per-password salt.
   Sessions are a signed cookie holding nothing but the role and an expiry, so
   there is no session table to grow or clean up. */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, s, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p
  }).toString("hex");
  return s + ":" + key;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || stored.indexOf(":") === -1) return false;
  const salt = stored.slice(0, stored.indexOf(":"));
  const want = Buffer.from(stored, "utf8");
  const got = Buffer.from(hashPassword(password, salt), "utf8");
  // Constant-time compare so a wrong password can't be found by timing.
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + mac;
}

function unsign(token, secret) {
  if (typeof token !== "string" || token.indexOf(".") === -1) return null;
  const [body, mac] = token.split(".");
  const want = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac || "", "utf8"), b = Buffer.from(want, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data;
  } catch (e) { return null; }
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

module.exports = { hashPassword, verifyPassword, sign, unsign, readCookie };
