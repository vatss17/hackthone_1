"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Safe fallback for unexpected failures: no technical detail is shown. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-[34rem] flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Something went wrong")}</h1>
      <p className="text-muted-foreground">
        {t("We could not complete that request. Nothing you entered has been lost or changed. Try again, and if the problem continues, come back in a few minutes.")}
      </p>
      <div>
        <Button type="button" onClick={() => reset()}>
          {t("Try again")}
        </Button>
      </div>
    </main>
  );
}
