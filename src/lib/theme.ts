/**
 * Day and night mode (DESIGN.md §3). Day is the default for everyone, whatever
 * the system prefers; night is a choice made with the switch in the header.
 *
 * The choice is a display preference, not user data, so it gets no database
 * column. It lives in one cookie that holds nothing but "light" or "dark", which
 * lets the server paint the right mode on the first byte: no flash of the wrong
 * colours and no inline script.
 */
export const THEME_COOKIE = "satupersen-theme";

/** One year, so the choice outlasts a browser restart. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

/** Anything other than an exact "dark" is day mode, including a missing or tampered cookie. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

/** The `document.cookie` string the switch writes. `secure` follows the page's protocol. */
export function themeCookie(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/**
 * The browser bar colour per mode. Meta tags take literal colours, so these
 * repeat the `background` token of DESIGN.md §3.
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#F6F4EE",
  dark: "#14161B",
};
