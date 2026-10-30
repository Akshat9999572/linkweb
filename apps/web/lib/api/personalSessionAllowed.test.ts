import { afterEach, describe, expect, it, vi } from "vitest";
import { personalSessionAllowed } from "./personalSessionAllowed";

afterEach(() => vi.unstubAllEnvs());

describe("personal session host protection", () => {
  it("allows the local launcher without a reverse proxy", () => {
    expect(personalSessionAllowed("127.0.0.1:3000", undefined)).toBe(true);
    expect(personalSessionAllowed("localhost:3000", undefined)).toBe(true);
  });
  it("rejects public hosts without explicit protection", () => {
    expect(personalSessionAllowed("example.com", undefined)).toBe(false);
    expect(personalSessionAllowed(undefined, undefined)).toBe(false);
  });
  it("requires both the configured VPS host and the proxy secret", () => {
    const secret = "a".repeat(64);
    vi.stubEnv("PERSONAL_PROXY_HOST", "bookmarks.example.com");
    vi.stubEnv("PERSONAL_PROXY_SECRET", secret);
    expect(personalSessionAllowed("bookmarks.example.com", secret)).toBe(true);
    expect(personalSessionAllowed("bookmarks.example.com", undefined)).toBe(
      false
    );
    expect(
      personalSessionAllowed("bookmarks.example.com", "b".repeat(64))
    ).toBe(false);
    expect(personalSessionAllowed("bookmarks.example.com", "short")).toBe(
      false
    );
    expect(personalSessionAllowed("untrusted.example.com", secret)).toBe(false);
  });
  it("rejects weak or missing proxy secrets", () => {
    vi.stubEnv("PERSONAL_PROXY_HOST", "bookmarks.example.com");
    vi.stubEnv("PERSONAL_PROXY_SECRET", "short");
    expect(personalSessionAllowed("bookmarks.example.com", "short")).toBe(
      false
    );
  });
  it("retains protected Vercel access only on the supplied platform hosts", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("PERSONAL_VERCEL_PROTECTED", "true");
    vi.stubEnv("VERCEL_URL", "example.vercel.app");
    expect(personalSessionAllowed("example.vercel.app", undefined)).toBe(true);
    expect(personalSessionAllowed("other.vercel.app", undefined)).toBe(false);
    vi.stubEnv("PERSONAL_VERCEL_PROTECTED", "false");
    expect(personalSessionAllowed("example.vercel.app", undefined)).toBe(false);
  });
});
