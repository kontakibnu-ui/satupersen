"use client";

import { useLayoutEffect } from "react";

/**
 * Turns on the section entrances of the landing page. Elements marked
 * `data-reveal` appear as they scroll into view, once. Whatever is already on
 * the first screen is marked shown before the browser paints, so nothing above
 * the fold blinks; without script nothing is ever hidden.
 */
export function RevealRoot() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const show = (element: HTMLElement) => element.setAttribute("data-shown", "");

    for (const element of targets) {
      if (element.getBoundingClientRect().top < window.innerHeight) {
        show(element);
      }
    }

    root.setAttribute("data-reveal", "ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    for (const element of targets) {
      if (!element.hasAttribute("data-shown")) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
      root.removeAttribute("data-reveal");
    };
  }, []);

  return null;
}
