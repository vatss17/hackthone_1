"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { nSuggestions } from "@/lib/opportunities/localize";

export interface BrowserRow {
  id: string;
  name: string;
  group: string;
  level: "strong" | "good" | "possible" | "stretch";
  score: number;
  putsToWork: boolean;
  node: React.ReactNode;
}

const FIRST = 5;

/** Find, filter and sort the suggestions. Without a search or filter it shows the best few and offers the rest. */
export function OpportunityBrowser({ rows }: { rows: BrowserRow[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<"fit" | "name" | "family">("fit");
  const [puts, setPuts] = useState(false);
  const [all, setAll] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (needle ? `${r.name} ${r.group}`.toLowerCase().includes(needle) : true))
      .filter((r) => (level === "all" ? true : r.level === level))
      .filter((r) => (puts ? r.putsToWork : true))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "family" ? a.group.localeCompare(b.group) || b.score - a.score : b.score - a.score || a.name.localeCompare(b.name)));
  }, [rows, q, level, puts, sort]);

  const active = q.trim() !== "" || level !== "all" || puts;
  const shown = active || all ? filtered : filtered.slice(0, FIRST);

  return (
    <div>
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-end sm:p-4" role="search" aria-label={t("Find an opportunity")}>
        <div className="grid gap-1">
          <Label htmlFor="opp-q" className="text-xs">
            {t("Search by product or family")}
          </Label>
          <Input id="opp-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("for example pipes or storage")} autoComplete="off" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="opp-level" className="text-xs">
            {t("Manufacturing fit")}
          </Label>
          <select id="opp-level" value={level} onChange={(e) => setLevel(e.target.value)} className="h-11 rounded-md border border-input bg-card px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-10 md:text-sm">
            <option value="all">{t("Any fit")}</option>
            <option value="strong">{t("Strong")}</option>
            <option value="good">{t("Good")}</option>
            <option value="possible">{t("Possible")}</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="opp-sort" className="text-xs">
            {t("Sort by")}
          </Label>
          <select id="opp-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-11 rounded-md border border-input bg-card px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-10 md:text-sm">
            <option value="fit">{t("Best fit first")}</option>
            <option value="name">{t("Name, A to Z")}</option>
            <option value="family">{t("Product family")}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={puts} onChange={(e) => setPuts(e.target.checked)} />
          {t("Uses idle capability")}
        </label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === 0 ? t("Nothing matches. Clear the search or the filters.") : t("Showing {shown} of {total}.", { shown: shown.length, total: nSuggestions(t, rows.length) })}
        {active && (
          <>
            {" "}
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => { setQ(""); setLevel("all"); setPuts(false); }}>
              {t("Clear search and filters")}
            </Button>
          </>
        )}
      </p>
      <ul className="mt-4 grid gap-5">
        {shown.map((r) => (
          <li key={r.id}>{r.node}</li>
        ))}
      </ul>
      {!active && !all && filtered.length > FIRST && (
        <div className="mt-5">
          <Button type="button" variant="outline" onClick={() => setAll(true)}>
            {t("Show the other {count}", { count: filtered.length - FIRST })}
          </Button>
        </div>
      )}
    </div>
  );
}
