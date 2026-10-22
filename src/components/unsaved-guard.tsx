"use client";

import { useEffect } from "react";

/**
 * Warns before leaving a page with typed-but-unsaved form values, so nothing is lost silently.
 * It watches every form inside <main>. Submitting a form (which saves) clears the warning. Forms and fields marked
 * data-autosave (they save themselves) are ignored.
 */
export function UnsavedGuard() {
  useEffect(() => {
    let dirty = false;
    const main = document.getElementById("main");
    if (!main) return;
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("form") && !t.closest("[data-autosave]")) dirty = true;
    };
    const onSubmit = () => {
      dirty = false;
    };
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!dirty || !a || a.target === "_blank" || a.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("You have typed something that is not saved yet. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    main.addEventListener("input", onInput);
    main.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => {
      main.removeEventListener("input", onInput);
      main.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
