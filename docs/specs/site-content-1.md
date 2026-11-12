# Portfolio site, content round 1: real HOK content and a better page-load animation

Scope: **only the public portfolio** (`hok-web/app/(site)/**`, `hok-web/modules/site/**`, `hok-web/public/site/**` and the site e2e). The staff app (`/app`) and the portal (`/p`) are untouched.
**Keep the template's design:** same layouts, classes and styles. Only content changes, section removals and the preloader.
Source: the user's PDF "HOK website changes" (2026-11-11).

## 0. Rules
- [round-1.md §0](round-1.md) rules apply: no git writes, no Docker, don't start or kill servers (web dev on 3400), keep line endings, no new dependencies, Edit tool not sed.
- Don't touch `D:\Code Space\WorkSpace\buyer-file`.
- Progress file: `docs/specs/site-content-1-progress.md` (one line per finished part).
- Scratch folder: `C:\Users\progr\AppData\Local\Temp\claude\bf9e1ec3d3d58ea9\dd5fe6c6-e059-4547-84b6-389ff77939fe\scratchpad\site-1\`.
- Build: `NEXT_DIST_DIR=.next-site`. Back `tsconfig.json` up first and restore it byte-identical afterwards; delete `.next-site`.
- Put the facts in one place: create `modules/site/content.ts` with the company facts, clients, services, process, testimonials and contact. Pages import from it, so the user can edit text in one file later.

## 1. Facts (use exactly)

**Company:** HOK (House of Khalak), "AI-Powered Marketing for Brands".
- **Intro:** "HOK is a next-generation AI marketing agency focused on helping brands grow through intelligent strategy, creative storytelling, automation, and performance-driven digital marketing solutions. We combine human creativity with the power of artificial intelligence to deliver smarter campaigns, faster execution, and measurable business results."
- **Second paragraph:** "At HOK, we work with businesses across hospitality, retail, startups, and service industries to build strong digital presence, increase customer engagement, and drive sustainable growth. Our approach blends data, design, automation, and content to create impactful marketing experiences tailored to each client's goals."

**Founder:** Nida Fathima, Founder. Instagram: https://www.instagram.com/nidafathima_socials/. Photo: `/site/assets/img/about/nida-fathima.webp`.

**Socials:**
- Instagram: https://www.instagram.com/hok.co_/
- LinkedIn: https://www.linkedin.com/company/houseofkhalak/
- Remove Facebook, X/Twitter and YouTube icons. There are no real accounts for them.

**Contact (placeholders, user-approved "fake for now"):**
- phone `+91 98450 00000`
- email `hello@houseofkhalak.com`
- address "Bengaluru, Karnataka, India"
- hours "Mon–Sat, 10:00–19:00"

Mark each one in `content.ts` with `// placeholder: replace with the real value`.

**Clients** (name: link):
- Needle Eye: https://www.instagram.com/needleeye_bangalore/
- Maya Medi Spa: https://www.instagram.com/mayamedispaindia/
- Kirpa Properties: https://www.instagram.com/kirpa.properties/
- Prep'd: https://www.instagram.com/prepdby/
- Fix My Curls: https://www.instagram.com/anshiq/
- Skin Studio by Ras: https://www.instagram.com/skinstudiobyras/
- Candles Brewhouse: https://www.instagram.com/candlesbrewhouse/
- Founders Brewery: https://www.instagram.com/thefoundersbrewery/
- Yaana Living: https://www.yaanaliving.com/
- Aura: https://www.auraluxurypg.com/

**Logo strip** (`/site/assets/img/clients/*.webp`, already added):
- `needle-eye`
- `maya-medi-spa`
- `delight-eatery`
- `delight-hospitality`
- `ryan-group`
- `prehab`
- `krishna-home-studio`

**Services ("What We Do"):**
1. AI-Powered Marketing Strategy
2. Social Media Management
3. Performance Marketing
4. Content Creation & Branding
5. AI Automation Solutions
6. Lead Generation Campaigns
7. Website & Landing Page Development
8. Creative Design & Visual Branding
9. Hospitality & Transit Hotel Marketing
10. SEO / GEO / AEO

**Process:**
1. Understanding business goals and target audience
2. Building data-driven marketing strategies
3. Creating high-converting content and campaigns
4. Automating repetitive workflows for efficiency
5. Continuously optimizing performance and growth

**Testimonials** (user-approved placeholders; keep the template's testimonial design):
- "HOK understood our craft from day one. Our Instagram finally looks like our boutique feels, and the enquiries show it." Sakina Ahmed, Founder, Needle Eye.
- "From reels to ads, everything is planned, approved and posted on time. Bookings from Instagram have clearly gone up." Team Maya Medi Spa.
- "Professional, quick and full of ideas. The lead campaigns HOK ran for our projects brought in serious buyers, not just clicks." Team Kirpa Properties.
- "They gave our brewhouse a voice. Every launch night now sells out faster." Team Candles Brewhouse.

## 2. Changes

### Home (`app/(site)/page.tsx`)
1. **Hero:** keep the design. Swap in HOK copy: the headline "AI-Powered Marketing for Brands", the intro paragraph, and buttons to Contact and Services. Replace any template stats with honest ones, e.g. "10+ brands", "4 core industries". No invented years. If a stat can't be honest, remove that element.
2. **Logo carousel:** replace the dummy logos with the 7 client logos, in both copies of the loop. Use the brand name as alt text. Keep a consistent height. The logos are square, so constrain them, e.g. `height: 64px; width: auto; object-fit: contain`, through the existing classes or a small inline style.
3. **Remove** the "Our Journey of Growth & Innovation / Professional & Credibility-Focused" section entirely (`about-product`, the 688×485 image and the 2016/2019/2023 timeline).
4. **Services tabs:** rename "Web & App Development" to **"App Development & Agentic Platform"**. Make the 4 tabs real HOK services: Digital Marketing & Growth; App Development & Agentic Platform; Startup Acceleration & Consulting; Creative & Visual Design. Give each a one-line description from the facts.
5. **Text slider + case-study cards** (the "WEB & APP DEVELOPMENT / WEBSITE DEVELOPMENT" marquee and the two 690×550 cards):
   - Change the marquee words to "SOCIAL MEDIA MARKETING" (keeping the outline/italic alternation).
   - Replace the two cards with a horizontal sliding row of the 4 Instagram reels, using the template's existing slider (Swiper/owl, whatever `SiteScripts` loads). Each reel is an `<iframe src="https://www.instagram.com/reel/<ID>/embed" loading="lazy" allowfullscreen>` in a 9:16 box. The IDs are `DfG5eo7Bj4F`, `DCuEJfqBouW`, `DfjXjISTZSk` and `DetjP3qM-aY`.
   - Remove "Transforming Challenges into Opportunities" and "A Simple Social Media Marketing Checklist".
6. **Team section** (`team-version01`, made-up people): remove it from the home page. There's no real team data yet.
7. **Testimonials:** keep the section and its design; put in the 4 testimonials above.
8. Anything else on the home page with dummy content (blog teasers, pricing, fake counters): remove it, or fill it from the facts.

### About (`app/(site)/about/page.tsx`): the Kirpa Properties layout, in the template's styling
1. A page banner (the template's breadcrumb banner), titled "About HOK".
2. **Founder block:** two columns. On the left, Nida's photo (rounded, the same card style the template uses for images). On the right, an eyebrow "About us", the heading "Built on creativity, powered by AI", both intro paragraphs, a line "Founded by Nida Fathima" with her Instagram link, and a button "Work with us" linking to /contact.
3. A "What we do" grid of the 10 services, using an existing template card/list style.
4. An "Our process" section with the 5 steps, using an existing numbered/step style.
5. An "Our clients" section with the logo strip and the client list, each name linking out (`target="_blank" rel="noopener noreferrer"`).
6. Remove everything else that's dummy: fake team, fake stats, fake awards.

### Contact (`app/(site)/contact/page.tsx`): the Kirpa Properties layout
- A "Get in touch" section in two columns.
  - **Left:** heading, a short line ("Tell us about your brand and goals; we reply within one working day."), then phone, email, address and hours, each with an icon from the template, plus the Instagram and LinkedIn icons.
  - **Right:** the template's existing contact form (name, email, phone, message). Don't wire it to anything new; keep whatever it does today.
- Remove any map or dummy address blocks; there's no real address yet.

### Header, footer and navigation (`modules/site/components/*`)
- **Remove from the menus** Pricing, Blog, Team, FAQ and Case studies, including sub-menus and the footer link lists. Keep Home, About, Services and Contact.
- **Keep the page files**, but stop linking to them from anywhere. Grep the site for `href="/pricing"`, `/blog`, `/team`, `/faq` and `/case-studies` (about 115 links today) and remove or retarget each one.
- **Footer:** the intro line, Instagram and LinkedIn icons, contact details from `content.ts`, and "© <current year> HOK (House of Khalak). All rights reserved." Remove the dummy newsletter or gallery parts if they're fake.
- **Services page:** fill it from the 10 services, in the same card style.

### Page-load animation (`modules/site/components/Preloader.tsx` + its CSS)
The user dislikes the current curtain (spinner + "Loading" + 4 sliding panels). Replace it with a short, professional one:
- a plain background in the site's dark colour;
- the HOK logo fading and scaling in slightly (0.96 → 1), with a thin red progress line under it that fills;
- the whole overlay fades out fast once the page has loaded: about 300 ms. It must never hold the page for more than about 1.2 s in total, so use a safety timeout;
- show it **only on the first load of a session**: `sessionStorage`, wrapped in try/catch. Not on every navigation;
- `prefers-reduced-motion`: no animation, overlay removed immediately;
- check how `main.js` currently removes `#preloader`. Keep that hook working, or move the removal into the component cleanly. No layout shift after it hides.
- If the template's scroll-reveal animations (WOW/AOS) feel jerky, soften them site-wide: shorter distance, `ease-out`, about 600 ms. Don't remove them.

## 3. Checks
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, the build (as in §0), `npm run check:bundle`.
- `e2e/portfolio.spec.ts` (44 tests) checks site pages and links. Update it to the new content and navigation:
  - the removed pages are no longer linked;
  - the new About and Contact layouts render;
  - the reels iframes exist;
  - the logos have alt text.
  
  Then run it. One file; the login rate limit doesn't apply here.
- Screenshots at 390 and 1280 px of Home, About, Contact and Services. Look at them yourself: no horizontal scroll, nothing overlapping, images not stretched.

## 4. Report (15 lines or fewer)
- the files changed;
- the test counts;
- what you checked in the screenshots;
- anything that couldn't be honest and was removed;
- anything unfinished.
