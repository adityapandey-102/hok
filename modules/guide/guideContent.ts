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
    summary: "The clients you own as Admin, and the tasks assigned to you, kept apart from the firm overview.",
    steps: ["Open “My clients” in the menu.", "See this week’s events, events by stage, client comments and your open tasks."],
  },
  {
    id: "clients",
    title: "Clients: add, edit, archive",
    topic: "Clients",
    pages: ["/app/clients"],
    keywords: ["client", "business", "add client", "new client", "archive", "owner", "reassign"],
    requires: "clients:read",
    summary: "Every business you work for. Managers see only the clients they own; the Admin sees all of them.",
    steps: [
      "Open “Clients” and press “New client”.",
      "Fill in the business name (required), contact details, services and the client’s time zone.",
      "Open a client to see its tabs: Overview, Events, Calendar, To-dos, Assets and Portal.",
      "To stop working with a client, open it and choose Archive. Archived clients stay readable, and their portal link stops working.",
    ],
    tips: ["Admins can move a client to another manager with “Reassign”. The new owner gets a notification."],
    problems: [
      { q: "I can't find a client.", a: "Managers only see their own clients. Ask the Admin who owns it, or search with Ctrl+K." },
      { q: "I can't edit a client.", a: "Archived clients are read-only. Unarchive it first (Admin or its owner)." },
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
    tips: ["The owner gets a reminder about 2 hours before an event starts."],
  },
  {
    id: "calendar",
    title: "Calendar",
    topic: "Calendar",
    pages: ["/app/calendar"],
    keywords: ["calendar", "month", "week", "list", "personal event", "schedule", "time zone", "google calendar", "subscribe", "ics", "outlook", "apple"],
    requires: "events:read",
    summary: "All your clients’ events and your own personal entries, in your time zone.",
    steps: [
      "Switch between Month, Week and List at the top.",
      "Click an empty day to add a client event or a personal entry on that day.",
      "Click an event to open it.",
      "To see it in Google Calendar: click “Add to Google Calendar”, then “Make my link”, then “Open Google Calendar” and confirm there.",
    ],
    tips: [
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
    id: "assets",
    title: "Asset links",
    topic: "Assets",
    pages: ["/app/assets"],
    keywords: ["asset", "link", "drive", "dropbox", "youtube", "photo", "video", "tag", "preview"],
    requires: "assets:read",
    summary: "A library of links (Drive, Dropbox, YouTube…) for each client, with a type, comment and tags. HOK stores links, never files.",
    steps: [
      "Open Assets (or a client’s Assets tab) and press “Add link”.",
      "Paste the link, give it a title and type, and add tags so it’s easy to find.",
      "Shortly after saving, HOK shows a preview (title and picture) when the page offers one.",
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
    keywords: ["task", "assign", "kanban", "board", "status", "editor", "due", "overdue", "blocked"],
    requires: "staff_tasks:read",
    summary: "Work the Admin assigns to one person. Everyone sees the tasks assigned to them; the Admin sees all.",
    steps: [
      "Admin: press “New task”, pick the person, add a due date and priority. Editor tasks also need the raw files link.",
      "Open a task to change its status (To do, In progress, Blocked, Done) and to comment.",
      "Admins can switch between List and Board view.",
    ],
    tips: ["The person gets a reminder about 2 hours before a task is due."],
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
    keywords: ["template", "stages", "workflow", "pipeline"],
    requires: "stage_templates:manage",
    summary: "The list of stages an event goes through, for example Brief → Shoot → Edit → Approval.",
    steps: ["Press “New template”, name it and add the stages in order.", "Managers pick a template when they create an event."],
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
    summary: "You may not have access to it: managers only see their own clients and tasks assigned to them.",
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
