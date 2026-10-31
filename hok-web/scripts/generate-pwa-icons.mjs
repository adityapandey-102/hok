/**
 * Generates the PWA icons in public/icons/ from public/hok-logo.png --
 * `node scripts/generate-pwa-icons.mjs` (re-run after the logo changes).
 *
 * The logo is a wide red wordmark on white with generous margins, so the
 * margins are trimmed first, then each icon is a white square with the
 * wordmark centred across it. "maskable" icons keep the
 * wordmark inside the middle 60% so Android's round/squircle masks never cut
 * it. Drawn in headless Chromium (Playwright, already a dev dependency), so no
 * image library is needed.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOGO = join("public", "hok-logo.png");
const OUT = join("public", "icons");

/** [file, size in px, share of the width the wordmark may use] */
const ICONS = [
  ["icon-192.png", 192, 0.84],
  ["icon-512.png", 512, 0.84],
  ["maskable-512.png", 512, 0.6],
  ["apple-touch-icon.png", 180, 0.8],
];

mkdirSync(OUT, { recursive: true });
const logo = `data:image/png;base64,${readFileSync(LOGO).toString("base64")}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [file, size, share] of ICONS) {
    const png = await page.evaluate(
      async ([src, size, share]) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        // Trim the file's own white margins (any pixel that isn't near-white counts as ink).
        const probe = document.createElement("canvas");
        probe.width = img.naturalWidth;
        probe.height = img.naturalHeight;
        const pctx = probe.getContext("2d");
        pctx.drawImage(img, 0, 0);
        const { data } = pctx.getImageData(0, 0, probe.width, probe.height);
        let x0 = probe.width, y0 = probe.height, x1 = 0, y1 = 0;
        for (let y = 0; y < probe.height; y++) {
          for (let x = 0; x < probe.width; x++) {
            const k = (y * probe.width + x) * 4;
            const ink = data[k + 3] > 16 && (data[k] < 235 || data[k + 1] < 235 || data[k + 2] < 235);
            if (ink) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
        }
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        const w = size * share;
        const h = (w * ch) / cw;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, x0, y0, cw, ch, (size - w) / 2, (size - h) / 2, w, h);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      [logo, size, share],
    );
    writeFileSync(join(OUT, file), Buffer.from(png, "base64"));
    console.log(`wrote ${join(OUT, file)} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
