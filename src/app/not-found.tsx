import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[34rem] flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        That page does not exist, or it belongs to a different company account.
      </p>
      <div>
        <Button asChild>
          <Link href="/">Back to the dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
