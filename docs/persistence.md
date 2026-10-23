# Where saved work lives, and the path to a server copy

## Today (verified in this build)
Everything a manufacturer types after the factory and product records is saved **in the browser that typed it** (localStorage, with an in-memory fallback when storage is blocked):

| Data | Key (isolated by company id, and by product id where relevant) |
|---|---|
| Assessment: calculator inputs, accepted samples, scenarios, screening answers, roadmap progress and notes, document drafts and reviews | `export-enablement:assessment:v2:<company>:<product>` (v1 is read and migrated; the original is never deleted) |
| Expert requests | `export-enablement:requests:v1:<company>` |
| Edited, unsaved expert briefs | `export-enablement:expert-draft:v1:<company>:<product or standalone>:<topic>` |
| Factory capacity notes (utilisation, confirmation) | `export-enablement:capacity:v1:<company>:<factory>` |

What this means, and what the interface says: it is **device-local**. It does not follow the person to another browser or device, it is not on our servers, and clearing browser data removes it. **Cross-device persistence has not been implemented or verified, and the product does not claim it.**

Recovery today: **Export my workspace / Import a workspace file** (Workspace page). One versioned JSON file per company. Import refuses a file for another company, validates every field, and never overwrites newer local work unless the person chooses "Replace". Writes always apply to the latest saved copy, so two quick edits (or two tabs) do not overwrite each other.

## Why it is not on the server yet
Storing it server-side needs new tables, which is a **migration** on the hosted database. That was out of scope for this change (no migration without approval), so none was applied.

## Proposed migration (NOT applied)
```sql
create table public.workspace_documents (
  organization_id uuid not null references public.organizations(id),
  product_ref     text not null,           -- product uuid, catalogue id, or 'standalone'
  kind            text not null check (kind in ('assessment','expert_draft','capacity')),
  key             text not null default '',
  schema_version  int  not null,
  payload         jsonb not null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null references auth.users(id),
  primary key (organization_id, product_ref, kind, key)
);
-- Row Level Security: members read their own company's rows, owners write them (same pattern as the existing tables),
-- optimistic concurrency by comparing updated_at on write, audit through the existing trigger.
```
Plan: write-through (save locally first, then to the server), conflict by `updated_at` with the same merge rules as the file import, and a one-time upload of what is already on a device. Only after that is verified on two devices may the interface say it persists across devices.
