# Portfolio site, round 9: SEO, AEO and GEO (plus the favicon)

Goal: make the public site easy to find and to quote, for search engines (SEO), answer boxes and voice answers (AEO), and AI assistants such as ChatGPT, Gemini, Perplexity and Claude (GEO).
- **Scope:** the public site `app/(site)/**` and `modules/site/**`, plus site-level files in `app/` (robots, sitemap, icons, llms.txt).
- **The staff app (`/app`) and the portal (`/p`)** are only set to **noindex**; their functionality is not touched.
- **Read first:** `node_modules/next/dist/docs/` (Next 16 metadata, `robots.ts`, `sitemap.ts`, the icon conventions). This Next version may differ from what you know.

## 0. Rules
- [site-content-1.md §0](site-content-1.md): no git writes, no new deps, don't start or kill servers (web on 3400), Edit tool only, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-seo-9-progress.md`.
- **No invented facts.** Use only `modules/site/content.ts` and this spec. No ratings, no review counts, no prices, no years founded.

## 1. Site URL
- `SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hok-six-amber.vercel.app"`, in `modules/site/seo.ts`. Document `NEXT_PUBLIC_SITE_URL` in `.env.example` (it's not a secret; the custom domain goes there later).
- Use it for `metadataBase`, canonicals, the sitemap, the robots sitemap line, JSON-LD URLs and `llms.txt`.

## 2. Favicon and app icons (already generated, so just wire them up)
- `app/icon.png` (512, the white "HOK" wordmark on a red rounded square) and `app/apple-icon.png` (180) are ready. Next serves them through the file conventions; make sure the site layout doesn't override them with old template icons. Grep `public/site` and `SiteDocument` for `<link rel="icon"` or `shortcut icon` pointing at template images, and remove those links.
- `public/icons/*` (the PWA icons) are regenerated too. Check that `app/manifest.ts` still points at them.
- e2e: `GET /icon.png` returns 200 and the home page `<head>` has an icon link to it.

## 3. Metadata (per page)
Use the Next metadata API in each site page, or `generateMetadata`. Titles are about 55 characters or fewer, descriptions about 155 or fewer. Use exactly:

| Page | title | description |
|---|---|---|
| `/` | HOK – AI-Powered Marketing Agency in Bengaluru \| House of Khalak | House of Khalak (HOK) is an AI-powered marketing agency in Bengaluru serving India, the GCC and international brands: social media, performance ads, content, websites and AI automation. |
| `/about` | About HOK – The Team Behind Your Growth | Meet House of Khalak: founded by Nida Fathima, an in-house team of strategists, creators, editors and developers growing brands across India and the GCC. |
| `/services` | Services – Social Media, Ads, Content, Web & AI \| HOK | Social media management, performance marketing, lead generation, SEO/GEO/AEO, content and branding, websites and AI automation for brands in India and the GCC. |
| `/contact` | Contact HOK – Start a Project | Call or WhatsApp +91 821-7629841, email houseofkhalaq@gmail.com or send a brief. We reply within one working day. |

- **Each page:** `alternates.canonical`, plus `openGraph` (type website, siteName "House of Khalak (HOK)", locale `en_IN`, url, title, description, an image) and `twitter` (`summary_large_image`).
- **OG image:** create `app/(site)/opengraph-image.tsx` with the Next `ImageResponse`, 1200×630:
  - a dark `#0d0d0d` background with a large faint red cube shape in CSS;
  - the "HOK" wordmark text, or the logo as an `<img>` if supported;
  - "AI-Powered Marketing for Brands" in big white text;
  - "Bengaluru · India · GCC · International" in a small muted line.
  
  One image for all pages is fine, or one per page if simple.
- `<html lang="en-IN">` on the site layout.
- `themeColor` `#0d0d0d`.
- `applicationName` "HOK".

## 4. Crawl control
- `app/robots.ts`:
  - Allow `/`, `/about`, `/services`, `/contact`.
  - Disallow `/app`, `/p/`, `/api`, `/auth`, `/login`, `/setup`, and the unlinked template pages (`/blog`, `/pricing`, `/team`, `/faq`, `/case-studies`, `/services/details` and any other unlinked template route you find).
  - **Explicitly allow** the AI and answer crawlers on the public pages: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `Bingbot`. Give each the same allow and disallow lists.
  - Add the sitemap line.
- `app/sitemap.ts`: the 4 public pages only, with `lastModified` (the build date), `changeFrequency` monthly, and priorities 1.0 / 0.8 / 0.9 / 0.7.
- **noindex:** add `robots: { index: false, follow: false }` metadata to the `app/(main)` layout (the staff app, sign-in and portal) and to each unlinked template page. This is metadata only; don't change their content.

## 5. Structured data (JSON-LD), the core of AEO and GEO
Create a `JsonLd` component that renders `<script type="application/ld+json">` with `JSON.stringify`. Escape `<` as `<`. The data is static from `content.ts`, never user input.
- **Site-wide** (in the site layout): one graph with:
  - **`Organization`** (also typed `ProfessionalService`):
    - name "House of Khalak", alternateName "HOK", url SITE_URL, logo `SITE_URL/hok-logo.png`, `image` (the OG image);
    - description = the company intro;
    - `founder`: Person "Nida Fathima" (sameAs her Instagram);
    - `sameAs` [Instagram, LinkedIn];
    - `email`, `telephone` (+918217629841);
    - `contactPoint` { contactType "sales", telephone, email, areaServed ["IN","AE","SA","QA","OM","KW","BH"], availableLanguage ["en","hi"] };
    - `address` { addressLocality "Bengaluru", addressRegion "Karnataka", addressCountry "IN" } (locality only, no street, since it's a placeholder);
    - `areaServed` [India, the 6 GCC countries as `Country`, "Worldwide"];
    - `knowsAbout` [the 10 service names];
    - `slogan` "AI-Powered Marketing for Brands".
  - **`WebSite`**: name, url, publisher → the Organization `@id`, inLanguage "en-IN".
  - Use `@id`s (`SITE_URL/#org`, `SITE_URL/#website`) so the pages reference them.
- **`/services`:** an `ItemList` of `Service` items (one per service item: name, description = its blurb, provider = `#org`, areaServed as above, serviceType = the group title).
- **`/about`:** `AboutPage` with `mainEntity` → `#org`. Plus a `Person` for Nida Fathima (jobTitle "Founder", worksFor `#org`, sameAs Instagram).
- **`/contact`:** `ContactPage` with `mainEntity` → `#org`.
- **Every inner page:** `BreadcrumbList` (Home → Page).
- **FAQ:** see §6. `FAQPage` JSON-LD **must match the visible FAQ text exactly**.
- e2e: each page's JSON-LD parses as valid JSON, and the home page contains `"@type":"Organization"` with the phone and email.

## 6. Visible FAQ (AEO): a real, honest section
- Add an **FAQ section on `/services`**, after the panels and before LET'S TALK. Use an accessible **disclosure list** (`<details>`/`<summary>`). The answers must also be in the HTML (not fetched) so crawlers read them. Style: hairline rows, the question in white 18px, the answer muted, and a small red "+" that rotates on open. It's the one place where expand/collapse is OK: FAQs are scanned by their questions.
- Also add a **compact FAQ on home** (the first 4 questions), right before the LET'S TALK band, with a "More questions" link to `/services#faq`.
- **The questions and answers, exactly:**
  1. **What does HOK do?** "House of Khalak (HOK) is an AI-powered marketing agency. We plan and run social media, performance ads, lead generation, SEO/GEO/AEO, content and branding, websites and landing pages, and AI automation, all with one in-house team."
  2. **Where is HOK based, and which markets do you serve?** "We're based in Bengaluru, India, and work with brands across India, the GCC (UAE, Saudi Arabia, Qatar, Oman, Kuwait and Bahrain) and international markets, remotely and aligned to your time zone."
  3. **Which industries do you work with?** "Mostly hospitality and food, fashion and boutiques, wellness and spas, real estate and startups, but our process works for any brand that wants to grow online."
  4. **How does HOK use AI?** "We use AI to research audiences, plan content, speed up production and automate repetitive work, so you get more output and faster turnarounds while our team keeps the strategy and creative quality high."
  5. **What does it cost?** "Every brand's goals are different, so we quote per project or as a monthly retainer after a short discovery call. Tell us what you need and we'll send a proposal."
  6. **How do we get started?** "Send us a brief through the contact form, call or WhatsApp +91 821-7629841, or email houseofkhalaq@gmail.com. We reply within one working day."
  7. **Do you work with brands outside India?** "Yes. A large part of our focus is the GCC and international brands; we work remotely, report monthly and schedule calls in your time zone."
- Put the FAQ data in `content.ts` as `FAQ`, used by both the UI and the JSON-LD.

## 7. GEO extras
- **`public/llms.txt`** (served at `/llms.txt`), the emerging convention that helps AI assistants summarise a site. A plain markdown file:
  - `# House of Khalak (HOK)`;
  - a one-paragraph summary;
  - `## Services` (the 10 services, each with its blurb);
  - `## Markets` (India, GCC, international);
  - `## Industries`;
  - `## Contact` (phone, email, Instagram, Bengaluru);
  - `## Pages` (the 4 URLs with one line each);
  - `## FAQ` (the same Q&As).
  
  Generate it from `content.ts` at build time through a route handler, `app/llms.txt/route.ts` returning `text/plain` (preferred, so it never goes stale), with `Cache-Control` public, 1 day.
- **Entity consistency:** the name "House of Khalak (HOK)", the phone format and the email appear identically in the footer, the contact page, JSON-LD and `llms.txt`.
- **Clear headings and facts in HTML:** one `<h1>` per page and a logical h2/h3 order. Check that the hero headline is the only h1 on home, and that inner pages use the intro heading as the h1.
- Every content image has a descriptive `alt` (the client logos "<Brand> logo", reel posters "<Brand> reel by HOK", the founder "Nida Fathima, founder of HOK"). Decorative SVGs get `aria-hidden`.

## 8. Performance and technical SEO
- Fonts: check the template's Google Fonts load uses `display=swap`. If it's an `@import` in the template CSS (which can't be edited), add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `fonts.gstatic.com` with `crossorigin` in the site head.
- The LCP element (the hero headline) must not be delayed by the preloader for crawlers or first paint: check the content is in the server HTML (not client-only). The preloader overlay must not hide text from the HTML.
- Every `<img>` below the fold has `loading="lazy"`, `decoding="async"` and width/height. The above-the-fold ones (logo) get `fetchpriority="high"`.
- No broken internal links: crawl the 4 pages and assert every same-origin `<a href>` returns 200 (e2e).

## 9. Checks
- lint, typecheck, test:unit, the build plus `check:bundle`.
- **e2e** (the whole `portfolio.spec.ts` file, plus a new `e2e/seo.spec.ts`):
  - each page's `<title>`, meta description and canonical;
  - OG tags present;
  - `GET /robots.txt` contains Disallow `/app` and the GPTBot allow;
  - `GET /sitemap.xml` lists the 4 URLs;
  - `GET /llms.txt` is 200 and text/plain, containing "House of Khalak";
  - the JSON-LD is valid on the 4 pages;
  - the FAQ is visible and matches the FAQPage JSON-LD;
  - `/app` login has the noindex meta;
  - `GET /icon.png` is 200;
  - one h1 per page;
  - no broken internal links.
- Report the counts.

## 10. Report (10 lines or fewer)
- the files changed;
- the checks with counts;
- deviations;
- anything undone, including anything that needs a custom domain or Google Search Console access (the user does those).
