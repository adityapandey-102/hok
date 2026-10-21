import { describe, expect, it } from "vitest";
import { isFetchableUrl, isPublicAddress, parseLinkPreview } from "./link-preview.rules";

describe("isPublicAddress (SSRF guard)", () => {
  it("refuses private, loopback, link-local, metadata, CGNAT, multicast and reserved IPv4", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.5", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.2.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("refuses the same in IPv6, including IPv4-mapped forms", () => {
    for (const ip of ["::1", "::", "fd00::1", "fc00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "2001:db8::1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("refuses the hex forms the URL parser and DNS actually return (review 2026-10-22)", () => {
    const hosts = ["http://[::ffff:127.0.0.1]/", "http://[::ffff:169.254.169.254]/latest/meta-data/", "http://[::ffff:10.0.0.1]/"];
    for (const raw of hosts) {
      const host = new URL(raw).hostname.replace(/^[|]$/g, "");
      expect(isPublicAddress(host), `${raw} -> ${host}`).toBe(false);
    }
    for (const ip of ["::ffff:7f00:1", "::ffff:a9fe:a9fe", "0:0:0:0:0:ffff:7f00:1", "::7f00:1", "::127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:0:4136:e378::1", "fec0::1", "fe80::1%eth0"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress("::ffff:808:808")).toBe(true); // 8.8.8.8, hex form
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "142.250.183.14", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("refuses things that are not addresses", () => {
    expect(isPublicAddress("localhost")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});

describe("isFetchableUrl", () => {
  it("allows plain http(s) on standard ports only", () => {
    expect(isFetchableUrl("https://drive.google.com/x")?.hostname).toBe("drive.google.com");
    expect(isFetchableUrl("http://example.com:80/")).not.toBeNull();
    for (const bad of ["ftp://example.com", "file:///etc/passwd", "https://example.com:8080/", "https://user:pw@example.com/", "javascript:alert(1)", "not a url"]) {
      expect(isFetchableUrl(bad), bad).toBeNull();
    }
  });
});

describe("parseLinkPreview", () => {
  const page = "https://www.behance.net/gallery/123/brand-shoot";

  it("reads Open Graph tags, decodes entities and makes the image absolute", () => {
    const html = `<html><head>
      <meta property="og:title" content="Brand shoot &amp; reels">
      <meta property='og:description' content='Spring campaign for Chai Point'>
      <meta property="og:image" content="/img/cover.jpg">
      <meta property="og:site_name" content="Behance">
      <title>ignored</title></head><body><meta property="og:title" content="not in head"></body></html>`;
    expect(parseLinkPreview(html, page)).toEqual({
      title: "Brand shoot & reels",
      description: "Spring campaign for Chai Point",
      imageUrl: "https://www.behance.net/img/cover.jpg",
      siteName: "Behance",
    });
  });

  it("falls back to <title>, the description tag and the host name", () => {
    const html = `<head><title> Q4 deck  </title><meta name="description" content="Slides"></head>`;
    expect(parseLinkPreview(html, "https://www.example.com/deck")).toEqual({ title: "Q4 deck", description: "Slides", imageUrl: null, siteName: "example.com" });
  });

  it("never keeps a non-web image link", () => {
    const html = `<head><meta property="og:image" content="javascript:alert(1)"><meta property="og:image:url" content="x"></head>`;
    expect(parseLinkPreview(html, page).imageUrl).toBeNull();
  });
});
