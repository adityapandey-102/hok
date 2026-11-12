/**
 * Every fact the public site shows, in one place: edit text here and the home,
 * about, services and contact pages, the header and the footer all follow.
 * Source: the user's "HOK website changes" PDF (2026-11-11), docs/specs/site-content-1.md.
 */

export const COMPANY = {
  name: "HOK",
  longName: "House of Khalak",
  tagline: "AI-Powered Marketing for Brands",
  intro:
    "HOK is a next-generation AI marketing agency focused on helping brands grow through intelligent strategy, creative storytelling, automation, and performance-driven digital marketing solutions. We combine human creativity with the power of artificial intelligence to deliver smarter campaigns, faster execution, and measurable business results.",
  intro2:
    "At HOK, we work with businesses across hospitality, retail, startups, and service industries to build strong digital presence, increase customer engagement, and drive sustainable growth. Our approach blends data, design, automation, and content to create impactful marketing experiences tailored to each client's goals.",
} as const;

export const FOUNDER = {
  name: "Nida Fathima",
  role: "Founder",
  instagram: "https://www.instagram.com/nidafathima_socials/",
  photo: "/site/assets/img/about/nida-fathima.webp",
} as const;

export const SOCIALS = {
  instagram: "https://www.instagram.com/hok.co_/",
  linkedin: "https://www.linkedin.com/company/houseofkhalak/",
} as const;

export const CONTACT = {
  phone: "+91 821-7629841",
  email: "houseofkhalaq@gmail.com",
  // placeholder: replace with the real value
  address: "Bengaluru, Karnataka, India",
  // placeholder: replace with the real value
  hours: "Mon–Sat, 10:00–19:00",
} as const;

/** `tel:` link for the phone number (digits and a leading +). */
export const PHONE_HREF = `tel:${CONTACT.phone.replace(/[^\d+]/g, "")}`;
/** WhatsApp chat link for the same number (digits only, no +). */
export const WHATSAPP_HREF = `https://wa.me/${CONTACT.phone.replace(/\D/g, "")}`;

/** Where HOK works: said on every page. */
export const MARKETS = "India, the GCC and international markets";
/** The short form (footer, contact panel, hero chip). */
export const MARKETS_SHORT = "India · GCC · International";
/** The sentence added to the About, Services and Contact intros. */
export const MARKETS_SENTENCE = `We work with brands across ${MARKETS}.`;

export type Client = { name: string; href: string };

export const CLIENTS: readonly Client[] = [
  { name: "Needle Eye", href: "https://www.instagram.com/needleeye_bangalore/" },
  { name: "Maya Medi Spa", href: "https://www.instagram.com/mayamedispaindia/" },
  { name: "Kirpa Properties", href: "https://www.instagram.com/kirpa.properties/" },
  { name: "Prep'd", href: "https://www.instagram.com/prepdby/" },
  { name: "Fix My Curls", href: "https://www.instagram.com/anshiq/" },
  { name: "Skin Studio by Ras", href: "https://www.instagram.com/skinstudiobyras/" },
  { name: "Candles Brewhouse", href: "https://www.instagram.com/candlesbrewhouse/" },
  { name: "Founders Brewery", href: "https://www.instagram.com/thefoundersbrewery/" },
  { name: "Yaana Living", href: "https://www.yaanaliving.com/" },
  { name: "Aura", href: "https://www.auraluxurypg.com/" },
];

/** The logo strip: files in /site/assets/img/clients. */
export const CLIENT_LOGOS: readonly { name: string; file: string }[] = [
  { name: "Needle Eye", file: "needle-eye" },
  { name: "Maya Medi Spa", file: "maya-medi-spa" },
  { name: "Delight Eatery", file: "delight-eatery" },
  { name: "Delight Hospitality", file: "delight-hospitality" },
  { name: "Ryan Group", file: "ryan-group" },
  { name: "Prehab", file: "prehab" },
  { name: "Krishna Home Studio", file: "krishna-home-studio" },
];

export const logoSrc = (file: string) => `/site/assets/img/clients/${file}.webp`;

/**
 * The stock photos, in /site/assets/img/stock (1600-1920 px). All Unsplash License (free, no attribution required).
 * Unsplash IDs: CdTQI-Nh7J4, UtIr_UaiDmg, FjtWczJWRlc, aAZMEpZVgo4, VnhCfo8Fkes, iuOjmlOu88o, ycExgCMRggc.
 * studio = Behind The Work band (home); team = About team; contact = Contact page; svc = one per service group, in SERVICE_GROUPS order.
 */
export const STOCK = {
  studio: "/site/assets/img/stock/studio-production.webp",
  team: "/site/assets/img/stock/team-whiteboard.webp",
  contact: "/site/assets/img/stock/contact-cafe.webp",
  svc: [
    "/site/assets/img/stock/svc-strategy.webp",
    "/site/assets/img/stock/svc-ai-dev.webp",
    "/site/assets/img/stock/svc-startup.webp",
    "/site/assets/img/stock/svc-creative.webp",
  ],
} as const;

export type ServiceItem = { title: string; blurb: string };

/** The ten services: a crisp one-line description each. */
export const SERVICE_ITEMS: readonly ServiceItem[] = [
  { title: "AI-Powered Marketing Strategy", blurb: "A data-led plan that turns your goals into campaigns that perform." },
  { title: "Social Media Management", blurb: "Planning, posting and community care that keep your brand present." },
  { title: "Performance Marketing", blurb: "Paid campaigns tuned every week for lower costs and more results." },
  { title: "Content Creation & Branding", blurb: "Reels, photos and copy that give your brand a voice people recall." },
  { title: "AI Automation Solutions", blurb: "Smart workflows that take repetitive marketing tasks off your plate." },
  { title: "Lead Generation Campaigns", blurb: "Targeted campaigns that bring in enquiries from serious buyers." },
  { title: "Website & Landing Page Development", blurb: "Fast, clean pages built to turn visitors into customers." },
  { title: "Creative Design & Visual Branding", blurb: "Logos, layouts and visuals that look sharp on every screen." },
  { title: "Hospitality & Transit Hotel Marketing", blurb: "Bookings and footfall for hotels, stays, cafes and restaurants." },
  { title: "SEO / GEO / AEO", blurb: "Be found on Google, in AI answers and wherever your buyers search." },
];

export const SERVICES: readonly string[] = SERVICE_ITEMS.map((s) => s.title);

/** The four groups the home and services accordions show; every one of the ten services sits in exactly one. */
export const SERVICE_GROUPS: readonly { title: string; text: string; short: string; items: readonly string[] }[] = [
  {
    title: "Digital Marketing & Growth",
    text: "Driving measurable results through strategy, performance and engagement.",
    short: "Measurable growth through strategy, ads and engagement.",
    items: ["Social Media Management", "Performance Marketing", "Lead Generation Campaigns", "SEO / GEO / AEO"],
  },
  {
    title: "App Development & Agentic Platform",
    text: "Smart automation and fast, clean web pages built to turn visitors into customers.",
    short: "Automation and fast web pages that convert visitors.",
    items: ["AI Automation Solutions", "Website & Landing Page Development"],
  },
  {
    title: "Startup Acceleration & Consulting",
    text: "Strategy-led marketing that helps startups, hotels and growing businesses launch stronger.",
    short: "Strategy-led launches for startups and growing brands.",
    items: ["AI-Powered Marketing Strategy", "Hospitality & Transit Hotel Marketing"],
  },
  {
    title: "Creative & Visual Design",
    text: "Content, design and visuals that give your brand a voice people remember.",
    short: "Content, design and visuals your brand is known by.",
    items: ["Content Creation & Branding", "Creative Design & Visual Branding"],
  },
];

export const PROCESS: readonly { title: string; text: string }[] = [
  { title: "Discover", text: "Understanding business goals and target audience" },
  { title: "Strategise", text: "Building data-driven marketing strategies" },
  { title: "Create", text: "Creating high-converting content and campaigns" },
  { title: "Automate", text: "Automating repetitive workflows for efficiency" },
  { title: "Optimise", text: "Continuously optimizing performance and growth" },
];

export type WorkItem = {
  client: string;
  category: string;
  /** Poster image, 9:16 preferred (object-fit: cover). */
  poster: string;
  /** Instagram reel ID: the card opens https://www.instagram.com/reel/<id>/ in a new tab. */
  reelId: string;
  /** Optional mp4 path. When set the card plays it muted on hover/in view and click opens a lightbox with sound. */
  video?: string;
};

export const reelUrl = (id: string) => `https://www.instagram.com/reel/${id}/`;

export const WORK: readonly WorkItem[] = [
  { client: "Maya Medi Spa", category: "Spa & Wellness", poster: "/site/assets/img/work/maya-medi-spa.webp", reelId: "DfG5eo7Bj4F" },
  { client: "Needle Eye", category: "Fashion & Couture", poster: "/site/assets/img/work/needle-eye.webp", reelId: "DCuEJfqBouW" },
  { client: "Delight Eatery", category: "Food & Hospitality", poster: "/site/assets/img/work/delight-eatery.webp", reelId: "DfjXjISTZSk" },
  { client: "Delight Stays", category: "Hospitality", poster: "/site/assets/img/work/delight-stays.webp", reelId: "DetjP3qM-aY" },
];

export type Testimonial = { quote: string; name: string; role?: string; brand: string; logo?: string };

// placeholder: user-approved sample testimonials; replace with real client quotes
export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "HOK understood our craft from day one. Our Instagram finally looks like our boutique feels, and the enquiries show it.",
    name: "Sakina Ahmed",
    role: "Founder, Needle Eye",
    brand: "Needle Eye",
    logo: "needle-eye",
  },
  {
    quote:
      "From reels to ads, everything is planned, approved and posted on time. Bookings from Instagram have clearly gone up.",
    name: "Team Maya Medi Spa",
    brand: "Maya Medi Spa",
    logo: "maya-medi-spa",
  },
  {
    quote:
      "Professional, quick and full of ideas. The lead campaigns HOK ran for our projects brought in serious buyers, not just clicks.",
    name: "Team Kirpa Properties",
    brand: "Kirpa Properties",
  },
  {
    quote: "They gave our brewhouse a voice. Every launch night now sells out faster.",
    name: "Team Candles Brewhouse",
    brand: "Candles Brewhouse",
  },
];

/** Home hero: line 1 is the first headline line; line 2 is the italic part plus the outlined last word. */
export const HERO = {
  /** The lockup above the headline: the full name, then (on wider screens) where we are from. */
  name: "House of Khalak",
  est: "Est. Bengaluru",
  /** The market line under the hero buttons (desktop and tablet only: phones get the markets band below the hero). */
  markets: "Serving India, the GCC & international brands",
  line1: "AI-Powered",
  line2Italic: "Marketing for",
  line2Outline: "Brands",
  intro: "We blend human creativity with AI to build brands people remember.",
  /** The proof row under the hero buttons: three counters (the client count is the real list above). */
  proof: [
    { value: CLIENTS.length, suffix: "+", label: "brands served", short: "brands" },
    { value: 4, suffix: "", label: "core industries", short: "industries" },
    { value: 3, suffix: "", label: "markets: India, GCC, Intl", short: "markets" },
  ],
} as const;

/** The quote card on the founder's photo. */
export const FOUNDER_QUOTE = "Built by creators, for brands that want to grow.";

/** The About page's Team section: a wide photo caption, then six role cards (`icon` picks the line graphic in TeamIcons.tsx). */
export const TEAM = {
  caption: "Strategists, creators and builders, working as one team for every brand we take on.",
  roles: [
    {
      icon: "strategy",
      title: "Strategy & Account Leads",
      text: "Your single point of contact. They plan the calendar, set the goals and keep every launch on time.",
    },
    {
      icon: "social",
      title: "Social Media Managers",
      text: "Run your channels day to day: content plans, posting, community replies and monthly reports.",
    },
    {
      icon: "performance",
      title: "Performance Marketers",
      text: "Plan and optimise paid campaigns on Meta and Google so every rupee is tracked to results.",
    },
    {
      icon: "writer",
      title: "Content Writers",
      text: "Hooks, captions, scripts and website copy written in your brand's voice.",
    },
    {
      icon: "design",
      title: "Video Editors & Designers",
      text: "Turn raw footage and ideas into reels, ads and visuals people stop scrolling for.",
    },
    {
      icon: "build",
      title: "Developers & AI Builders",
      text: "Build websites, landing pages and the automations that save your team hours every week.",
    },
  ],
} as const;

/** "Why Brands Trust HOK" (Home and About): six capability items (`icon` picks the line graphic in TrustIcons.tsx). */
export const TRUST = {
  intro: "One in-house team, from first idea to final report.",
  items: [
    {
      icon: "house",
      title: "End-to-end, in-house",
      text: "Strategy, shoots, editing, ads, websites and AI automation, all under one roof. No hand-offs.",
    },
    {
      icon: "ai",
      title: "AI-powered workflows",
      text: "We use AI to research, plan and produce faster, so you get more content and quicker turnarounds.",
    },
    {
      icon: "industries",
      title: "Proven across industries",
      text: "Hospitality, fashion, wellness, real estate and startups: we know what makes each audience stop and act.",
    },
    {
      icon: "globe",
      title: "India, GCC & international",
      text: "Remote-first delivery for brands across India, the GCC and beyond, aligned to your time zone.",
    },
    {
      icon: "lead",
      title: "One dedicated lead",
      text: "A single account lead who owns your calendar, approvals and results, so nothing slips.",
    },
    {
      icon: "results",
      title: "Results you can see",
      text: "Clear monthly reports on reach, engagement and leads, with the next steps planned.",
    },
  ],
} as const;

/** The markets band on Home, after the logo strip. */
export const MARKETS_BAND = {
  gcc: "UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain",
  badges: ["India", "GCC", "International"],
} as const;

/** The one-sentence line under each section heading (muted, left-aligned with the heading). */
export const SECTION_INTROS = {
  process: "Five steps, from the first conversation to steady growth.",
  services: "Strategy, content, performance and automation, under one roof.",
  work: "A few recent reels from the brands we grow on Instagram.",
  clients: "From hospitality and wellness to fashion and real estate.",
} as const;

/** The editorial header at the top of the About, Services and Contact pages. */
export const PAGE_INTROS = {
  about: {
    title: "The Team Behind",
    em: "Your Growth",
    text: `Who we are, how we work, and the brands that trust us. ${MARKETS_SENTENCE}`,
  },
  services: {
    title: "Marketing That",
    em: "Moves Brands",
    text: `Ten ways we help brands grow, from strategy to automation. ${MARKETS_SENTENCE}`,
  },
  contact: {
    title: "Let’s Build Something",
    em: "Remarkable",
    text: `Tell us about your brand, and we’ll reply within one working day. ${MARKETS_SENTENCE}`,
  },
} as const;

export type PageIntro = (typeof PAGE_INTROS)[keyof typeof PAGE_INTROS];
