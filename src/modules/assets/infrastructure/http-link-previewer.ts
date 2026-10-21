import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { and, eq } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { logger } from "../../../common/logger/logger";
import { isFetchableUrl, isPublicAddress, parseLinkPreview, type LinkPreview } from "../domain/link-preview.rules";
import type { LinkPreviewerPort } from "../application/ports/link-previewer.port";
import { assets } from "./assets.schema";

/** Hard limits: a preview is a nicety, never worth slowing or exposing the server. */
const TIMEOUT_MS = 4_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "HOKLinkPreview/1.0";

/**
 * DNS lookup that refuses non-public answers AT CONNECT TIME (no gap between
 * "checked" and "connected", so DNS rebinding can't slip a private address
 * in). If any answer is non-public the whole lookup fails.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`Refusing non-public address for ${hostname}`), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
};

interface Fetched {
  status: number;
  location: string | null;
  html: string | null;
}

/** One GET, guarded: public addresses only, bounded time and size, HTML (or JSON, for oEmbed) only. */
function fetchOnce(url: URL, json = false): Promise<Fetched> {
  // A literal IP skips DNS (and so the guarded lookup): check it here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) return Promise.reject(new Error("Refusing non-public address"));
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method: "GET", lookup: guardedLookup, headers: { "User-Agent": USER_AGENT, Accept: json ? "application/json" : "text/html,application/xhtml+xml" }, timeout: TIMEOUT_MS },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location ?? null, html: null });
        }
        const type = String(res.headers["content-type"] ?? "");
        if (status !== 200 || !(json ? /json/i : /text\/html|application\/xhtml/i).test(type)) {
          res.resume();
          return resolve({ status, location: null, html: null });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // Enough to read the <head>; stop reading the rest of the page.
            chunks.push(chunk.subarray(0, Math.max(0, MAX_BYTES - (size - chunk.length))));
            req.destroy();
            resolve({ status, location: null, html: Buffer.concat(chunks).toString("utf8") });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, location: null, html: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    const overall = setTimeout(() => req.destroy(new Error("Link preview timed out")), TIMEOUT_MS);
    req.on("timeout", () => req.destroy(new Error("Link preview timed out")));
    req.on("error", reject);
    req.on("close", () => clearTimeout(overall));
    req.end();
  });
}

/** YouTube buries its preview tags deep in a huge page, but answers oEmbed (title + thumbnail) for any public video. */
const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be)$/i;

/** Follows up to MAX_REDIRECTS redirects, re-checking every hop; null when there's nothing to show. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview | null> {
  const page = isFetchableUrl(raw);
  const video = page && YOUTUBE.test(page.hostname);
  let url = video ? new URL(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page.href)}`) : page;
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchOnce(url, Boolean(video));
    if (res.location) {
      url = isFetchableUrl(new URL(res.location, url).href);
      continue;
    }
    if (!res.html) return null;
    if (!video) return parseLinkPreview(res.html, url.href);
    const data = JSON.parse(res.html) as { title?: string; author_name?: string; thumbnail_url?: string };
    const thumb = data.thumbnail_url && isFetchableUrl(data.thumbnail_url) ? data.thumbnail_url.slice(0, 2048) : null;
    return { title: data.title?.slice(0, 300) ?? null, description: data.author_name?.slice(0, 500) ?? null, imageUrl: thumb, siteName: "YouTube" };
  }
  return null;
}

/**
 * Fetches a saved link's preview in the background and stores it -- only if
 * the asset still has that URL (an edit meanwhile wins). Never throws: a
 * failure just records the attempt, and the asset shows its plain link.
 */
export class HttpLinkPreviewer implements LinkPreviewerPort {
  refresh(assetId: string, url: string): void {
    void (async () => {
      let preview: LinkPreview | null = null;
      try {
        preview = await fetchLinkPreview(url);
      } catch (err) {
        logger.debug({ err, assetId }, "link preview not available");
      }
      try {
        await db
          .update(assets)
          .set({
            previewTitle: preview?.title ?? null,
            previewDescription: preview?.description ?? null,
            previewImageUrl: preview?.imageUrl ?? null,
            previewSiteName: preview?.siteName ?? null,
            previewFetchedAt: new Date(),
          })
          .where(and(eq(assets.id, assetId), eq(assets.url, url)));
      } catch (err) {
        logger.warn({ err, assetId }, "could not store the link preview");
      }
    })();
  }
}

/** Used in tests (and when LINK_PREVIEWS=off): never touches the network. */
export class NoLinkPreviewer implements LinkPreviewerPort {
  refresh(): void {}
}
