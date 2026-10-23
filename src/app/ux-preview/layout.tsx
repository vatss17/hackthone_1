import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UX wireframes · Atlas",
  robots: { index: false, follow: false },
};

/**
 * Isolated wireframe prototype. Fictional data only: no login, no Supabase,
 * no AI calls, nothing written. Shown only outside production (see the proxy).
 */
export default function UxPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary font-sans text-foreground antialiased">
      <div role="note" className="border-b border-primary bg-primary px-4 py-2 text-center text-xs font-medium text-white">
        WIREFRAME, NOT THE PRODUCT · Fictional example data · Nothing here is saved to a server, sent anywhere, or real
      </div>
      {children}
    </div>
  );
}
