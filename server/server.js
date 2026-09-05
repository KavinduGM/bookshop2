"use strict";

const path = require("path");
const express = require("express");
const crypto = require("crypto");
const { Store } = require("./db");
const { hashPassword, verifyPassword, sign, unsign, readCookie } = require("./auth");

const COOKIE = "wps";
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error("Missing required environment variable: " + name);
    process.exit(1);
  }
  return String(v).trim();
}

function buildApp(store, opts) {
  const app = express();
  const cfg = opts || {};
  const secret = cfg.secret;
  const staffHash = cfg.staffHash;
  const adminHash = cfg.adminHash;
  const adminUser = (cfg.adminUser || "Admin").toLowerCase();
  const secureCookies = cfg.secureCookies !== false;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);           // Traefik terminates TLS in front of us
  app.use(express.json({ limit: "256kb" }));

  app.use(function (req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=(), usb=()");
    if (secureCookies) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    // Self-contained page: the only network calls it makes are to this origin.
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
      "img-src data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    next();
  });

  /* ---------- sessions ---------- */

  function setSession(res, role) {
    const token = sign({ role, exp: Date.now() + SESSION_DAYS * DAY }, secret);
    res.cookie(COOKIE, token, {
      httpOnly: true,                  // unreachable from page scripts
      sameSite: "lax",
      secure: secureCookies,
      maxAge: SESSION_DAYS * DAY,
      path: "/"
    });
  }

  function sessionOf(req) {
    return unsign(readCookie(req, COOKIE), secret);
  }

  function requireRole(minimum) {
    return function (req, res, next) {
      const s = sessionOf(req);
      if (!s) return res.status(401).json({ error: "Not signed in" });
      if (minimum === "admin" && s.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
      }
      req.role = s.role;
      next();
    };
  }

  const anySignedIn = requireRole("any");
  const adminOnly = requireRole("admin");

  /* ---------- auth routes ---------- */

  // Brute force is slowed down per-IP rather than locked out, so a mistyped
  // password never strands the shop mid-shift.
  const attempts = new Map();
  function throttle(req) {
    const ip = req.ip || "unknown";
    const rec = attempts.get(ip) || { n: 0, at: 0 };
    const now = Date.now();
    if (now - rec.at > 15 * 60 * 1000) rec.n = 0;
    rec.n += 1; rec.at = now;
    attempts.set(ip, rec);
    return Math.min(2000, Math.max(0, (rec.n - 3) * 400));
  }

  app.post("/api/login", async function (req, res) {
    const body = req.body || {};
    const password = typeof body.password === "string" ? body.password : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const wait = throttle(req);
    if (wait) await new Promise(r => setTimeout(r, wait));

    if (username) {
      if (username.toLowerCase() === adminUser && verifyPassword(password, adminHash)) {
        attempts.delete(req.ip);
        setSession(res, "admin");
        return res.json({ role: "admin" });
      }
      return res.status(401).json({ error: "Wrong username or password." });
    }
    if (verifyPassword(password, staffHash)) {
      attempts.delete(req.ip);
      setSession(res, "staff");
      return res.json({ role: "staff" });
    }
    return res.status(401).json({ error: "Wrong password." });
  });

  app.post("/api/logout", function (req, res) {
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/me", function (req, res) {
    const s = sessionOf(req);
    res.json({ role: s ? s.role : null });
  });

  /* ---------- reading ---------- */

  app.get("/api/state", anySignedIn, async function (req, res, next) {
    try { res.json(await store.state()); } catch (e) { next(e); }
  });

  // Cheap enough to poll: one row, one number.
  app.get("/api/version", anySignedIn, async function (req, res, next) {
    try { res.json({ version: await store.version() }); } catch (e) { next(e); }
  });

  /* ---------- jobs ---------- */

  const MONEY_FIELDS = [
    "total", "advance", "advanceDate", "finalAmount", "finalDate",
    "outsourceCost", "outsourcePaid", "outsourcePaidDate"
  ];
  const STAFF_CREATE_MONEY = ["total", "advance", "advanceDate", "outsourceCost"];
  const OPEN_FIELDS = [
    "name", "type", "customerId", "customerName", "phone", "startDate",
    "handoverDate", "assigned", "status", "notes", "outsourced",
    "outsourceId", "outsourceName", "outsourceCompany", "outsourcePhone"
  ];

  function pick(src, keys) {
    const out = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
    }
    return out;
  }

  function dayStampFrom(body) {
    // The client sends its own local date; the shop and the server can sit in
    // different timezones and the number should match the shop's day.
    const d = typeof body.dayStamp === "string" && /^\d{6}$/.test(body.dayStamp)
      ? body.dayStamp : null;
    if (d) return d;
    const now = new Date();
    return String(now.getFullYear()).slice(2)
      + String(now.getMonth() + 1).padStart(2, "0")
      + String(now.getDate()).padStart(2, "0");
  }

  app.post("/api/jobs", anySignedIn, async function (req, res, next) {
    try {
      const body = req.body || {};
      if (!body.name || !String(body.name).trim()) {
        return res.status(400).json({ error: "A job needs a name." });
      }
      // Staff may set the opening amounts; only an admin may set the rest.
      const allowed = OPEN_FIELDS.concat(
        req.role === "admin" ? MONEY_FIELDS : STAFF_CREATE_MONEY
      );
      const job = pick(body, allowed);
      job.id = "j" + crypto.randomBytes(8).toString("hex");
      const code = await store.createJob(job, dayStampFrom(body));
      res.json({ id: job.id, code, state: await store.state() });
    } catch (e) { next(e); }
  });

  app.patch("/api/jobs/:id", anySignedIn, async function (req, res, next) {
    try {
      // This is the rule that matters: once a job exists, only an admin can
      // change anything to do with money. Enforced here, not in the browser.
      const allowed = req.role === "admin" ? OPEN_FIELDS.concat(MONEY_FIELDS) : OPEN_FIELDS;
      const patch = pick(req.body || {}, allowed);
      const ok = await store.updateJob(req.params.id, patch);
      if (!ok) return res.status(404).json({ error: "That job no longer exists." });
      res.json({ state: await store.state() });
    } catch (e) { next(e); }
  });

  app.delete("/api/jobs/:id", adminOnly, async function (req, res, next) {
    try {
      await store.deleteJob(req.params.id);
      res.json({ state: await store.state() });
    } catch (e) { next(e); }
  });

  /* ---------- customers, outsourcers, team ---------- */

  function simpleRoutes(name, table, cols, guard) {
    app.post("/api/" + name, guard, async function (req, res, next) {
      try {
        const body = req.body || {};
        const row = { id: body.id || (name[0] + crypto.randomBytes(8).toString("hex")) };
        for (const c of cols) {
          const key = c === "active" ? "active" : c;
          row[c] = c === "active" ? !!body.active : String(body[key] == null ? "" : body[key]);
        }
        if (!row.name || !String(row.name).trim()) {
          return res.status(400).json({ error: "A name is required." });
        }
        await store.upsertSimple(table, cols, row);
        res.json({ id: row.id, state: await store.state() });
      } catch (e) { next(e); }
    });

    app.delete("/api/" + name + "/:id", adminOnly, async function (req, res, next) {
      try {
        await store.deleteFrom(table, req.params.id);
        res.json({ state: await store.state() });
      } catch (e) { next(e); }
    });
  }

  simpleRoutes("customers", "customers", ["name", "company", "phone", "email", "note"], anySignedIn);
  simpleRoutes("partners", "partners", ["name", "company", "phone", "note"], anySignedIn);
  simpleRoutes("staff", "staff", ["name", "role", "phone", "active"], adminOnly);

  app.post("/api/wipe", adminOnly, async function (req, res, next) {
    try {
      await store.wipe();
      res.json({ state: await store.state() });
    } catch (e) { next(e); }
  });

  /* ---------- static app ---------- */

  const webRoot = cfg.webRoot || path.join(__dirname, "..");
  app.get("/healthz", function (req, res) { res.type("text/plain").send("ok\n"); });
  app.use(express.static(webRoot, {
    index: "index.html",
    etag: true,
    setHeaders: function (res) {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    }
  }));
  app.get("*", function (req, res) {
    res.sendFile(path.join(webRoot, "index.html"));
  });

  app.use(function (err, req, res, _next) {
    console.error("Request failed:", err && err.stack ? err.stack : err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}

async function main() {
  const { Pool } = require("pg");
  const secret = requiredEnv("SESSION_SECRET");
  const staffPassword = requiredEnv("STAFF_PASSWORD");
  const adminPassword = requiredEnv("ADMIN_PASSWORD");
  const adminUser = process.env.ADMIN_USERNAME || "Admin";

  const pool = new Pool({
    connectionString: requiredEnv("DATABASE_URL"),
    max: 10,
    idleTimeoutMillis: 30000
  });

  const store = new Store(pool);

  // The database container may still be starting when we are.
  for (let attempt = 1; ; attempt++) {
    try { await store.init(); break; }
    catch (e) {
      if (attempt >= 30) { console.error("Database unreachable:", e.message); process.exit(1); }
      console.log("Waiting for the database… (" + attempt + ")");
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const app = buildApp(store, {
    secret,
    staffHash: hashPassword(staffPassword, crypto.createHash("sha256")
      .update("staff:" + secret).digest("hex").slice(0, 32)),
    adminHash: hashPassword(adminPassword, crypto.createHash("sha256")
      .update("admin:" + secret).digest("hex").slice(0, 32)),
    adminUser,
    secureCookies: process.env.INSECURE_COOKIES !== "1"
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, "0.0.0.0", function () {
    console.log("Warnitha order tracking listening on " + port);
  });
}

if (require.main === module) main();

module.exports = { buildApp };
