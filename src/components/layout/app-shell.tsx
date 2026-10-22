import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/actions/auth";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavList } from "@/components/layout/nav-list";

export function AppShell({
  user,
  isDemo = false,
  children,
}: {
  user: { email: string };
  /** The company is the synthetic demo scenario: say so on every page. */
  isDemo?: boolean;
  children: React.ReactNode;
}) {
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
          <div className="ml-auto flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden xl:inline">Pre-release build · No live data</span>
            <span className="hidden max-w-56 truncate text-foreground md:inline" title={user.email}>
              {user.email}
            </span>
            <form action={logOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {isDemo && (
          <div role="note" className="border-b border-dashed border-amber/60 bg-(--status-estimate-bg) px-4 py-1.5 text-center text-xs font-medium text-(--status-estimate-fg) sm:px-6">
            Demo scenario: every company, factory and product here is sample data, not a real manufacturer.
          </div>
        )}
        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
