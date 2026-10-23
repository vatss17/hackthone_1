import { PublicHeader } from "@/components/public/public-header";

/** Pages open to everyone: the homepage and the guest sample. No session is read here. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
