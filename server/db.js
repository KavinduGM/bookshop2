"use strict";

/* Database access. Every query lives here so the rest of the server never
   builds SQL, and so the schema is created on first boot rather than needing a
   separate migration step during deployment. */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT '',
  phone    TEXT NOT NULL DEFAULT '',
  active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  company  TEXT NOT NULL DEFAULT '',
  phone    TEXT NOT NULL DEFAULT '',
  email    TEXT NOT NULL DEFAULT '',
  note     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS partners (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  company  TEXT NOT NULL DEFAULT '',
  phone    TEXT NOT NULL DEFAULT '',
  note     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS jobs (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'Other',
  customer_id         TEXT NOT NULL DEFAULT '',
  customer_name       TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  start_date          TEXT NOT NULL DEFAULT '',
  handover_date       TEXT NOT NULL DEFAULT '',
  assigned            TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT '',
  total               NUMERIC NOT NULL DEFAULT 0,
  advance             NUMERIC NOT NULL DEFAULT 0,
  advance_date        TEXT NOT NULL DEFAULT '',
  final_amount        NUMERIC NOT NULL DEFAULT 0,
  final_date          TEXT NOT NULL DEFAULT '',
  outsourced          BOOLEAN NOT NULL DEFAULT FALSE,
  outsource_id        TEXT NOT NULL DEFAULT '',
  outsource_name      TEXT NOT NULL DEFAULT '',
  outsource_company   TEXT NOT NULL DEFAULT '',
  outsource_phone     TEXT NOT NULL DEFAULT '',
  outsource_cost      NUMERIC NOT NULL DEFAULT 0,
  outsource_paid      NUMERIC NOT NULL DEFAULT 0,
  outsource_paid_date TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* One row per day, holding the next number for that day. Job numbers are
   handed out here rather than in the browser so two devices booking a job at
   the same moment can never be given the same number. */
CREATE TABLE IF NOT EXISTS counters (
  day  TEXT PRIMARY KEY,
  next INTEGER NOT NULL
);

/* A single row whose number goes up on every write, so a client can ask
   "has anything changed?" without downloading the whole register. */
CREATE TABLE IF NOT EXISTS meta (
  id      INTEGER PRIMARY KEY,
  version BIGINT NOT NULL
);
INSERT INTO meta (id, version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
`;

/* Column <-> browser field mapping. The browser speaks camelCase; the database
   speaks snake_case. Kept in one place so a rename can't drift apart. */
const JOB_FIELDS = [
  ["code", "code", "text"],
  ["name", "name", "text"],
  ["type", "type", "text"],
  ["customer_id", "customerId", "text"],
  ["customer_name", "customerName", "text"],
  ["phone", "phone", "text"],
  ["start_date", "startDate", "text"],
  ["handover_date", "handoverDate", "text"],
  ["assigned", "assigned", "csv"],
  ["status", "status", "text"],
  ["total", "total", "num"],
  ["advance", "advance", "num"],
  ["advance_date", "advanceDate", "text"],
  ["final_amount", "finalAmount", "num"],
  ["final_date", "finalDate", "text"],
  ["outsourced", "outsourced", "bool"],
  ["outsource_id", "outsourceId", "text"],
  ["outsource_name", "outsourceName", "text"],
  ["outsource_company", "outsourceCompany", "text"],
  ["outsource_phone", "outsourcePhone", "text"],
  ["outsource_cost", "outsourceCost", "num"],
  ["outsource_paid", "outsourcePaid", "num"],
  ["outsource_paid_date", "outsourcePaidDate", "text"],
  ["notes", "notes", "text"]
];

function jobRowToJson(r) {
  const out = { id: r.id };
  for (const [col, key, kind] of JOB_FIELDS) {
    const v = r[col];
    if (kind === "num") out[key] = Number(v) || 0;
    else if (kind === "bool") out[key] = !!v;
    else if (kind === "csv") out[key] = v ? String(v).split(",").filter(Boolean) : [];
    else out[key] = v == null ? "" : String(v);
  }
  return out;
}

class Store {
  constructor(pool) { this.pool = pool; }

  async init() { await this.pool.query(SCHEMA); }

  async bumpVersion(client) {
    const q = client || this.pool;
    const r = await q.query("UPDATE meta SET version = version + 1 WHERE id = 1 RETURNING version");
    return Number(r.rows[0].version);
  }

  async version() {
    const r = await this.pool.query("SELECT version FROM meta WHERE id = 1");
    return Number(r.rows[0] ? r.rows[0].version : 0);
  }

  /* The whole register. It is small — a shop books a few thousand jobs a year —
     so sending it in one response keeps the browser code simple. */
  async state() {
    const [version, staff, customers, partners, jobs] = await Promise.all([
      this.version(),
      this.pool.query("SELECT * FROM staff ORDER BY name"),
      this.pool.query("SELECT * FROM customers ORDER BY name"),
      this.pool.query("SELECT * FROM partners ORDER BY name"),
      this.pool.query("SELECT * FROM jobs ORDER BY created_at DESC, code DESC")
    ]);
    return {
      version,
      staff: staff.rows.map(r => ({
        id: r.id, name: r.name, role: r.role, phone: r.phone, active: !!r.active
      })),
      customers: customers.rows.map(r => ({
        id: r.id, name: r.name, company: r.company, phone: r.phone, email: r.email, note: r.note
      })),
      partners: partners.rows.map(r => ({
        id: r.id, name: r.name, company: r.company, phone: r.phone, note: r.note
      })),
      jobs: jobs.rows.map(jobRowToJson)
    };
  }

  /* Reserves the next number for a given day. Runs inside the caller's
     transaction, and the row lock means two simultaneous requests queue rather
     than both reading the same value. */
  async takeJobNumber(client, dayStamp) {
    await client.query(
      "INSERT INTO counters (day, next) VALUES ($1, 1) ON CONFLICT (day) DO NOTHING",
      [dayStamp]
    );
    const r = await client.query(
      "UPDATE counters SET next = next + 1 WHERE day = $1 RETURNING next",
      [dayStamp]
    );
    const used = Number(r.rows[0].next) - 1;
    return dayStamp + String(used).padStart(3, "0");
  }

  async createJob(job, dayStamp) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const code = await this.takeJobNumber(client, dayStamp);
      const cols = ["id"].concat(JOB_FIELDS.map(f => f[0]));
      const vals = [job.id].concat(JOB_FIELDS.map(([col, key, kind]) => {
        if (col === "code") return code;
        return toColumn(job[key], kind);
      }));
      const ph = vals.map((_, i) => "$" + (i + 1)).join(",");
      await client.query(
        `INSERT INTO jobs (${cols.join(",")}) VALUES (${ph})`, vals
      );
      await this.bumpVersion(client);
      await client.query("COMMIT");
      return code;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /* Only the fields the caller is allowed to change are passed in, so the
     server decides what a staff member may touch, not the browser. */
  async updateJob(id, patch) {
    const sets = [], vals = [];
    for (const [col, key, kind] of JOB_FIELDS) {
      if (col === "code") continue;                 // never reissued
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      vals.push(toColumn(patch[key], kind));
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return false;
    vals.push(id);
    const r = await this.pool.query(
      `UPDATE jobs SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals
    );
    await this.bumpVersion();
    return r.rowCount > 0;
  }

  async deleteJob(id) {
    const r = await this.pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    await this.bumpVersion();
    return r.rowCount > 0;
  }

  async upsertSimple(table, cols, row) {
    const names = ["id"].concat(cols);
    const vals = names.map(c => row[c]);
    const ph = names.map((_, i) => "$" + (i + 1)).join(",");
    const updates = cols.map(c => `${c} = EXCLUDED.${c}`).join(", ");
    await this.pool.query(
      `INSERT INTO ${table} (${names.join(",")}) VALUES (${ph})
       ON CONFLICT (id) DO UPDATE SET ${updates}`, vals
    );
    await this.bumpVersion();
  }

  async deleteFrom(table, id) {
    const r = await this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await this.bumpVersion();
    return r.rowCount > 0;
  }

  async wipe() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const t of ["jobs", "customers", "partners", "staff", "counters"]) {
        await client.query(`DELETE FROM ${t}`);
      }
      await this.bumpVersion(client);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

function toColumn(v, kind) {
  if (kind === "num") return Number(v) || 0;
  if (kind === "bool") return !!v;
  if (kind === "csv") return Array.isArray(v) ? v.filter(Boolean).join(",") : "";
  return v == null ? "" : String(v);
}

module.exports = { Store, SCHEMA, JOB_FIELDS, jobRowToJson, toColumn };
