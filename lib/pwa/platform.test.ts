import { describe, expect, it } from "vitest";
import { installMode, isIos } from "./platform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("isIos", () => {
  it("recognises iPhones", () => {
    expect(isIos({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true);
  });

  it("recognises an iPad that reports itself as a Mac (touch points give it away)", () => {
    expect(isIos({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
  });

  it("does not mistake a real Mac, Android or Windows for iOS", () => {
    expect(isIos({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false);
    expect(isIos({ userAgent: WINDOWS, maxTouchPoints: 0 })).toBe(false);
  });
});

describe("installMode", () => {
  it("shows nothing when the app is already installed", () => {
    expect(installMode({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe("installed");
    expect(installMode({ userAgent: ANDROID, maxTouchPoints: 5, standalone: true })).toBe("installed");
  });

  it("explains Add to Home Screen on iOS", () => {
    expect(installMode({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe("ios");
  });

  it("uses the browser's install prompt everywhere else", () => {
    expect(installMode({ userAgent: ANDROID, maxTouchPoints: 5, standalone: false })).toBe("prompt");
    expect(installMode({ userAgent: WINDOWS, maxTouchPoints: 0, standalone: false })).toBe("prompt");
  });
});
