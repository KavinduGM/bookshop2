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
| Prepress | Cyan | Design → Proof Approval |
| Press | Magenta | Printing |
| Finishing | Yellow | Laminating / Cutting / Binding → Quality Check |
| Delivery | Key | Ready for Handover → Handed Over → Completed |

Plus **On Hold** and **Cancelled** for jobs that leave the normal flow.

The stage is **optional**. A job can be booked in without one and stay at
"Stage not set" until someone decides where it starts — it still counts as being
on the floor, and the stage can be set from the job at any time.

**Customers** — two kinds, chosen with a switch on the job form:

- **Saved customer** — pick from the list; company and phone fill in
  automatically. For the regulars.
- **Walk-in** — just a name and a phone number, typed straight onto the job.
  Nothing is added to the customer list, so one-off customers don't clutter it.
  A tick box promotes a walk-in to a saved customer if they turn out to be a
  regular after all.

Both name and number are required for a walk-in — there is no other record of
them anywhere, so without a number the shop has no way to make contact.

**Team** — the people jobs can be assigned to. Each job takes one or two.

**Outsourcing** — a job can be marked as sent outside, for the work the shop
doesn't do itself: foiling, large format, binding, die-cutting. Outsourcing
places are saved like customers and picked from a dropdown, or typed in as a
one-off with the option to save them afterwards. Only the name is required;
company and phone are optional. Outsourced jobs are badged in the job list and
counted on the Outsourcing page.

**Payments** — everything still owed, sorted by amount, flagging jobs already
handed over with money outstanding.

Pending balance is always calculated (`total − advance − final`), never typed.

### Pages

Each page has its own address, so any of them can be bookmarked or linked to
directly:

| Page | Link |
| --- | --- |
| Dashboard | `/#dashboard` |
| Jobs | `/#jobs` |
| **New Job** | `/#new` |
| Payments | `/#payments` |
| Customers | `/#customers` |
| Outsourcing | `/#outsourcing` |
| Team | `/#team` |

**`/#new` is a page containing nothing but the job entry form.** Open it and you
can fill in a job and save it without touching the rest of the system — useful
as a phone shortcut or a link handed to someone who only ever needs to add jobs.
After saving it confirms and offers to add another, rather than navigating away.

It is hidden in Owner view, and opening the link directly in Owner view lands on
the Jobs page instead.

### On a phone

The layout is built for phones, not just shrunk to fit:

- The sidebar becomes a bottom tab bar of five thumb-sized targets. Customers,
  Outsourcing and Team sit behind **More**, since they're setup rather than
  daily use.
- Tables become stacked cards with labelled rows — an eight-column table is
  unreadable on a 390px screen.
- Fields are 16px so iOS doesn't zoom in every time one is tapped.
- Panels open full screen, and layouts respect notches and home indicators.

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
