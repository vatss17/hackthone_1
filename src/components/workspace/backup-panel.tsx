"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { EVENT, read, subscribe, write } from "@/components/landed-cost/use-assessment";
import { T, useT } from "@/lib/i18n/client";
import { tx } from "@/lib/workspace/dynamic-text";
import { MAX_BACKUP_BYTES, applyRestore, collect, deviceStatus, parseBackup, planRestore, serialize, type RestoreMode, type Store, type WorkspaceBackup } from "@/lib/workspace/backup";

/** The browser's storage as the backup module sees it, falling back to memory where storage is blocked (the same fallback the pages use). */
const store: Store = {
  keys() {
    try {
      return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter((k): k is string => !!k);
    } catch {
      return [];
    }
  },
  get: (k) => read(k),
  set: (k, v) => void write(k, v),
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null);

/**
 * Where this company's work lives, said plainly, and a way to keep or move it. Nothing here is synced: the data is in THIS browser on
 * THIS device. Export makes a file; import brings a file back, refusing another company's file and never overwriting newer work unless asked.
 */
export function WorkspaceBackupPanel({ scope }: { scope: string }) {
  const t = useT();
  const snap = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(deviceStatus(collect(store, scope))),
    () => "",
  );
  const status = snap ? (JSON.parse(snap) as ReturnType<typeof deviceStatus>) : null;
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState<{ backup: WorkspaceBackup; warnings: string[]; name: string } | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  const exportFile = useCallback(() => {
    const text = serialize(collect(store, scope));
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-workspace-${scope.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "success", text: t("Workspace file downloaded. Keep it somewhere safe: it contains your business details and drafts.") });
  }, [scope, t]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMessage(null);
    setPending(null);
    if (f.size > MAX_BACKUP_BYTES) return setMessage({ tone: "error", text: t("That file is too large to be a workspace file. Nothing was changed.") });
    const r = parseBackup(await f.text());
    if (!r.ok) return setMessage({ tone: "error", text: tx(t, r.error) });
    if (r.backup.organizationId !== scope) return setMessage({ tone: "error", text: t("That workspace file belongs to a different company, so it was not imported. Sign in to that company to import it.") });
    setPending({ backup: r.backup, warnings: r.warnings, name: f.name });
  };

  const plan = pending ? planRestore(collect(store, scope), pending.backup, mode) : null;
  const nWs = pending ? Object.keys(pending.backup.assessments).length : 0;
  const nRq = pending ? pending.backup.requests.length : 0;
  const nDr = pending ? Object.keys(pending.backup.drafts).length : 0;

  const confirm = () => {
    if (!pending) return;
    const r = applyRestore(store, scope, pending.backup, mode);
    if (!r.ok) return setMessage({ tone: "error", text: tx(t, r.error) });
    window.dispatchEvent(new Event(EVENT));
    const n = r.plan.addAssessments.length + r.plan.replaceOlder.length + r.plan.replaceNewer.length;
    const nr = r.plan.addRequests + r.plan.updateRequests;
    const workspaces = n === 1 ? t("{n} product workspace", { n }) : t("{n} product workspaces", { n });
    const requests = nr === 1 ? t("{n} expert request", { n: nr }) : t("{n} expert requests", { n: nr });
    setMessage({ tone: "success", text: t("Imported. {workspaces} added or updated, {kept} kept as they were, {requests} added or updated.", { workspaces, kept: r.plan.keepLocal.length, requests }) });
    setPending(null);
  };

  return (
    <section className="rounded-lg border bg-card p-4 text-sm sm:p-5" aria-labelledby="bk-h">
      <h2 id="bk-h" className="text-base font-medium tracking-tight">
        {t("Where your work is saved")}
      </h2>
      <p className="mt-1 max-w-2xl">
        <span className="font-medium">{t("On this device only.")}</span> {t("Calculator inputs, screening answers, roadmap progress, document drafts and expert briefs are saved in this browser. They are not on our servers, they do not follow you to another device or browser, and clearing this browser's data removes them.")}
      </p>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {status === null
          ? t("Checking…")
          : status.assessments + status.requests + status.drafts === 0
            ? t("Nothing is saved on this device yet.")
            : t("Saved here now: {workspaces}, {requests}, {briefs}.", {
                workspaces: status.assessments === 1 ? t("{n} product workspace", { n: status.assessments }) : t("{n} product workspaces", { n: status.assessments }),
                requests: status.requests === 1 ? t("{n} expert request", { n: status.requests }) : t("{n} expert requests", { n: status.requests }),
                briefs: status.drafts === 1 ? t("{n} edited brief", { n: status.drafts }) : t("{n} edited briefs", { n: status.drafts }),
              }) + (status.lastSaved ? ` ${t("Last saved {when}.", { when: fmt(status.lastSaved) ?? "" })}` : "")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={exportFile}>
          <T>Export my workspace (JSON)</T>
        </Button>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <T>Import a workspace file</T>
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label={t("Import a workspace file")} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void onFile(f); }} />
      </div>

      {pending && plan && (
        <div className="mt-4 rounded-md border bg-muted/40 p-3" role="group" aria-label={t("Review the import")}>
          <p className="font-medium">{pending.name}</p>
          <p className="text-muted-foreground">
            {t("Contains {workspaces}, {requests} and {briefs}.", {
              workspaces: nWs === 1 ? t("{n} product workspace", { n: nWs }) : t("{n} product workspaces", { n: nWs }),
              requests: nRq === 1 ? t("{n} expert request", { n: nRq }) : t("{n} expert requests", { n: nRq }),
              briefs: nDr === 1 ? t("{n} edited brief", { n: nDr }) : t("{n} edited briefs", { n: nDr }),
            })}
            {pending.backup.exportedAt ? ` ${t("Exported {when}.", { when: fmt(pending.backup.exportedAt) ?? "" })}` : ""}
          </p>
          {pending.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-(--status-estimate-fg)">
              {pending.warnings.map((w) => (
                <li key={w}>{tx(t, w)}</li>
              ))}
            </ul>
          )}
          <fieldset className="mt-3 grid gap-2">
            <legend className="sr-only">{t("How to import")}</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="restore-mode" className="mt-1 accent-primary" checked={mode === "merge"} onChange={() => setMode("merge")} />
              <span>
                <span className="font-medium">{t("Add what is missing and keep newer work here")}</span>
                <span className="block text-xs text-muted-foreground">{t("Nothing newer on this device is overwritten.")}</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="restore-mode" className="mt-1 accent-primary" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span>
                <span className="font-medium">{t("Replace what is here with the file")}</span>
                <span className="block text-xs text-muted-foreground">{t("Product workspaces in the file overwrite the same products here, even if the copy here is newer. Nothing else is deleted.")}</span>
              </span>
            </label>
          </fieldset>
          <p className="mt-2" aria-live="polite">
            {plan.replaceNewer.length > 0
              ? t("This would add {add}, update {update}, and overwrite {over} that are newer here; keep {keep} as they are.", { add: plan.addAssessments.length, update: plan.replaceOlder.length, over: plan.replaceNewer.length, keep: plan.keepLocal.length })
              : t("This would add {add}, update {update}; keep {keep} as they are.", { add: plan.addAssessments.length, update: plan.replaceOlder.length, keep: plan.keepLocal.length })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={confirm}>
              <T>Import now</T>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              <T>Cancel</T>
            </Button>
          </div>
        </div>
      )}
      {message && (
        <div className="mt-3" role="status">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </section>
  );
}
