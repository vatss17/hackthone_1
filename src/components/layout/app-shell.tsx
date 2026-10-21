import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavList } from "@/components/layout/nav-list";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>

      <aside className="hidden border-r bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-14 items-center border-b px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-5">
          <NavList />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 sm:px-6 lg:px-8">
          <MobileNav />
          <div className="min-w-0 truncate text-sm font-semibold lg:hidden">
            Export Enablement Platform
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            <span className="hidden sm:inline">Pre-release build · </span>
            No live data
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
