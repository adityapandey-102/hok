import type { Capability } from "../../lib/domain";

/**
 * The "Guide me" help (REQUIREMENTS FR-HLP-01): one plain-language article per
 * feature or common problem. Static and small, so it ships with the app and is
 * searched in the browser. `requires` hides an article from roles that can't
 * use the feature (the same capability its page needs). `pages` are the app
 * paths the article belongs to: opening the guide there searches its topic.
 */
export interface GuideArticle {
  id: string;
  title: string;
  /** The page topic shown in the search box when the guide opens on that page. */
  topic: string;
  pages: string[];
  keywords: string[];
  requires?: Capability;
  /** One or two sentences: what it is and why you'd use it. */
  summary: string;
  steps: string[];
  tips?: string[];
  problems?: { q: string; a: string }[];
}

export const GUIDE: GuideArticle[] = [
  {
    id: "dashboard",
    title: "Your dashboard",
    topic: "Dashboard",
    pages: ["/app"],
    keywords: ["home", "overview", "numbers", "today", "start"],
    summary: "The first page after you sign in. It shows the numbers that matter for your role and short lists, each with a link to the full list.",
    steps: [
      "The dark band at the top holds your key numbers. Click any of them to open that list.",
      "Each panel shows up to five items. Use “View all” at the bottom of a panel to see everything.",
      "A number in red needs attention, for example overdue tasks or comments waiting for a reply.",
    ],
    tips: ["Admins see the whole firm here. Your own clients and tasks are under “My clients”."],
  },
  {
    id: "my-clients",
    title: "My clients (Admin)",
    topic: "My clients",
    pages: ["/app/my-clients"],
    keywords: ["own clients", "admin", "my work"],
    requires: "dashboard:global",
    summary: "The clients whose team you’re on as Admin, and the tasks assigned to you, kept apart from the firm overview.",
    steps: ["Open “My clients” in the menu.", "See this week’s events, events by stage, client comments and your open tasks."],
  },
  {
    id: "clients",
    title: "Clients: add, edit, archive",
    topic: "Clients",
    pages: ["/app/clients"],
    keywords: ["client", "business", "add client", "new client", "archive", "owner", "reassign", "team", "lead", "assign", "project manager"],
    requires: "clients:read",
    summary: "Every business HOK works for. Each client has a team, one of whom is the lead. Managers see only the clients whose team they're on; the Admin sees all of them.",
    steps: [
      "Open “Clients” and press “New client”.",
      "Fill in the business name (required), contact details, services and the client’s time zone.",
      "Open a client to see its tabs: Overview, Events, Calendar, To-dos, Assets and Portal.",
      "Admin: open a client and choose “Edit team” to add or remove people and pick the lead. People added get a notification.",
      "Admin: to stop working with a client, open it and choose Archive. Archived clients stay readable, and their portal link stops working.",
    ],
    tips: [
      "Everyone on the team can edit the client and its events, assets and to-dos, and gets its client comments and event reminders.",
      "Only the lead (or the Admin) can make or turn off the client’s portal link.",
      "Archiving, unarchiving and changing the team are for the Admin only.",
    ],
    problems: [
      { q: "I can't find a client.", a: "You only see clients whose team you're on. Ask the Admin to add you to its team, or search with Ctrl+K." },
      { q: "I can't edit a client.", a: "Archived clients are read-only. Only the Admin can unarchive it." },
    ],
  },
  {
    id: "events",
    title: "Events and stages",
    topic: "Events",
    pages: ["/app/events"],
    keywords: ["event", "shoot", "campaign", "meeting", "stage", "move stage", "postpone", "cancel", "template"],
    requires: "events:read",
    summary: "A shoot, campaign or meeting for a client. Each event moves through stages (from a stage template) so everyone knows where it stands.",
    steps: [
      "Open the client, go to the Events tab and press “New event”.",
      "Pick a stage template, give the event a title, type, start and end (in the client’s time zone).",
      "On the event page, use “Move stage” to go to the next stage. Add a note if you like.",
      "Tick “Visible to the client” to show that note on the client’s portal.",
      "Use Postpone or Cancel under “Manage event” when plans change.",
    ],
    tips: ["The client's team gets a reminder about 2 hours before an event starts."],
  },
  {
    id: "calendar",
    title: "Calendar",
    topic: "Calendar",
    pages: ["/app/calendar"],
    keywords: ["calendar", "month", "week", "list", "day", "task", "to-do", "personal event", "schedule", "time zone", "google calendar", "subscribe", "ics", "outlook", "apple"],
    requires: "staff_tasks:read",
    summary: "Everything dated for you in one place, in your time zone: your tasks and your own to-dos, plus, for managers, your clients’ events and personal entries. The Admin sees every client event and task in the agency.",
    steps: [
      "Switch between Month, Week and List at the top.",
      "In Month, each day shows how many events, tasks, to-dos and personal entries it has. Click a day to open it.",
      "The day window lists everything on that day. Tick a to-do there to finish it, or click a task or event to open it.",
      "Use the buttons at the bottom of the day window to add a to-do, and, if your role allows it, a task, an event or a personal entry on that day.",
      "Managers: to see it in Google Calendar, click “Add to Google Calendar”, then “Make my link”, then “Open Google Calendar” and confirm there.",
    ],
    tips: [
      "Tasks and to-dos sit at their due time. Ones without a due date don’t appear on the calendar.",
      "Your to-dos are private: nobody else sees them, even on the Admin’s calendar.",
      "Personal entries have a dashed outline; cancelled events are struck through.",
      "Your Google Calendar copy is read-only. Google checks for changes on its own schedule, usually within a day, so a change in HOK can take that long to show there. Make changes in HOK.",
      "Keep the calendar link private. If it leaks, make a new one: the old one stops working at once.",
    ],
    problems: [
      { q: "I lost my calendar link.", a: "It is shown only once. Click “Add to Google Calendar”, then “Make a new link”, and add the new one to Google." },
      { q: "Google Calendar shows nothing yet.", a: "Google can take up to a day to fetch a new calendar. It also can't reach a copy of HOK that runs only on your computer." },
    ],
  },
  {
    id: "todos",
    title: "Client to-dos",
    topic: "To-dos",
    pages: ["/app/clients"],
    keywords: ["to-do", "todo", "checklist", "client task", "reminder list"],
    requires: "clients:read",
    summary: "Your own checklist for one client, like “Get the product list” or “Book the studio”. Clients never see it.",
    steps: [
      "Open the client and go to the To-dos tab.",
      "Press “New to-do”, add a title, an optional due date, priority and event.",
      "Tick the box to mark it done. Find finished ones under “Done”.",
    ],
  },
  {
    id: "my-todos",
    title: "My to-dos",
    topic: "My to-dos",
    pages: ["/app/todos"],
    keywords: ["to-do", "todo", "personal", "private", "reminder", "urgent", "checklist", "note"],
    requires: "todos:manage",
    summary: "Your own private list of things to do, with a due time and an urgency. Nobody else sees it, not even the Admin.",
    steps: [
      "Open “To-dos” in the menu, type a title and press “Add”. “More” lets you add notes, a due date and time and the urgency.",
      "Tick the circle to finish a to-do. Switch between Open and Done at the top.",
      "Your next five open to-dos also show on your dashboard, and to-dos with a due time show on your calendar.",
    ],
    tips: [
      "Reminders follow the urgency: urgent 1 day before, 1 hour before and at the due time; high 1 hour before and at the due time; medium at the due time; low none.",
      "Reminders need a due time, and arrive in the bell and as a push if you allowed them in My profile.",
    ],
  },
  {
    id: "assets",
    title: "Asset links",
    topic: "Assets",
    pages: ["/app/assets"],
    keywords: ["asset", "link", "drive", "dropbox", "youtube", "photo", "video", "tag", "preview", "show to client", "client can see", "shared with you"],
    requires: "assets:read",
    summary: "A library of links (Drive, Dropbox, YouTube…) for each client, with a type, comment and tags. HOK stores links, never files.",
    steps: [
      "Open Assets (or a client’s Assets tab) and press “Add link”.",
      "Paste the link, give it a title and type, and add tags so it’s easy to find.",
      "Shortly after saving, HOK shows a preview (title and picture) when the page offers one.",
      "To let the client see a link, pick its event and switch on “Show to client”. It then appears under “Shared with you” on that event in their portal. Add an event stage to say where in the work it belongs. Links without it stay internal.",
    ],
    problems: [{ q: "No preview appears.", a: "Private links (like a Drive file only you can open) don't share a preview. The link still works." }],
  },
  {
    id: "portal",
    title: "Client portal link",
    topic: "Portal",
    pages: ["/app/clients"],
    keywords: ["portal", "share", "client link", "client view", "disable link"],
    requires: "portal:manage",
    summary: "A private web page for your client: their current event and its stage, upcoming events, calendar and a place to leave comments.",
    steps: [
      "Open the client and go to the Portal tab.",
      "Press “Generate link” and copy it. You only see it once, so share it straight away.",
      "To stop access, press “Disable”. “Regenerate” makes a new link and the old one stops working.",
    ],
    problems: [{ q: "My client says the link doesn't work.", a: "It may have been replaced, disabled, or the client archived. Generate a new link and send it again." }],
  },
  {
    id: "comments",
    title: "Client comments",
    topic: "Client comments",
    pages: ["/app/comments"],
    keywords: ["comment", "feedback", "reply", "inbox", "solved", "received"],
    requires: "comments:read",
    summary: "Comments clients leave on their portal arrive here, for the client’s manager.",
    steps: [
      "Open “Client comments”. New ones are marked Received.",
      "Open a comment, write a reply and set it to In progress or Solved.",
      "The client sees your reply and the status on their portal.",
    ],
  },
  {
    id: "tasks",
    title: "Staff tasks",
    topic: "Tasks",
    pages: ["/app/tasks"],
    keywords: ["task", "assign", "kanban", "board", "status", "editor", "due", "overdue", "blocked", "manager", "ladder", "given", "template", "stage", "brief", "link", "delivered", "complete", "reopen", "share"],
    requires: "staff_tasks:read",
    summary: "Work given to one person. Every task follows the stages of a task template, like an event. Everyone sees the tasks assigned to them. Assigning goes downwards: the Admin to anyone, a client manager to staff (agents, developers, editors, writers). The Admin sees every task.",
    steps: [
      "Admin and managers: press “New task”, pick the person (the list shows only people you may assign to), then the template (the stages the task will go through). Add a brief (a script or instructions), a due date, a priority and, if you like, links to raw files or references.",
      "Open a task to move it along: “Move to …” goes to the next stage, the stage menu jumps to any stage, and on the last stage “Mark complete” finishes it. A comment is optional.",
      "Stuck? The person doing the task presses “Mark blocked” and says why. The task shows a Blocked banner until someone presses “Unblock”.",
      "Links: the brief links hold the inputs (managers add them). The assignee adds what they delivered under “Delivered work”.",
      "To give the client a delivered link, open the task (it must be linked to an event) and press “Share with client” next to it. It then shows on that event in the client’s portal.",
      "Managers: use “Assigned to me”, “I assigned” and “My clients” at the top to focus. Admin and managers can switch between List and Board view.",
    ],
    tips: [
      "The person who gave a task (or the Admin) can edit, reassign, reopen (at any stage) or delete it. The stages are fixed once the task is created.",
      "The status (To do, In progress, Done) follows the stage, so you never set it by hand. Blocked is the one flag you raise yourself.",
      "A manager sees the tasks of their clients too, but only reads them unless they gave the task.",
      "The person gets a reminder about 2 hours before a task is due.",
    ],
  },
  {
    id: "approvals",
    title: "Approvals",
    topic: "Approvals",
    pages: ["/app/approvals"],
    keywords: ["approval", "approve", "approver", "sign off", "sign-off", "changes", "request changes", "locked", "client approval", "review"],
    requires: "staff_tasks:read",
    summary: "Some stages of a template need a yes before the work can move past them. A task or an event on such a stage shows a lock, and cannot go forward (or be completed) until someone who is allowed approves it.",
    steps: [
      "The person working on it presses “Request approval” on the task or event, with an optional note and a link to the work.",
      "Anyone allowed to approve that stage gets a notification. They open the request (from the bell, the dashboard or Approvals in the menu) and press “Approve”, or “Request changes” with a comment saying what to fix.",
      "Once approved, the work can move on. If changes were requested, move the work back, fix it, then request approval again.",
      "Approvals in the menu has two tabs: “To decide” (waiting for you) and “I requested”.",
    ],
    tips: [
      "Any one of the listed approvers is enough. You can not approve your own request (the Admin can).",
      "Moving the work back to an approval stage, or earlier, means that stage needs approving again.",
      "When the client is an approver (events only), they approve from their portal link, with the note and files you attached.",
      "The person who asked, or a manager, can cancel a waiting request.",
    ],
    problems: [
      { q: "The Move button is greyed out", a: "A stage ahead needs approval first. The reason is shown under the button (“Needs approval at …”). Request approval and wait for a yes." },
    ],
  },
  {
    id: "notifications",
    title: "Notifications and reminders",
    topic: "Notifications",
    pages: ["/app/notifications", "/app/profile"],
    keywords: ["notification", "bell", "push", "reminder", "alert", "mute"],
    summary: "The bell shows what needs you: new tasks, task updates, client comments, reassigned clients and reminders.",
    steps: [
      "Click the bell to see the latest. Click one to open it.",
      "When the bell swings with a red ring, a reminder is waiting (an event or task due in about 2 hours).",
      "In My profile, choose which notifications reach you in the bell and as phone or desktop pushes.",
    ],
    problems: [{ q: "I don't get push notifications.", a: "Allow notifications for this site in your browser. On iPhone, add HOK to the home screen first." }],
  },
  {
    id: "search",
    title: "Search everything",
    topic: "Search",
    pages: [],
    keywords: ["search", "find", "ctrl k", "look up"],
    summary: "One search box for clients, events, tasks, to-dos and asset links. You only see what your role allows.",
    steps: ["Click the search box at the top, or press Ctrl + K (⌘ + K on a Mac).", "Type at least two letters.", "Use the arrow keys and Enter, or click a result."],
  },
  {
    id: "team",
    title: "Team workload (Admin)",
    topic: "Team workload",
    pages: ["/app/team"],
    keywords: ["team", "workload", "staff", "busy", "last seen"],
    requires: "dashboard:global",
    summary: "Everyone’s open, overdue and recently finished tasks, busiest first, with when they last used HOK.",
    steps: ["Search by name or filter by role.", "Click a person to see their tasks."],
    tips: ["“Not seen in the last 45 days” means they haven’t used HOK for over 45 days."],
  },
  {
    id: "activity",
    title: "Daily activity (Admin)",
    topic: "Daily activity",
    pages: ["/app/activity"],
    keywords: ["activity", "history", "log", "who did what", "audit"],
    requires: "dashboard:global",
    summary: "A readable history of who did what: stage moves, task updates, client comments, sign-ins and more.",
    steps: ["Open Reports and choose the “Daily activity” tab.", "Pick a day or the last 7 days.", "Filter by kind (Clients, Events, Tasks…) or by person."],
  },
  {
    id: "reports",
    title: "Reports (Admin)",
    topic: "Reports",
    pages: ["/app/reports"],
    keywords: ["report", "team status", "staff report", "client report", "monthly", "performance"],
    requires: "dashboard:global",
    summary: "Team status right now, a monthly report per person and per client.",
    steps: [
      "Team status: who is working or idle, with last seen.",
      "Staff report: pick a person and a month to see tasks assigned, finished on time or late.",
      "Client report: pick a client and a month to see events, stage moves and comments answered.",
      "Daily activity: who did what, day by day.",
    ],
  },
  {
    id: "users",
    title: "Users and roles (Admin)",
    topic: "Users",
    pages: ["/app/admin/users"],
    keywords: ["user", "staff", "account", "role", "password", "deactivate", "invite"],
    requires: "users:manage",
    summary: "Create staff accounts, set roles, reset passwords and deactivate people who leave.",
    steps: [
      "Press “Add user”, enter the name, email and role. Share the generated password with them privately.",
      "Open a person to change their role, generate a new password or deactivate them.",
    ],
  },
  {
    id: "templates",
    title: "Stage templates (Admin)",
    topic: "Stage templates",
    pages: ["/app/templates"],
    keywords: ["template", "stages", "workflow", "pipeline", "approval", "approvers"],
    requires: "stage_templates:manage",
    summary: "The list of stages an event or a staff task goes through, for example Brief → Shoot → Edit → Approval.",
    steps: [
      "Use the Events | Tasks switch at the top to choose which kind of template you are making.",
      "Press “New template”, name it and add the stages in order.",
      "Task templates have a “For roles” choice, for example only Editors. Leave it empty and the template is offered for any role.",
      "Under a stage, switch on “Needs approval” and pick who can approve it: the Admin, the client’s team managers, any role, or (event templates only) the client. Work can not move past that stage until one of them approves.",
      "Managers pick an event template when they create an event, and a task template when they assign a task.",
    ],
  },
  {
    id: "profile",
    title: "My profile, password and look",
    topic: "My profile",
    pages: ["/app/profile"],
    keywords: ["profile", "password", "time zone", "dark mode", "theme", "phone"],
    summary: "Your name, phone, time zone, notification choices and password.",
    steps: [
      "Open My profile to update your details and time zone (all times are shown in it).",
      "Switch between light and dark with the sun/moon button at the top.",
    ],
  },
  {
    id: "problem-not-found",
    title: "A page says “not found”",
    topic: "Problems",
    pages: [],
    keywords: ["not found", "404", "missing", "can't open", "access"],
    summary: "You may not have access to it: managers only see the clients whose team they're on and the tasks assigned to them.",
    steps: ["Check with the Admin who owns that client or task.", "If a link came from a notification, the item may have been deleted or moved."],
  },
  {
    id: "problem-time",
    title: "Times look wrong",
    topic: "Problems",
    pages: [],
    keywords: ["time", "time zone", "wrong time", "date"],
    summary: "HOK shows times in your own time zone. Events are planned in the client’s time zone.",
    steps: ["Set your time zone in My profile.", "Check the client’s time zone on its Overview tab."],
  },
];

/** The guide topic for an app path: the article whose page matches most specifically. */
export function topicFor(pathname: string): string {
  const match = GUIDE.flatMap((a) => a.pages.map((p) => ({ p, topic: a.topic })))
    .filter(({ p }) => pathname === p || (p !== "/app" && pathname.startsWith(`${p}/`)))
    .sort((x, y) => y.p.length - x.p.length)[0];
  return match?.topic ?? "";
}

/** Articles matching every word of the query (title, topic, keywords, then text), best first. */
export function searchGuide(articles: GuideArticle[], query: string): GuideArticle[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return articles;
  const scored = articles.map((a) => {
    const head = `${a.title} ${a.topic}`.toLowerCase();
    const keys = a.keywords.join(" ").toLowerCase();
    const body = [a.summary, ...a.steps, ...(a.tips ?? []), ...(a.problems ?? []).flatMap((p) => [p.q, p.a])].join(" ").toLowerCase();
    let score = 0;
    for (const w of words) {
      const s = head.includes(w) ? 3 : keys.includes(w) ? 2 : body.includes(w) ? 1 : 0;
      if (s === 0) return { a, score: 0 };
      score += s;
    }
    return { a, score };
  });
  // The page's own article (its topic is exactly the query) comes first.
  const exact = query.trim().toLowerCase();
  for (const x of scored) if (x.score > 0 && x.a.topic.toLowerCase() === exact) x.score += 100;
  return scored.filter((x) => x.score > 0).sort((x, y) => y.score - x.score).map((x) => x.a);
}
