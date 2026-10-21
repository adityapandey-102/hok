import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchLinkPreview } from "./http-link-previewer";

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
