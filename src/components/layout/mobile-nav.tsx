"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/layout/brand";
import { NavList } from "@/components/layout/nav-list";
import { logOut } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <MenuIcon />
          <span className="sr-only">{t("Main")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-foreground">
        <SheetHeader className="flex h-14 justify-center border-b border-sidebar-border px-5 py-0">
          <SheetTitle asChild>
            <div>
              <Brand />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("Main")}
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-2 pb-6 pt-4">
          <NavList onNavigate={() => setOpen(false)} />
          <form action={logOut} className="mt-6 border-t border-sidebar-border px-1 pt-4">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              {t("Sign out")}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
