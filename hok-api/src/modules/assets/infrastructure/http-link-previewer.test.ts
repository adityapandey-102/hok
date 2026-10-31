import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLimiter, decodeUtf8, fetchLinkPreview } from "./http-link-previewer";

/**
 * The SSRF guard on the real network stack: a page served on this machine
 * (loopback) is never fetched, whether named by IP or by "localhost", and
 * non-web schemes or ports never leave the process. No internet needed.
 */
let server: http.Server;
let hits = 0;

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    hits += 1;
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<head><title>internal secret</title></head>");
  });
  await new Promise<void>((resolve) => server.listen(80, "127.0.0.1", resolve)).catch(() => undefined);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("fetchLinkPreview: SSRF guard", () => {
  it("refuses a loopback address given as an IP", async () => {
    await expect(fetchLinkPreview("http://127.0.0.1/")).rejects.toThrow(/non-public/);
  });

  it("refuses a name that resolves to loopback", async () => {
    await expect(fetchLinkPreview("http://localhost/")).rejects.toThrow(/non-public/);
  });

  it("refuses private and metadata addresses", async () => {
    await expect(fetchLinkPreview("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/non-public/);
    await expect(fetchLinkPreview("http://10.0.0.1/")).rejects.toThrow(/non-public/);
    await expect(fetchLinkPreview("http://[::1]/")).rejects.toThrow(/non-public/);
  });

  it("never fetches other schemes or ports", async () => {
    expect(await fetchLinkPreview("http://127.0.0.1:3400/")).toBeNull();
    expect(await fetchLinkPreview("file:///etc/passwd")).toBeNull();
  });

  it("never reached the local server", () => {
    expect(hits).toBe(0);
  });
});

describe("decodeUtf8", () => {
  it("gives up on invalid UTF-8", () => {
    expect(decodeUtf8([Buffer.from([0x3c, 0xff, 0xfe, 0x3e])], false)).toBeNull();
  });

  it("tolerates a character split by the size cap", () => {
    expect(decodeUtf8([Buffer.from("ab\u00e9").subarray(0, 3)], true)).toBe("ab");
  });
});

describe("createLimiter", () => {
  it("never runs more than the limit at once and drops overflow", async () => {
    const limiter = createLimiter(2, 3);
    let active = 0;
    let peak = 0;
    let finished = 0;
    const job = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      finished += 1;
    };
    const accepted = Array.from({ length: 8 }, () => limiter.run(job));
    expect(accepted.filter(Boolean)).toHaveLength(5); // 2 running + 3 waiting
    await new Promise((r) => setTimeout(r, 100));
    expect(peak).toBe(2);
    expect(finished).toBe(5);
  });
});
