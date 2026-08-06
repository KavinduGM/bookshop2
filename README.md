# Warnitha Printshop — Order Tracking System

A job tracking system for a print shop: jobs move through the real production
stages, staff are assigned to them, customers are saved for reuse, and every
payment is tracked from advance to final settlement.

Built so the shop in Sri Lanka updates the jobs and the owner abroad can see
everything at a glance.

---

## ⚠️ Read this before handing over

**Every device keeps its own separate copy of the data.** Records are stored in
the browser (`localStorage`); nothing is sent to a server.

In practice that means:

- What the shop enters is visible **only on the shop's own device**.
- The admin opens the same address and sees **an empty system**, not the shop's
  work.
- Clearing browser data, or "clear site data", erases the records.
- The admin sign-in is checked in the browser, so it keeps staff out of screens
  they don't need but does not stop anyone who reads the page source.

This is complete and usable as a **single-device register** — one phone or one
counter PC — and as the finished picture of how the system works. It becomes a
shared system when the backend is added; see
[What the real version needs](#what-the-real-version-needs).

**Back up regularly** by exporting from the browser or keeping the records
elsewhere until then.

---

## Two roles

Staff need nothing: the plain address is already theirs and opens straight into
the job form. There is no sign-in and no sign of an admin area anywhere in what
they see.

| Who | Address | Lands on |
| --- | --- | --- |
| Shop staff | `https://your-subdomain/` | The New Job form |
| Admin | `https://your-subdomain/#admin` | Sign-in, then the Dashboard |

**Admin sign-in** is at `/#admin`. Once signed in, that phone or laptop stays
signed in until **Leave admin** in the sidebar. Credentials are set in
`index.html` — see below to change them.

### What each role can do

| | Staff | Admin |
| --- | :---: | :---: |
| Create jobs | ✅ | ✅ |
| Edit a job's details, stage, notes | ✅ | ✅ |
| Add customers and outsourcing places | ✅ | ✅ |
| Enter total + advance **when creating a job** | ✅ | ✅ |
| **Change any amount afterwards** | ❌ | ✅ |
| Record final payments | ❌ | ✅ |
| Record money paid to an outsourcer | ❌ | ✅ |
| Dashboard, Payments, Analytics, Team | ❌ | ✅ |
| Delete anything | ❌ | ✅ |

Staff typing an admin address get sent back to the job form.

### Changing the admin password

The password is **not** stored in the file. What is stored is a SHA-256 digest
of `username:password`, so the password itself never appears in the repository.

To change it, generate a new digest and replace `ADMIN_DIGEST` in `index.html`:

```bash
printf '%s' 'NewUser:NewPassword' | shasum -a 256
```

### ⚠️ What this sign-in is and isn't

The check runs **in the browser**. It keeps staff out of screens they don't need
— which is what it is for — but anyone who opens the page source can see how it
works and get past it. It is a door with a lock, not a wall.

Two consequences worth acting on:

- **Don't reuse this password anywhere else.** Treat it as public.
- The repository is public. Even hashed, a short or guessable password can be
  cracked offline — use a long one, or make the repository private.

Real protection needs accounts checked on a server, which arrives with the
backend (see [What the real version needs](#what-the-real-version-needs)).

---

## Starting fresh

The system ships **empty** — no sample jobs, customers or team. First run, as
admin:

1. **Team** → add the people who work on jobs.
2. **Customers** → add the regulars (one-off customers don't need saving —
   the job form has a Walk-in mode).
3. **Outsourcing** → add the places work gets sent to.

Jobs can be booked in from minute one; if nobody has been added to the team yet,
jobs simply save with no one assigned and can be assigned later.

Job numbers run `JOB-<year>-0001` upward and restart each January.

**Team → Erase all data** wipes everything on the device, for clearing out
practice entries after training.

---

## Putting it on a staff phone

The staff link opens straight into the job form, so the fastest setup is a home
screen shortcut:

**Android (Chrome)** — open the staff link → menu (⋮) → **Add to Home screen**.

It then opens like an app: tap the icon, the job form is already there. The
**☰ menu** at the top reaches Jobs, Customers and Outsourcing.

---

## What's in it

**Jobs** — job name, customer, contact number, start date, deadline, assigned
staff, total cost, advance paid and its date, final payment and its date,
pending balance, handover date, current stage, and notes.

**Print stages**, grouped into four phases. Phases are ordered, so they use a
single blue ramp — the deeper the blue, the further along the work is:

| Phase | Stages |
| --- | --- |
| Prepress | Design → Proof Approval |
| Press | Printing |
| Finishing | Laminating / Cutting / Binding → Quality Check |
| Delivery | Ready for Handover → Handed Over → Completed |

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

On an outsourced job the shop keeps only the difference between what the
customer pays and what the outsourcer charges, so the job also records:

- **Agreed cost to them** — what the outsourcer charges
- **Paid to them** and the date — admin only
- **Your commission** — always calculated (`job total − their cost`), never typed

Payments shows what is still owed out and the total commission earned.

**Payments** — everything still owed, sorted by amount, flagging jobs already
handed over with money outstanding.

**Analytics** — filterable by **Daily** (last 14 days), **Weekly** (last 12
weeks) or **Monthly** (last 12 months), showing:

- money received per period, as a bar chart, counted on the date each payment
  actually landed rather than the date the job started
- which kinds of work came in most, as a donut — top six types plus "Other"
- who handled the most jobs
- how many jobs were booked in per period, and where they stand now

Every job carries a **type of work** (business cards, banners, packaging and so
on), which is what the type breakdown counts.

Pending balance is always calculated (`total − advance − final`), never typed.

Saving a job always asks for confirmation first, showing the customer, the
deadline and the amounts — and reminding staff that the amounts are about to
become admin-only.

### Pages

Each page has its own address, so any of them can be bookmarked or linked to
directly:

| Page | Link |
| --- | --- |
| Dashboard *(admin)* | `/#dashboard` |
| Jobs | `/#jobs` |
| **New Job** | `/#new` |
| Payments *(admin)* | `/#payments` |
| Analytics *(admin)* | `/#analytics` |
| Customers | `/#customers` |
| Outsourcing | `/#outsourcing` |
| Team *(admin)* | `/#team` |

**`/#new` is a page containing nothing but the job entry form.** Open it and you
can fill in a job and save it without touching the rest of the system — useful
as a phone shortcut or a link handed to someone who only ever needs to add jobs.
After saving it confirms and offers to add another, rather than navigating away.

It is where staff land by default, which is the whole point of the phone
shortcut.

### On a phone

The layout is built for phones, not just shrunk to fit:

- **Staff** get a **☰ menu** at the top and no bottom bar — they land on the job
  form and only occasionally need the other three pages.
- **Admin** get a bottom tab bar of five thumb-sized targets, with Customers,
  Outsourcing and Team behind **More**, since those are setup rather than daily
  use.
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

Everything is themed through CSS custom properties. The palette is white and
blue to match Warnitha's branding, and the system stays white even on a phone
set to dark mode — there is deliberately no dark variant. The logo is embedded
as a data URI so the app stays a single file with no external requests.

Chart colours are a validated categorical palette — checked for colour-blind
separation and contrast in both light and dark mode, with every donut segment
also labelled in the legend so colour is never the only cue.

### Resetting the sample data

Signed in as admin, the banner at the top has a **Reset demo data** link that
restores the original sample jobs. Staff don't see it.

---

## Security and performance

**Served headers** (`nginx.conf`): a Content-Security-Policy of
`default-src 'none'` — the app makes no network requests at all, so everything
external is blocked outright — plus HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a
restrictive `Permissions-Policy`.

**In the page**: every value rendered is HTML-escaped, so a customer name
containing markup is shown as text and never executed. Field lengths are capped
so a pasted document can't fill the browser's storage quota. If a save ever
fails — private mode, full storage — it says so loudly instead of losing the
work silently.

**Speed**: one file, no framework, no fonts or scripts fetched over the network.
Loads in well under a tenth of a second. Long lists render 60 rows at a time
with a "Show more" button, and search is debounced, so a register with hundreds
of jobs stays responsive on a cheap Android phone.

---

## What the real version needs

To make this a system the shop and the owner genuinely share:

1. **A database** — Postgres or MySQL, replacing `localStorage`.
2. **An API** — to read and write jobs, customers and staff.
3. **Login and roles** — real accounts checked on the server, so the admin
   password isn't in the page and payment fields can't be reached by editing it.
4. **Backups** — a nightly dump, kept off the VPS.

Until then the records live on one device, so treat that device as the system
of record and keep a copy elsewhere.

The screens and the data model in this demo carry over as-is; what gets added is
the storage and access layer underneath them.
