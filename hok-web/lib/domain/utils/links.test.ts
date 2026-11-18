import { describe, expect, it } from "vitest";
import { splitLinks } from "./links";

describe("splitLinks", () => {
  it("plain text stays one part", () => {
    expect(splitLinks("Studio 4, Indiranagar")).toEqual([{ text: "Studio 4, Indiranagar" }]);
  });

  it("a lone link becomes a link", () => {
    expect(splitLinks("https://meet.google.com/abc-defg-hij")).toEqual([
      { text: "https://meet.google.com/abc-defg-hij", href: "https://meet.google.com/abc-defg-hij" },
    ]);
  });

  it("text around a link, trailing punctuation left out of the link", () => {
    expect(splitLinks("Call on https://zoom.us/j/123. Bring the deck")).toEqual([
      { text: "Call on " },
      { text: "https://zoom.us/j/123", href: "https://zoom.us/j/123" },
      { text: ". Bring the deck" },
    ]);
  });

  it("www. gets https://", () => {
    expect(splitLinks("www.maps.google.com/x")).toEqual([{ text: "www.maps.google.com/x", href: "https://www.maps.google.com/x" }]);
  });

  it("never links a non-http scheme", () => {
    expect(splitLinks("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
    expect(splitLinks("ftp://files.example.com")).toEqual([{ text: "ftp://files.example.com" }]);
  });
});
