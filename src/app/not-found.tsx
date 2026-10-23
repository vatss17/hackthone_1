import Link from "next/link";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n/client";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[34rem] flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight"><T>Page not found</T></h1>
      <p className="text-muted-foreground">
        <T>That page does not exist, or it belongs to a different company account.</T>
      </p>
      <div>
        <Button asChild>
          <Link href="/"><T>Back to the dashboard</T></Link>
        </Button>
      </div>
    </main>
  );
}
