# HOK — Agency Operations Platform: Requirements Specification

| | |
|---|---|
| **Version** | 0.3 — portfolio website + needleye design system added (0.2: stakeholder answers incorporated) |
| **Date** | 2026-10-13 |
| **Status** | Requirements agreed in principle; architecture draft in [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Changes from 0.1** | Open questions answered (§10); Marketing Agent → tasks only; stage templates; editor task fields; multiple time zones; plain portal branding; assignee closes own task; client portal moved into Phase 1 |

---

## 1. Purpose & Background

The client is a **marketing firm** that grows its clients' businesses through marketing services (social media shoots, content, campaigns, development work, editing, etc.).

Today their operations — client events, shoot schedules, content locations, internal tasks and client feedback — are scattered. They need a single internal platform that lets them:

1. Manage a **portfolio of clients**, each owned by a specific manager.
2. Plan and track **client events** (e.g. social media shoots) on a **calendar**.
3. Keep a **link library of assets** (photos, videos, docs stored elsewhere) per client, with comments and tags, so nothing gets lost.
4. Give each client a **shareable portal link** where they can see their schedule and the progress of their current event, and **leave comments** that reach their manager instantly.
5. Let the admin **assign tasks** to any staff member and track their progress.

---

## 2. Scope

### In scope (v1)
- Staff authentication and role-based access
- Client portfolio management
- Admin-defined **stage templates**; client events with stages
- Client-specific task tracking
- Asset link library (links + comment + tags — **no file uploads**)
- Client calendar + personal calendar + admin global calendar
- Shareable client portal (dashboard, calendar, comments)
- Client comment/feedback tracking with statuses
- Admin → staff task assignment with status updates and comments (incl. editor-specific fields)
- Web push notifications (installable PWA) and in-app notifications
- Role-specific dashboards
- Multiple time zones
- **Public portfolio website** of the firm, served by the same web app (ported as-is from the existing HOK template; redesigned with real content later)

### Out of scope (v1)
- Uploading/hosting the actual media files (only links are stored)
- Posting/publishing to social media platforms
- Billing, invoicing, payments
- Analytics / ad performance reporting
- Native mobile apps (mobile-friendly installable website instead)
- Notifying the client by email/WhatsApp
- Showing asset links to clients on the portal
- Google Calendar sync / export (dropped for now, 2026-10-17)

---

## 3. User Roles

| # | Role | Type | Summary |
|---|------|------|---------|
| R1 | **Admin** | Internal | Full control. Sees all clients, users, events, tasks. Manages users and stage templates. Only role that assigns staff tasks. Can also own clients and do everything a Social Media Manager can. |
| R2 | **Social Media Manager (SMM)** | Internal | Owns a set of clients. Manages their events, client tasks, assets, calendar, portal link and comments. Has a personal calendar. Receives tasks from Admin. |
| R3 | **Marketing Manager** | Internal | Same capabilities as SMM. |
| R4 | **Marketing Agent** | Internal | **Task module only.** Receives tasks from Admin, updates status + comments. |
| R5 | **Developer** | Internal | **Task module only.** |
| R6 | **Editor** | Internal | **Task module only.** Editor tasks carry extra fields (raw files link, reference link, script — FR-TSK-10). |
| R7 | **Client** | External | No staff account. Accesses their own portal via a generated link. |

> **Terminology:** **"Client Manager"** = Admin, SMM or Marketing Manager — the roles that can own and manage clients. **"Task-only staff"** = Marketing Agent, Developer, Editor.

---

## 4. Permission Matrix

Legend: ✅ full · 👤 own records only · 👁 view only · ❌ no access

| Capability | Admin | SMM / Mkt Manager | Mkt Agent / Developer / Editor | Client (portal) |
|---|:-:|:-:|:-:|:-:|
| Manage staff users & roles | ✅ | ❌ | ❌ | ❌ |
| Manage stage templates | ✅ | ❌ (select only) | ❌ | ❌ |
| Create / edit client profiles | ✅ (all) | 👤 | ❌ | ❌ |
| View client profiles | ✅ (all) | 👤 | ❌ | 👁 own basic info |
| Reassign client to another manager | ✅ | ❌ | ❌ | ❌ |
| Client events (create/edit/stage) | ✅ (all) | 👤 | ❌ | 👁 own |
| Client-specific tasks | ✅ (all) | 👤 | ❌ | ❌ |
| Asset links | ✅ (all) | 👤 | ❌ | ❌ |
| Client calendar | ✅ (all) | 👤 | ❌ | 👁 own |
| Generate / revoke portal link | ✅ | 👤 | ❌ | ❌ |
| Post comments from portal | — | — | — | ✅ own |
| View / update client comment status | ✅ (all) | 👤 | ❌ | 👁 status of own comments |
| Personal calendar | ✅ | 👤 | ❌ | ❌ |
| Assign staff tasks | ✅ | ❌ | ❌ | ❌ |
| View / update assigned tasks | ✅ (all) | 👤 assigned to me | 👤 assigned to me | ❌ |
| Dashboard | ✅ global | 👤 | 👤 tasks only | 👁 own portal |

**Data isolation rule:** a Client Manager can **only** see clients they own (and everything attached to them). Other managers cannot see them. Admin sees all. A client has exactly **one** owner at a time.

---

## 5. Functional Requirements

Each requirement has an ID for review comments (e.g. "FR-EVT-04: change X").

### 5.1 Authentication & User Management (AUTH)

| ID | Requirement |
|---|---|
| FR-AUTH-01 | Staff log in with email + password. |
| FR-AUTH-02 | Admin creates staff accounts and assigns exactly one role (R1–R6). No public sign-up; the first Admin is created by a one-time bootstrap. |
| FR-AUTH-03 | Admin can edit, deactivate and reactivate staff accounts. Deactivated users cannot log in; their data is retained. |
| FR-AUTH-04 | Staff can reset their password (forgot-password flow). |
| FR-AUTH-05 | Staff can edit their own profile (name, photo URL, phone, **time zone**, notification preferences). |
| FR-AUTH-06 | The UI shows only the modules a user's role permits (task-only staff see only Tasks + Dashboard). |
| FR-AUTH-07 | Every API action is permission-checked server-side, not just hidden in the UI. |

### 5.2 Client Portfolio Management (CLI)

| ID | Requirement |
|---|---|
| FR-CLI-01 | A Client Manager can create a client profile. HOK owns every client; the creator becomes its **lead** and first **team** member. *(Teams decided 2026-10-23.)* |
| FR-CLI-02 | Client profile fields: business name, logo URL, industry, business email, address, **several websites**, **several phone numbers**, **several contact people** (name; mobile and email optional), **several social media accounts** (platform picked from a list: Instagram, Facebook, TikTok, YouTube, LinkedIn, X…; a platform may repeat), services subscribed, contract start/end date, **time zone** (searchable by city, country or offset), notes, status (Active / Paused / Archived). Every phone number is entered with a country code picker. *(Lists added 2026-10-22.)* |
| FR-CLI-03 | A Client Manager sees a list of **only the clients whose team they're on**, with search and filter (status, industry). Every team member can edit the client and everything under it. |
| FR-CLI-04 | Admin sees **all** clients, filterable by team member. |
| FR-CLI-05 | Admin sets each client's **team** (several Client Managers) and picks its **lead**; people added are notified. Only the Admin archives / unarchives clients and changes teams. Only the lead (or the Admin) creates or turns off the client's portal link. |
| FR-CLI-06 | Each client has a **client workspace** page with tabs: Overview · Events · Calendar · Tasks · Assets · Comments · Portal Link. |
| FR-CLI-07 | Clients can be archived (hidden from active lists, data retained, portal link disabled). |

### 5.3 Stage Templates & Client Events (EVT)

An **event** is a client-related activity such as a social media shoot, campaign launch, content day, meeting, etc. Its progress is tracked through **stages** that come from a **stage template**.

| ID | Requirement |
|---|---|
| FR-EVT-01 | **Admin** manages **stage templates**: a template has a name (e.g. "Photo Shoot", "Reel Production", "Campaign Launch") and an ordered list of stages (e.g. `Planned → Pre-production → Shoot → Editing → Client Review → Completed`). Admin can create, edit, reorder stages, and deactivate templates. |
| FR-EVT-02 | When creating an event, the Client Manager **selects a stage template**. The event uses that template's stages **as-is** — managers cannot add/remove/rename stages on an event. |
| FR-EVT-03 | Editing a template later does **not** change events already created from it (each event keeps the stages it started with). |
| FR-EVT-04 | Every event can additionally be marked **Cancelled** or **Postponed** regardless of template. |
| FR-EVT-05 | A Client Manager can create an event for one of their clients. Fields: title, type (Shoot / Campaign / Meeting / Content Posting / Other), start & end date-time **with time zone**, location (physical or online link), description, assigned team members (optional, informational), stage template, **current stage**. |
| FR-EVT-06 | Changing a stage records a **stage history** entry (who, when, optional note). The note can be marked "visible to client". |
| FR-EVT-07 | Events can be edited, rescheduled, or cancelled. |
| FR-EVT-08 | Assets (§5.5) and client tasks (§5.4) can be linked to an event. |
| FR-EVT-09 | Events appear automatically on the client's calendar, the owner's personal calendar, the Admin calendar and the client portal. |
| FR-EVT-10 | *(Phase 2)* Event reminder: notify the owner **2 hours before** the event starts (one reminder; user decision 2026-10-17). |

### 5.4 Client-Specific Tasks (CTSK) — Phase 2

To-dos a Client Manager tracks for a specific client (e.g. "Get product list from client", "Book studio").

| ID | Requirement |
|---|---|
| FR-CTSK-01 | A Client Manager can create tasks under a client, optionally linked to an event. |
| FR-CTSK-02 | Fields: title, description, due date, priority (Low / Medium / High / Urgent), status (To Do / In Progress / Done), linked event (optional). |
| FR-CTSK-03 | List view per client with filter by status/priority/due date; overdue tasks highlighted. |
| FR-CTSK-04 | Client tasks are internal and **never** shown on the client portal. |

> These are separate from **Staff Tasks** (§5.9), which the Admin assigns to people.

### 5.5 Asset Link Library (AST)

Purpose: never forget **where** content lives. The platform stores **links**, not files.

| ID | Requirement |
|---|---|
| FR-AST-01 | A Client Manager can add an asset to a client by pasting a **URL** (Google Drive, Dropbox, OneDrive, WeTransfer, Canva, Figma, YouTube, etc.). |
| FR-AST-02 | Asset fields: title, URL, type (Photo / Video / Document / Design / Audio / Other), **comment / description**, **tags** (free-form, multiple), linked event (optional), added by, added on. |
| FR-AST-03 | Tags are reusable and auto-suggested as you type. |
| FR-AST-04 | Asset list per client with **search** (title, comment, tag) and **filter** (type, tag, event, date). |
| FR-AST-05 | Clicking an asset opens the link in a new tab; a "copy link" button is available. |
| FR-AST-06 | Assets can be edited and deleted (soft-delete). |
| FR-AST-07 | Assets are **internal only** — never shown on the client portal in v1. |
| FR-AST-08 | *(Phase 2)* Show a link preview (thumbnail / page title) when available. |

### 5.6 Calendars (CAL)

| ID | Requirement |
|---|---|
| FR-CAL-01 | **Client calendar:** month / week / day / list views of all events for one client. |
| FR-CAL-02 | **Personal calendar:** each Client Manager has their own calendar showing (a) all events of all their clients and (b) their **own personal events** not tied to a client (e.g. internal meeting, planning session). |
| FR-CAL-03 | Personal events: title, start/end with time zone, description, optional client link. Visible only to the owner (and Admin). |
| FR-CAL-04 | Calendar items are colour-coded by client and/or event type, with filters (client, type, stage). |
| FR-CAL-05 | Create/edit an event directly from the calendar (click on a date/slot). |
| FR-CAL-06 | Admin has a **global calendar** with all events across the firm, filterable by manager and client. |
| FR-CAL-07 | Times are shown in the **viewer's** time zone; event details also show the event's own local time when it differs. |
| FR-CAL-08 | Subscribe link for Google Calendar / Apple / Outlook (ICS feed): one secret, revocable link per person with a calendar; shows the same items as their HOK calendar (last 30 days, next 6 months); read-only. *(Dropped on 2026-10-17, brought back on 2026-10-22.)* |

### 5.7 Client Portal (POR) — Phase 1

A read-mostly dashboard for the **client**, opened via a generated link.

| ID | Requirement |
|---|---|
| FR-POR-01 | A Client Manager can **generate** a unique, unguessable portal link for a client. |
| FR-POR-02 | The link can be **regenerated** (old link stops working) or **disabled** at any time. Links do not expire on their own. |
| FR-POR-03 | Access is **link only** — no PIN, no OTP, no client login. |
| FR-POR-04 | Portal shows the client's **dashboard**: business name/logo, the **current/active event and its stage** (visual progress tracker), **upcoming events**, and recent completed events. |
| FR-POR-05 | Portal shows the client's **calendar** (read-only) in the **client's time zone**. |
| FR-POR-06 | The client sees stage history notes that were marked "visible to client" (FR-EVT-06). |
| FR-POR-07 | The client **cannot** see internal tasks, internal notes, asset links, other clients, or staff data. |
| FR-POR-08 | Plain, neutral design — no firm or per-client branding beyond showing the client's own name/logo. |
| FR-POR-09 | Portal must be mobile-friendly (clients will mostly open it on phones). |

### 5.8 Client Comments / Feedback (CMT)

| ID | Requirement |
|---|---|
| FR-CMT-01 | From the portal, the client can post a **comment**, either general or on a specific event. |
| FR-CMT-02 | A new comment triggers a **push notification** and in-app notification to **everyone on the client's team**. Admin is not pushed unless on the team, but sees all comments in the app. |
| FR-CMT-03 | Each comment has a status: **Received → In Progress → Solved**. New comments start as *Received*. |
| FR-CMT-04 | The manager can change the status and add an optional **reply** to the client. |
| FR-CMT-05 | The client sees their comments with current status and replies on the portal (no email/WhatsApp notification to the client in v1). |
| FR-CMT-06 | Managers see an inbox of client comments across all their clients, filterable by client and status, with "Received" count badges. |
| FR-CMT-07 | Status changes are recorded (who, when). |
| FR-CMT-08 | Comment posting is rate-limited and size-limited (public, no-login endpoint). |

### 5.9 Staff Task Management (TSK)

Tasks the **Admin** assigns to staff — the **only** module available to Marketing Agents, Developers and Editors (besides their dashboard).

| ID | Requirement |
|---|---|
| FR-TSK-01 | **Only Admin** can create a task and assign it to **exactly one** staff member of any role. |
| FR-TSK-02 | Common fields: title, description, assignee, due date, priority, optional related client/event, optional reference links, status. |
| FR-TSK-03 | Statuses: **To Do → In Progress → Done**, plus **Blocked**. |
| FR-TSK-04 | The **assignee** updates the status — **including marking it Done** — and can add a comment with each update. All updates form a timeline on the task. |
| FR-TSK-05 | Admin can reopen a Done task, edit, reassign or delete tasks. |
| FR-TSK-06 | Admin and assignee can comment on the task at any time (discussion thread). |
| FR-TSK-07 | Assignee is notified when a task is assigned; Admin is notified when status changes or a comment is added. |
| FR-TSK-08 | Assignee sees "My Tasks" (filter: status, priority, due date; overdue highlighted). |
| FR-TSK-09 | Admin sees all tasks, filterable by assignee, role, status, due date. Board (Kanban) and list views. |
| FR-TSK-10 | **Editor tasks** additionally carry: **Raw files link** (Google Drive), **Reference edit link** (example of the desired style), and **Script** (text). These fields appear when the assignee is an Editor. |
| FR-TSK-11 | *(Phase 2)* Due-date reminder: notify the assignee **2 hours before** the task is due. |

### 5.10 Notifications (NTF)

| ID | Requirement |
|---|---|
| FR-NTF-01 | **Web push notifications** via the installable website (PWA) on desktop and phones. |
| FR-NTF-02 | **In-app notification centre** (bell icon) with read/unread state. |
| FR-NTF-03 | Triggers: new client comment (owner) · task assigned (assignee) · task status changed/commented (Admin / assignee) · client reassigned to me · *(Phase 2)* event and due-date reminders. |
| FR-NTF-04 | Users can manage notification preferences per trigger and per device. |
| FR-NTF-05 | **No email notifications at all**: only web push and the in-app bell (user decision, 2026-10-15). |
| FR-NTF-06 | *(Phase 2)* When a reminder arrives, the bell icon plays a short waving/alert animation and keeps an attention dot until it is opened (respecting reduced motion). |
| FR-NTF-07 | *(Phase 2)* Reminders are found by a background check **every 10 minutes**, so one may arrive up to 10 minutes after its time (≈ 1 h 50 min – 2 h before). |

### 5.11 Dashboards (DSH)

| ID | Role | Widgets |
|---|---|---|
| FR-DSH-01 | **Admin** | Totals (clients, active events, open tasks, unresolved comments) · today's & this week's events across firm · tasks by status/assignee · overdue tasks · latest client comments · team workload · own clients' widgets (same as SMM). |
| FR-DSH-02 | **SMM / Marketing Manager** | My clients count · today's & upcoming events · events by stage · unresolved client comments · tasks assigned to me by Admin · mini calendar · *(Phase 2)* my client tasks due/overdue. |
| FR-DSH-03 | **Marketing Agent / Developer / Editor** | My tasks by status · due today / overdue · recent comments on my tasks. |
| FR-DSH-04 | **Client (portal)** | Current event + stage tracker · upcoming events · my comments & status. |

### 5.12 Public Portfolio Website (SITE)

**One website = portfolio + agency management.** The firm's public portfolio and the agency app are one web app.

| ID | Requirement |
|---|---|
| FR-SITE-01 | The public portfolio is served at the root URL (`/`, `/about`, `/services`, `/case-studies`, `/team`, `/blog`, `/pricing`, `/faq`, `/contact`) of the same web app as the staff app (`/app`) and the client portal (`/p/...`). |
| FR-SITE-02 | **Phase 1:** the existing HOK HTML template (`buyer-file`) is ported as-is: same pages, look, text and images. |
| FR-SITE-03 | A "Staff login" entry point is reachable from the portfolio (e.g. in the footer). |
| FR-SITE-04 | **Later phase:** redesign the portfolio with the firm's real content (services, case studies, team, blog) using the app's design system. |

### 5.13 Search, Activity Log, Last Seen & Reports (SYS / RPT) — Phase 2

| ID | Requirement |
|---|---|
| FR-SYS-01 | Global search (scoped by permission) across clients, events, assets, tasks. |
| FR-SYS-02 | Activity log of important changes (who did what, when) visible to Admin. |
| FR-SYS-03 | **Last seen**: record when each staff member last used HOK (any API call). Shown to the Admin on the team pages and reports as how long ago, in minutes, hours, days or weeks ("25 min ago", "3 hours ago", "2 days ago", "4 weeks ago"; no "active now"); anything older than **45 days**, or never, reads "Not seen in the last 45 days". Recorded on the person's own row (at most once every few minutes), so reading it never scans a log. |
| FR-HLP-01 | *(Phase 2, last milestone)* **Guide**: a "Guide me" button at the top of every staff page opens one global guide in a modal: a search box over every feature, how-to and common problem, with clear, structured, plain-language articles (what it is, who can use it, step by step, tips, common problems). Opened from a page, the search starts with that page's topic filled in (e.g. "Clients" on the clients page); the user can clear it and search anything. Role-aware: shows what the reader's role can do. |
| FR-RPT-01 | **Reports** (Admin), modelled on needleye's: one Reports page with tabs, each loading only when opened, every list searched and paged by the API. |
| FR-RPT-02 | **Team status**: who is working or idle right now (open tasks, recent activity) with last seen; search, role filter, paged. |
| FR-RPT-03 | **Staff report**: pick a person, then a month (last 6): tasks assigned, completed, on time vs late, average time to finish, and a weekly chart (assigned vs completed). |
| FR-RPT-04 | **Client report**: pick a client, then a month: events held and stage progress, client comments received and answered, average reply time. |
| FR-RPT-05 | **Daily activity**: what happened on each of the last 7 days, by kind (events & stages, tasks, client comments, sign-ins & accounts), 50 at a time. |

---

## 6. Key User Flows

**F1 — Onboard a client**
Manager logs in → Clients → New Client → fills profile → saved (manager = owner) → generates portal link → shares link with client (WhatsApp / email).

**F2 — Plan a shoot**
Manager opens client → Events → New Event → picks stage template "Photo Shoot", sets date, time zone, location → event appears on client calendar, manager calendar, Admin calendar and client portal.

**F3 — Track progress**
Shoot done → manager moves stage to *Editing* with client-visible note "Editing in progress, expect preview Friday" → client sees updated tracker on portal.

**F4 — Store content**
Files land in Google Drive → manager pastes Drive link as asset (type Video, tags `reel`, `diwali-campaign`, comment "Final cut v2") linked to the event → later found by searching the tag.

**F5 — Client feedback**
Client opens portal → comments on event "Please change background music" → manager receives push notification → sets *In Progress* → after fix replies "Updated" and sets *Solved* → client sees status on the portal.

**F6 — Admin assigns editing work**
Admin → Tasks → New Task → assignee: Editor → fills raw files Drive link, reference edit link and script → editor gets push → moves to *In Progress* with a comment → marks *Done* with a comment → Admin is notified (and can reopen if needed).

---

## 7. Data Entities (conceptual)

| Entity | Key relationships |
|---|---|
| User (profile) | has Role, time zone; owns many Clients; has many PersonalEvents; assigned many StaffTasks |
| Client | owned by one User; time zone; has many Events, ClientTasks, Assets, Comments; has one PortalLink |
| StageTemplate | name, active flag; has ordered StageTemplateStages |
| Event | belongs to Client; created from a StageTemplate; has its own copied ordered EventStages; current stage; start/end + time zone; has StageHistory |
| EventStageHistory | Event, from/to stage, note, client-visible flag, changed by, timestamp |
| ClientTask | belongs to Client (optional Event) |
| Asset | belongs to Client (optional Event); has many Tags |
| Tag | many-to-many with Asset |
| PersonalEvent | belongs to User (optional Client) |
| PortalLink | belongs to Client; token (stored hashed), active flag, created/revoked dates |
| ClientComment | belongs to Client (optional Event); status, replies, status history |
| StaffTask | assigned by Admin to one User; optional Client/Event; editor fields (raw files link, reference link, script); has TaskUpdates (status + comment) |
| Notification | belongs to User; type, payload, read flag |
| PushSubscription | belongs to User (one per device/browser) |
| ActivityLog | actor, action, entity, timestamp |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Platform | Responsive web application, mobile-first. Installable as a PWA (required for reliable push on phones; on iPhone the user must "Add to Home Screen"). |
| NFR-02 | Security | HTTPS everywhere; hashed passwords (via auth provider); RBAC enforced server-side; portal tokens long, random, stored hashed and revocable; rate limits on login and public portal endpoints. |
| NFR-03 | Privacy / isolation | Strict isolation between managers' client data (row-level scoping in the API). |
| NFR-04 | Performance | Pages load in < 2 s on normal 4G; every list paginated server-side; calendar handles 1,000+ events smoothly. |
| NFR-05 | Availability | Cloud-hosted, ~99.5% uptime, daily automated database backups. |
| NFR-06 | Scale | ~20–50 staff, ~100–500 clients in year one. Design must not block growth. |
| NFR-07 | Usability | Simple, clean UI; key actions (add asset, change stage, update task) in ≤ 3 clicks. |
| NFR-08 | Time zones | **Multiple time zones.** All instants stored in UTC; each user, client and event has an IANA time zone; times displayed in the viewer's zone. Interface language: English. |
| NFR-09 | Auditability | Status changes on events, comments and tasks are tracked with user + timestamp. |
| NFR-10 | Maintainability | Typed codebase, automated tests on permission rules, documented API (OpenAPI). |

---

## 9. Assumptions

1. Only Admin creates staff accounts — there is no public sign-up.
2. There may be more than one Admin account.
3. Clients never get a login account; the portal link is their access.
4. Assets are links only; the firm keeps files in its existing storage (Drive, etc.). Logos/photos are also URLs.
5. Admin's own clients behave exactly like any manager's clients.
6. Personal calendar events of managers are visible to Admin.
7. The editor "Script" field is free text (long text allowed); a link to a script doc can go in reference links.

---

## 10. Decisions (answered 2026-10-13)

| # | Question | Decision |
|---|---|---|
| D1 | Marketing Agent permissions | **Tasks only** (like Developer / Editor) |
| D2 | Shared client ownership | **No** — one owner; Admin can reassign |
| D3 | Portal protection | **Link only**, revocable, no expiry |
| D4 | Event stages | **Admin-made stage templates**; manager picks one when creating an event; stages used as-is |
| D5 | Assets on portal | **No** in v1 |
| D6 | Who is pushed on client comment | **Owning manager only** |
| D7 | Who assigns staff tasks | **Only Admin** |
| D8 | Task assignees / closing | **One assignee**; **assignee can mark Done** |
| D9 | Native app vs PWA | **Mobile-friendly installable website (PWA)** |
| D10 | Scale | **Medium**: ~20–50 staff, ~100–500 clients |
| D11 | Time zone / language | **Multiple time zones**, English |
| D12 | Notify client on updates | **Not in v1** |
| D13 | Portal branding | **Plain / no branding** |
| D14 | Google Calendar sync / export | **Dropped for now** (2026-10-17) |
| D15 | Client portal phase | **Phase 1 (MVP)** |
| D16 | Timeline | **No fixed deadline** — quality first |
| D17 | Editor task fields | Raw files link (Google Drive), reference edit link, script |
| D18 | Tech stack | **Same as the needleye-pilot project** — see ARCHITECTURE.md |
| D19 | Hosting | **Local machine first** (Supabase in Docker, like needleye). Production later: **Railway** (API), **Supabase** (database + auth + user management), **Vercel** (web) |
| D20 | GitHub | Account `adityapandey-102`, repos `hok-api` and `hok-web` |
| D21 | Design system | **Exactly needleye's design system** (tokens, fonts, components, motion, responsive rules) for the staff app and portal |
| D23 | Notifications | **Push + in-app bell only. No email of any kind** (2026-10-15) |
| D22 | Portfolio website | The `buyer-file` HOK template becomes the firm's **public portfolio** inside the same web app. Port as-is now; redesign with real data later |

---

## 11. Release Phasing

| Phase | Contents |
|---|---|
| **Phase 1 — MVP** | Portfolio website (template ported as-is) · Auth, users & roles · Client profiles · Stage templates & events · Calendars (client, personal, admin) · Asset link library · Staff tasks (incl. editor fields) · **Client portal + comments** · In-app + web push notifications (PWA) · Dashboards |
| **Phase 2** | Client to-do lists · Reminders (2 h before, checked every 10 min, bell animation) · Global search · Activity log · Last seen · Link previews · Reports (needleye-style) · **Guide me** (last) · Google Calendar subscribe link *(Phases 2 and 3 merged on 2026-10-17; the Google Calendar export was dropped then and added back on 2026-10-22)* |
| **Portfolio redesign** | When the firm's content is ready: rebuild the portfolio in the app's design system with real services, case studies, team and blog |

---

## 12. Glossary

| Term | Meaning |
|---|---|
| Client Manager | Admin, Social Media Manager, Marketing Manager or Project Manager |
| Task-only staff | Marketing Agent, Developer, Editor |
| Client | A business that the marketing firm serves |
| Stage template | Admin-defined ordered list of stages, picked when creating an event |
| Event | A scheduled client activity (shoot, campaign, meeting…) with a current stage |
| Asset | A saved link to content stored elsewhere, with comment and tags |
| Portal | Client-facing dashboard opened through a generated link |
| Client Task | Internal to-do for a client, managed by its manager |
| Staff Task | A task assigned by Admin to one staff member |
| Personal Event | A calendar entry of a manager not necessarily tied to a client |
