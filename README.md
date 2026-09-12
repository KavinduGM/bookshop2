# Warnitha Printshop — Order Tracking System

A job tracking system for a print shop: jobs move through the real production
stages, staff are assigned to them, customers are saved for reuse, and every
payment is tracked from advance to final settlement.

Built so the shop in Sri Lanka updates the jobs and the owner abroad can see
everything at a glance.

---

## How it works

Records live in a **PostgreSQL database on your server**, not in the browser.
Everyone signs in to the same system, so a job booked in on the shop's phone is
visible to the admin anywhere in the world, on any device, straight away.

Each device checks for changes every few seconds while its screen is on, so an
open dashboard updates itself without being reloaded. A form that is part-way
through being filled in is never redrawn underneath the person typing.

---

## Two roles

Both roles sign in, and a session lasts 30 days on that device.

| Who | Address | Signs in with | Lands on |
| --- | --- | --- | --- |
| Shop staff | `https://your-subdomain/` | The shop password | The New Job form |
| Admin | `https://your-subdomain/admin` | Username and password | The Dashboard |

The admin door answers to both `/admin` and `/#admin`. Signing in tidies the
address back to `/`, so the admin link never lingers in the browser history of a
shared phone.

The plain address asks only for a password and shows no sign that an admin area
exists.

**Sign out** is in the sidebar, and in the ☰ menu on a phone — staff have no
sidebar there. It asks for confirmation, then ends the session on the server as
well as in the browser.

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

### Changing the passwords

Passwords are **not** in the code. They are environment variables set on the
server, hashed with scrypt before they are compared, and never written to the
database. To change one, edit it in Dokploy's Environment tab and redeploy.

| Variable | What it is |
| --- | --- |
| `STAFF_PASSWORD` | The one password the shop staff share |
| `ADMIN_PASSWORD` | The admin's password |
| `ADMIN_USERNAME` | Defaults to `Admin` |
| `SESSION_SECRET` | Signs the session cookies — generate once, then leave it alone |
| `DB_PASSWORD` | The database container's password |

Generate the session secret with:

```bash
openssl rand -hex 32
```

Changing `SESSION_SECRET` signs every device out, which is the quickest way to
lock out a lost phone.

### Access is enforced on the server

Every rule is checked by the server, not the browser:

- A staff session that sends a new job total is ignored — the amount is dropped
  before it reaches the database.
- Deleting anything, adding team members, recording final payments and erasing
  the system all return **403 Forbidden** to a staff session.
- Signed-out requests get **401** and never see a single record.

Sessions are signed HTTP-only cookies, so page scripts cannot read them, and
repeated wrong passwords from one address are slowed down.

## Starting fresh

The system ships **empty** — no sample jobs, customers or team. First run, as
admin:

1. **Team** → add the people who work on jobs.
2. **Customers** → add the regulars (one-off customers don't need saving —
   the job form has a Walk-in mode).
3. **Outsourcing** → add the places work gets sent to.

Jobs can be booked in from minute one; if nobody has been added to the team yet,
jobs simply save with no one assigned and can be assigned later.

Job numbers are described under [How it's built](#job-numbers).

---

## Putting it on a staff phone

The staff link opens straight into the job form, so the fastest setup is a home
screen shortcut:

**Android (Chrome)** — open the staff link → menu (⋮) → **Add to Home screen**.

It then opens like an app: tap the icon, the job form is already there. The
**☰ menu** at the top reaches Jobs, Customers and Outsourcing.

---

## What's in it

**Jobs** — job name, type of work, customer, contact number, start date,
handover date, assigned staff, total cost, advance paid and its date, final
payment and its date, pending balance, current stage, and notes.

### Finding a job

The Jobs page filters on three things at once, and staff have the same filters
as the admin:

| Filter | Choices |
| --- | --- |
| Responsible person | Anyone, each team member, or **Nobody assigned** |
| Type of work | Any type that appears on at least one job |
| Outsourcing | Everything, outsourced only, or in-house only |

They stack with the status tabs along the top, so "everything Ishara has on the
floor that went outside" is three taps. A **Clear filters** button appears
whenever any are on, and the count line underneath says how many jobs matched
out of the total.

The search box covers everything written on a job — name, job number, customer,
phone, type, stage, **the people assigned**, the remarks, and the outsourcer.

On a phone the filters sit behind a **Filters** button so the job list stays in
view; the button shows how many are active.

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

**Job card** — an A6 card printed for the floor, so the work goes to the
designer with its details attached. **Print card** appears on every job, and
straight after a job is saved.

It carries the job number (large, at the top), the customer and their number,
the job name and type, the start and handover dates, who it is assigned to, the
remarks, and — when relevant — who it has been outsourced to. There are
signature lines for *given by* and *received by*.

It deliberately carries **no prices**. Pricing is admin-only, and a card that
circulates on the shop floor is the wrong place for it.

Printing uses the browser's own print dialog (`@page size: A6`), so it works
from an Android phone as well as a PC — and "Save as PDF" is available there too
if a card needs to be sent rather than printed. A long remark simply flows onto
a second page rather than being cut off.

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

Add a DNS **A record** for the subdomain to your VPS address, and let it
resolve before adding the domain in Dokploy.

### 2. Create the application

**Create Application** → **Provider: GitHub** → `KavinduGM/bookshop2`, branch
`main` → Build Type **Docker Compose**, file `docker-compose.yml`.

### 3. Set the environment

Under **Environment**, using `.env.example` as the list:

```
DB_PASSWORD=<a long random string>
SESSION_SECRET=<openssl rand -hex 32>
STAFF_PASSWORD=<the shop's password>
ADMIN_PASSWORD=<your password>
ADMIN_USERNAME=Admin
```

### 4. Add the domain

Point it at the **app** service, container port **3000**, HTTPS on.

### 5. Deploy

The database creates its own tables on first start, so there is no migration
step. Pushing to `main` redeploys.

**Health check:** `GET /healthz` returns `200 ok`.

### Backups

The database lives in the `db-data` volume. Set up Dokploy's scheduled Postgres
backup against the `db` service — this is the one piece of housekeeping that
matters, because the records now exist in exactly one place.

To take one by hand:

```bash
docker compose exec db pg_dump -U warnitha warnitha > backup.sql
```

---

## Running it locally

With Docker:

```bash
cp .env.example .env
docker compose up --build
```

Then open <http://localhost:3000> (uncomment the `ports:` block first).

Without Docker, against a throwaway in-memory database — handy for trying
changes without installing PostgreSQL:

```bash
cd server && npm install && node test/devserver.js
```

That serves the whole system on <http://127.0.0.1:8971> with the shop password
`shop2026` and admin `Admin` / `Admin2026#`. Nothing is kept when it stops.

### Tests

```bash
cd server && npm test
```

41 checks covering the schema, sign-in, who may change money, job numbering
under simultaneous requests, and every admin-only route.

---

## How it's built

| File | Purpose |
| --- | --- |
| `index.html` | The whole front end — markup, styles and logic, no framework |
| `server/server.js` | API, sessions, access rules, and serving the page |
| `server/db.js` | Schema and every SQL query |
| `server/auth.js` | Password hashing and cookie signing |
| `server/test/api.test.js` | The test suite |
| `server/test/devserver.js` | Local run against an in-memory database |
| `Dockerfile` | Node 22 Alpine, runs as a non-root user |
| `docker-compose.yml` | The app and PostgreSQL together |

The front end is still one self-contained file with no framework and no fonts
or scripts fetched over the network, so it loads in well under a tenth of a
second. Long lists render 60 rows at a time behind a "Show more" button.

### Job numbers

Numbers are handed out **by the server**, inside the same transaction that
creates the job, so two people booking work at the same moment can never be
given the same number. The format is the date plus a counter that restarts each
morning:

```
260903001   ← 3 Sep 2026, first job of the day
260903002   ← 3 Sep 2026, second job
260904001   ← 4 Sep 2026, back to 1
```

The device sends its own local date, so the number always matches the shop's
day rather than the server's timezone.

## Still to consider

The system is complete and shared. Worth doing when you get a chance:

1. **Scheduled backups** — the records now live in one place. Turn on Dokploy's
   Postgres backup before the shop relies on it.
2. **Individual staff logins** — everyone currently shares one password, so a
   job records no author. Per-person accounts would show who booked what and
   let you remove one person without changing everyone's password.
3. **Password rotation** — change `STAFF_PASSWORD` whenever someone leaves.

---

## Erasing everything

**Team → Erase all data** clears every job, customer, outsourcing place and team
member from the database — on every device, not just the one in front of you.
It is admin-only, asks for confirmation, and cannot be undone. Use it once,
after training, to start the real records clean.
