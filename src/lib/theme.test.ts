import { describe, expect, it } from "vitest";
import { parseTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeCookie } from "./theme";

describe("parseTheme", () => {
  it("reads night mode only from an exact 'dark'", () => {
    expect(parseTheme("dark")).toBe("dark");
  });

  it("falls back to day mode for a missing, unknown, or tampered value", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme("")).toBe("light");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("DARK")).toBe("light");
    expect(parseTheme("dark; Path=/")).toBe("light");
    expect(parseTheme("system")).toBe("light");
  });
});

describe("themeCookie", () => {
  it("writes the mode for the whole site for a year", () => {
    expect(themeCookie("dark", false)).toBe(
      `${THEME_COOKIE}=dark; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`,
    );
  });

  it("adds Secure on https pages", () => {
    expect(themeCookie("light", true)).toBe(
      `${THEME_COOKIE}=light; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
    );
  });
});
