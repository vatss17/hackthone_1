import { archiveFactory } from "@/lib/actions/factory";

/**
 * Two-step archive without client JavaScript: a native disclosure reveals the
 * confirmation, and only its button submits. Archiving hides the factory and frees its
 * name; nothing is deleted.
 */
export function ArchiveFactory({ id, name }: { id: string; name: string }) {
  return (
    <details className="group">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted md:h-8 [&::-webkit-details-marker]:hidden">
        Archive factory
      </summary>
      <form action={archiveFactory} className="mt-4 grid gap-3 rounded-md border border-border bg-muted/50 p-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm">
          Archive <span className="font-medium">{name}</span>? It disappears from your active factories. Nothing is
          deleted, and you can register a replacement with the same name.
        </p>
        <div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-destructive px-3 text-sm font-medium text-white hover:opacity-90 md:h-8"
          >
            Yes, archive it
          </button>
        </div>
      </form>
    </details>
  );
}
