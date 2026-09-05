"use strict";

/* Exercises the real SQL and the real routes against an in-memory PostgreSQL,
   so the schema, the queries and every access rule are covered without needing
   a database container. */

const assert = require("assert");
const http = require("http");
const { newDb } = require("pg-mem");
const { Store } = require("../db");
const { buildApp } = require("../server");
const { hashPassword } = require("../auth");

const SECRET = "test-secret";
let pass = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { console.log("  ✗ " + name); process.exitCode = 1; }
}

function request(server, method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, method, path,
      headers: Object.assign(
        { "content-type": "application/json" },
        data ? { "content-length": Buffer.byteLength(data) } : {},
        cookie ? { cookie } : {}
      )
    }, res => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { /* not json */ }
        const setCookie = (res.headers["set-cookie"] || [])[0];
        resolve({ status: res.statusCode, body: json, raw, cookie: setCookie ? setCookie.split(";")[0] : null, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const mem = newDb({ noAstCoverageCheck: true });
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  const store = new Store(pool);

  console.log("\nSchema");
  await store.init();
  ok("schema creates without error", true);
  await store.init();
  ok("init is safe to run twice (IF NOT EXISTS)", true);

  const app = buildApp(store, {
    secret: SECRET,
    staffHash: hashPassword("shop-pass"),
    adminHash: hashPassword("Admin2026#"),
    adminUser: "Admin",
    secureCookies: false,
    webRoot: __dirname
  });
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r));

  console.log("\nAuthentication");
  let r = await request(server, "GET", "/api/state");
  ok("register is not readable when signed out", r.status === 401);

  r = await request(server, "POST", "/api/login", { body: { password: "wrong" } });
  ok("wrong staff password rejected", r.status === 401);

  r = await request(server, "POST", "/api/login", { body: { password: "shop-pass" } });
  ok("correct staff password accepted", r.status === 200 && r.body.role === "staff");
  const staffCookie = r.cookie;
  ok("session cookie is httpOnly", /HttpOnly/i.test((r.headers["set-cookie"] || [])[0] || ""));

  r = await request(server, "POST", "/api/login", { body: { username: "Admin", password: "wrong" } });
  ok("wrong admin password rejected", r.status === 401);

  r = await request(server, "POST", "/api/login", { body: { username: "Admin", password: "Admin2026#" } });
  ok("correct admin credentials accepted", r.status === 200 && r.body.role === "admin");
  const adminCookie = r.cookie;

  r = await request(server, "POST", "/api/login", { body: { username: "admin", password: "Admin2026#" } });
  ok("admin username is case-insensitive", r.status === 200);

  r = await request(server, "GET", "/api/state", { cookie: "wps=forged.token" });
  ok("forged cookie rejected", r.status === 401);

  console.log("\nJob numbering");
  r = await request(server, "POST", "/api/jobs", {
    cookie: staffCookie,
    body: { name: "Business cards", dayStamp: "260905", total: 9500, advance: 4000 }
  });
  ok("staff can create a job", r.status === 200);
  ok("server assigns the first number of the day", r.body.code === "260905001");

  r = await request(server, "POST", "/api/jobs", {
    cookie: staffCookie, body: { name: "Second", dayStamp: "260905" }
  });
  ok("second job of the day increments", r.body.code === "260905002");

  r = await request(server, "POST", "/api/jobs", {
    cookie: staffCookie, body: { name: "Next day", dayStamp: "260906" }
  });
  ok("a new day restarts at 001", r.body.code === "260906001");

  // Two at once must not collide — this is why numbering lives on the server.
  const burst = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    request(server, "POST", "/api/jobs", {
      cookie: staffCookie, body: { name: "Burst " + i, dayStamp: "260907" }
    })));
  const codes = burst.map(x => x.body.code);
  ok("12 simultaneous jobs get 12 distinct numbers", new Set(codes).size === 12);
  ok("simultaneous numbers are contiguous",
    codes.slice().sort().join(",") === Array.from({ length: 12 }, (_, i) =>
      "260907" + String(i + 1).padStart(3, "0")).join(","));

  console.log("\nWho may touch money");
  const state = (await request(server, "GET", "/api/state", { cookie: staffCookie })).body;
  const job = state.jobs.find(j => j.code === "260905001");
  ok("amounts entered at creation are stored", job.total === 9500 && job.advance === 4000);

  r = await request(server, "PATCH", "/api/jobs/" + job.id, {
    cookie: staffCookie, body: { name: "Business cards (rev)", total: 999999, finalAmount: 5000 }
  });
  ok("staff edit is accepted", r.status === 200);
  const after = r.body.state.jobs.find(j => j.id === job.id);
  ok("staff edit changed the name", after.name === "Business cards (rev)");
  ok("staff CANNOT change the total", after.total === 9500);
  ok("staff CANNOT record a final payment", after.finalAmount === 0);

  r = await request(server, "PATCH", "/api/jobs/" + job.id, {
    cookie: adminCookie, body: { total: 12000, finalAmount: 8000, outsourcePaid: 300 }
  });
  const adminEdited = r.body.state.jobs.find(j => j.id === job.id);
  ok("admin CAN change the total", adminEdited.total === 12000);
  ok("admin CAN record a final payment", adminEdited.finalAmount === 8000);
  ok("admin CAN record money paid out", adminEdited.outsourcePaid === 300);

  console.log("\nAdmin-only actions");
  r = await request(server, "DELETE", "/api/jobs/" + job.id, { cookie: staffCookie });
  ok("staff cannot delete a job", r.status === 403);
  r = await request(server, "POST", "/api/staff", { cookie: staffCookie, body: { name: "Nuwan" } });
  ok("staff cannot add team members", r.status === 403);
  r = await request(server, "POST", "/api/wipe", { cookie: staffCookie });
  ok("staff cannot erase everything", r.status === 403);

  r = await request(server, "POST", "/api/staff", {
    cookie: adminCookie, body: { name: "Nuwan Perera", role: "Press", phone: "077", active: true }
  });
  ok("admin can add a team member", r.status === 200);
  ok("team member is returned in state", r.body.state.staff.some(s => s.name === "Nuwan Perera"));

  console.log("\nCustomers, outsourcers, assignment");
  r = await request(server, "POST", "/api/customers", {
    cookie: staffCookie, body: { name: "Kasun", company: "Ceylon Fresh", phone: "011" }
  });
  ok("staff can save a customer", r.status === 200 && r.body.state.customers.length === 1);
  const custId = r.body.id;

  r = await request(server, "POST", "/api/partners", {
    cookie: staffCookie, body: { name: "Ajith", company: "Lanka Foil" }
  });
  ok("staff can save an outsourcing place", r.status === 200 && r.body.state.partners.length === 1);

  const staffId = (await request(server, "GET", "/api/state", { cookie: adminCookie }))
    .body.staff[0].id;
  r = await request(server, "POST", "/api/jobs", {
    cookie: staffCookie,
    body: { name: "Assigned job", dayStamp: "260908", assigned: [staffId], customerId: custId }
  });
  const assignedJob = r.body.state.jobs.find(j => j.code === "260908001");
  ok("assigned people round-trip as a list", Array.isArray(assignedJob.assigned)
    && assignedJob.assigned.length === 1 && assignedJob.assigned[0] === staffId);
  ok("customer link round-trips", assignedJob.customerId === custId);

  r = await request(server, "POST", "/api/customers", {
    cookie: staffCookie, body: { id: custId, name: "Kasun R", company: "Ceylon Fresh", phone: "011 271" }
  });
  ok("saving an existing customer updates rather than duplicates",
    r.body.state.customers.length === 1 && r.body.state.customers[0].name === "Kasun R");

  console.log("\nChange detection");
  const v1 = (await request(server, "GET", "/api/version", { cookie: adminCookie })).body.version;
  await request(server, "POST", "/api/jobs", { cookie: staffCookie, body: { name: "Bump", dayStamp: "260909" } });
  const v2 = (await request(server, "GET", "/api/version", { cookie: adminCookie })).body.version;
  ok("version rises after a write", v2 > v1);
  const v3 = (await request(server, "GET", "/api/version", { cookie: adminCookie })).body.version;
  ok("version is steady when nothing changes", v3 === v2);

  console.log("\nValidation and erase");
  r = await request(server, "POST", "/api/jobs", { cookie: staffCookie, body: { name: "   " } });
  ok("a job with no name is refused", r.status === 400);
  r = await request(server, "POST", "/api/customers", { cookie: staffCookie, body: { company: "No name" } });
  ok("a customer with no name is refused", r.status === 400);

  r = await request(server, "POST", "/api/wipe", { cookie: adminCookie });
  ok("admin can erase everything", r.status === 200
    && r.body.state.jobs.length === 0 && r.body.state.customers.length === 0
    && r.body.state.staff.length === 0);

  r = await request(server, "POST", "/api/jobs", { cookie: staffCookie, body: { name: "After wipe", dayStamp: "260905" } });
  ok("numbering restarts cleanly after an erase", r.body.code === "260905001");

  console.log("\nSign out");
  r = await request(server, "POST", "/api/logout", { cookie: staffCookie });
  ok("logout clears the cookie", /wps=;/.test((r.headers["set-cookie"] || [])[0] || ""));

  server.close();
  console.log("\n" + pass + " checks passed\n");
}

main().catch(e => { console.error(e); process.exit(1); });
