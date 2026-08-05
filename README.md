# PressTrack — Print Shop Job Tracker

A job tracking system for a print shop: jobs move through the real production
stages, staff are assigned to them, customers are saved for reuse, and every
payment is tracked from advance to final settlement.

Built so the shop in Sri Lanka updates the jobs and the owner abroad can see
everything at a glance.

---

## ⚠️ This is a UI demo, not yet a working system

**Data is stored in each visitor's own browser (`localStorage`).** Nothing is
sent to a server and nothing is shared between people.

That means once this is hosted:

- The shop's entries are visible **only on the shop's own browser**.
- The owner opens the same URL and sees the **original sample data**, not the
  shop's work.
- Clearing browser data wipes everything.
- There are no user accounts — the Shop / Owner switch is a UI demonstration,
  not real access control.

It is exactly right for showing the owner how the system will look and work,
and for collecting his feedback before the real build. See
[What the real version needs](#what-the-real-version-needs) below.

---

## What's in it

**Jobs** — job name, customer, contact number, start date, deadline, assigned
staff, total cost, advance paid and its date, final payment and its date,
pending balance, handover date, current stage, and notes.

**Print stages**, grouped into four phases coloured after the process inks:

| Phase | Colour | Stages |
| --- | --- | --- |
| Prepress | Cyan | Design → Proof Approval → Pre-press / Plates |
| Press | Magenta | Printing → Lamination |
| Finishing | Yellow | Cutting → Binding / Finishing → Quality Check |
| Delivery | Key | Ready for Handover → Handed Over → Completed |

Plus **On Hold** and **Cancelled** for jobs that leave the normal flow.

**Customers** — saved and reusable. Pick one when adding a job and the company
and phone number fill in automatically.

**Team** — the people jobs can be assigned to. Each job takes one or two.

**Payments** — everything still owed, sorted by amount, flagging jobs already
handed over with money outstanding.

Pending balance is always calculated (`total − advance − final`), never typed.

---

## Deploying with Dokploy

### 1. Point the subdomain at the VPS

Add a DNS **A record** for your subdomain to the VPS IP address, and wait for it
to resolve before step 3.

### 2. Create the application

In Dokploy: **Create Application** → **Provider: GitHub** →
repository `KavinduGM/bookshop2`, branch `main`.

Set **Build Type** to **Dockerfile** and leave the path as `./Dockerfile`.

### 3. Add the domain

Under the application's **Domains** tab:

| Setting | Value |
| --- | --- |
| Host | your subdomain |
| Container port | `80` |
| HTTPS | on (Let's Encrypt) |

### 4. Deploy

Hit **Deploy**. Dokploy builds the image and routes traffic to it. Pushing to
`main` afterwards redeploys.

**Health check:** `GET /healthz` returns `200 ok`.

### Deploying via Compose instead

If you would rather use Dokploy's **Compose** type, `docker-compose.yml` is
included. Remove the `ports:` block first and attach the service to Dokploy's
Traefik network, otherwise port 8080 is published straight to the internet.

---

## Running it locally

With Docker:

```bash
docker compose up --build
```

Then open <http://localhost:8080>.

Without Docker — it is a single file with no dependencies, so just open
`index.html` in a browser.

---

## How it's built

| File | Purpose |
| --- | --- |
| `index.html` | The whole application — markup, styles and logic, no dependencies |
| `nginx.conf` | Serves the file, gzip, security headers, `/healthz` |
| `Dockerfile` | `nginx:1.27-alpine` + the two files above |
| `docker-compose.yml` | Local runs, and the Compose deploy option |

No build step, no `node_modules`, no framework. The image is a few megabytes and
starts instantly.

Everything is themed through CSS custom properties and follows the viewer's
light or dark mode.

### Resetting the sample data

The banner at the top of the page has a **Reset demo data** link that restores
the original sample jobs. Useful before showing someone the demo.

---

## What the real version needs

To make this a system the shop and the owner genuinely share:

1. **A database** — Postgres or MySQL, replacing `localStorage`.
2. **An API** — to read and write jobs, customers and staff.
3. **Login and roles** — real accounts, with the owner's read-only access
   enforced on the server rather than in the browser.
4. **Backups** — a nightly dump, kept off the VPS.

The screens and the data model in this demo carry over as-is; what gets added is
the storage and access layer underneath them.
