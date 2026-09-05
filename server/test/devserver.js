"use strict";
/* Runs the real server against an in-memory PostgreSQL so the whole app can be
   driven in a browser without a database container. Development only. */
const http = require("http");
const path = require("path");
const { newDb } = require("pg-mem");
const { Store } = require("../db");
const { buildApp } = require("../server");
const { hashPassword } = require("../auth");

(async function () {
  const mem = newDb({ noAstCoverageCheck: true });
  const pool = new (mem.adapters.createPg().Pool)();
  const store = new Store(pool);
  await store.init();

  const app = buildApp(store, {
    secret: "dev-secret",
    staffHash: hashPassword(process.env.STAFF_PASSWORD || "shop2026"),
    adminHash: hashPassword(process.env.ADMIN_PASSWORD || "Admin2026#"),
    adminUser: "Admin",
    secureCookies: false,
    webRoot: path.join(__dirname, "..", "..")
  });
  http.createServer(app).listen(8971, "127.0.0.1", function () {
    console.log("dev server on http://127.0.0.1:8971");
  });
})();
