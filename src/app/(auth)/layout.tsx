import { Brand } from "@/components/layout/brand";

/** Shell for sign-in and sign-up: same header height, tokens and type as the app. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6 lg:px-8">
        <Brand />
        <span className="hidden text-xs text-muted-foreground sm:inline">Pre-release build</span>
      </header>
      <main className="mx-auto w-full max-w-[26rem] flex-1 px-4 py-10 sm:py-16">{children}</main>
      <footer className="border-t px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        Pre-release build. Use test data only: no real company or customer information.
      </footer>
    </div>
  );
}
