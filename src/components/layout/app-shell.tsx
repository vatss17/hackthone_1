import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/actions/auth";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavList } from "@/components/layout/nav-list";
import { AtlasProvider } from "@/components/atlas/atlas-provider";
import { HeaderActions } from "@/components/atlas/header-actions";
import { getT } from "@/lib/i18n/server";

export async function AppShell({
  user,
  scope,
  products,
  isDemo = false,
  children,
}: {
  user: { email: string };
  /** The company id: keeps what Atlas saves in this browser apart per company. */
  scope: string;
  /** The company's products, for search and Atlas AI. */
  products: { id: string; name: string }[];
  /** The company is the synthetic demo scenario: say so on every page. */
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const { t } = await getT();
  return (
    <AtlasProvider scope={scope} products={products}>
      <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] print:block">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          {t("Skip to content")}
        </a>

        <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:!hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-16 flex-col justify-center border-b border-sidebar-border px-5 text-foreground">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <NavList />
          </div>
          <p className="border-t border-sidebar-border px-5 py-3 text-xs leading-snug text-muted-foreground">{t("Atlas, the export operating system. Live for India to the UAE. Pre-release build, no live market data. Work is saved on this device unless a page says otherwise.")}</p>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card px-3 print:hidden sm:px-6 lg:px-10">
            <MobileNav />
            <div className="text-foreground lg:hidden">
              <Brand />
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:gap-3">
              <HeaderActions />
              <span className="hidden max-w-48 truncate text-foreground xl:inline" title={user.email}>
                {user.email}
              </span>
              <form action={logOut} className="hidden sm:block">
                <Button type="submit" variant="outline" size="sm">
                  {t("Sign out")}
                </Button>
              </form>
            </div>
          </header>

          {isDemo && (
            <div role="note" className="print:hidden border-b border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-1.5 text-center text-[13px] font-medium text-(--status-estimate-fg) sm:px-6">
              {t("Demo scenario: every company, factory and product here is sample data, not a real manufacturer.")}
            </div>
          )}
          <main id="main" className="mx-auto w-full max-w-[76rem] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </AtlasProvider>
  );
}
