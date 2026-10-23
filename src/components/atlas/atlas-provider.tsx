"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { AtlasChat } from "@/components/atlas/atlas-chat";
import { CommandPalette } from "@/components/atlas/command-palette";
import { useT } from "@/lib/i18n/client";

interface AtlasApi {
  scope: string;
  products: { id: string; name: string }[];
  /** Opens Atlas AI, optionally running a prompt straight away. */
  openCopilot: (prompt?: string, ref?: string | null) => void;
  openPalette: () => void;
}

const Ctx = createContext<AtlasApi | null>(null);

export function useAtlas(): AtlasApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAtlas must be used inside AtlasProvider");
  return v;
}

const REF_PAGES = ["/workspace/", "/mission/", "/what-if/", "/documentation/", "/feasibility/", "/opportunities/"];

/** The product the current page is about: from the path, else from ?product=. Opportunity pages name a catalogue product, which is also a valid workspace. */
export function pageProductRef(pathname: string, search: string): string | null {
  for (const p of REF_PAGES) {
    if (pathname.startsWith(p)) {
      const ref = pathname.slice(p.length).split("/")[0];
      if (ref && ref !== "standalone") return decodeURIComponent(ref);
    }
  }
  const q = new URLSearchParams(search).get("product");
  return q && q !== "standalone" ? q : null;
}

export function AtlasProvider({ scope, products, children }: { scope: string; products: { id: string; name: string }[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [seed, setSeed] = useState<{ key: string; prompt: string; ref?: string | null } | null>(null);
  const [contextRef, setContextRef] = useState<string | null>(null);

  const openCopilot = useCallback(
    (prompt?: string, ref?: string | null) => {
      setContextRef(pageProductRef(pathname, typeof window === "undefined" ? "" : window.location.search));
      if (prompt) setSeed({ key: `${Date.now()}`, prompt, ref });
      setPalette(false);
      setOpen(true);
    },
    [pathname],
  );
  const openPalette = useCallback(() => setPalette(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const api = useMemo(() => ({ scope, products, openCopilot, openPalette }), [scope, products, openCopilot, openPalette]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <CommandPalette open={palette} onOpenChange={setPalette} products={products} onAsk={(p) => openCopilot(p)} />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#16233f]/25 atlas-fade lg:bg-transparent" />
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (document.getElementById("atlas-input-d") as HTMLTextAreaElement | null)?.focus();
            }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl outline-none atlas-slide sm:w-[28rem]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
              <Dialog.Title className="flex items-center gap-2 text-[15px] font-semibold">
                <Sparkles aria-hidden className="size-4 text-(--brand-teal)" /> {t("Atlas AI")}
              </Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-md hover:bg-secondary" aria-label={t("Close Atlas AI")}>
                <XIcon className="size-4" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">
              <AtlasChat compact scope={scope} products={products} contextRef={contextRef} seed={seed} onNavigate={() => setOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
