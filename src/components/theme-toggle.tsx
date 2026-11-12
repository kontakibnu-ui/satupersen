"use client";

import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { THEME_COLOR, themeCookie, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ThemeContext = createContext<{ theme: Theme; setTheme: (next: Theme) => void } | null>(null);

/**
 * Holds the mode the server painted (read from the cookie in the root layout)
 * and switches it in place: the class on <html> that globals.css understands,
 * the cookie for the next request, and the browser bar colour. Nothing reloads.
 */
export function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);

  function setTheme(next: Theme): void {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = themeCookie(next, window.location.protocol === "https:");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
    setThemeState(next);
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

/**
 * The day and night switch of DESIGN.md §6: a small track with the sun on one
 * end and the moon on the other, and a knob that slides to the chosen one. It
 * is a real switch for assistive technology (`role="switch"`), and the 44 px
 * button around the 32 px track is the touch area.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("ThemeToggle needs ThemeProvider above it");
  }

  const night = context.theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label="Mode malam"
      title={night ? "Ganti ke mode siang" : "Ganti ke mode malam"}
      onClick={() => context.setTheme(night ? "light" : "dark")}
      className={cn(
        "group inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="relative flex h-8 w-[60px] items-center justify-between rounded-full border border-border bg-surface-muted px-2 text-text-muted transition-colors duration-200 group-hover:border-control"
      >
        <Sun size={14} strokeWidth={1.8} />
        <Moon size={14} strokeWidth={1.8} />
        <span
          className={cn(
            "absolute top-[3px] left-[3px] flex size-6 items-center justify-center rounded-full bg-surface text-accent-warm shadow-card transition-transform duration-300 ease-out",
            night && "translate-x-[28px]",
          )}
        >
          {night ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
        </span>
      </span>
    </button>
  );
}
