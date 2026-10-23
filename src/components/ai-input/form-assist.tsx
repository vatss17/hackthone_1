"use client";

import { useRef, useState } from "react";
import { ImageAssist, type AppliedField } from "@/components/ai-input/image-assist";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { controlByName, fillControl, type FillMode } from "@/lib/ai-input/fill";
import { labelToMaterial, nameplateToMachine, toProductForm, type Mapped } from "@/lib/ai-input/mappings";
import { parseRating } from "@/lib/start/capability";
import { MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
import { useI18n } from "@/lib/i18n/client";
import type { VoiceRow } from "@/lib/ai-input/voice";

type Kind = "machine" | "material" | "process" | "product";

/**
 * Adds photo and voice buttons INSIDE an existing server-rendered form, without changing it. Confirmed values are put into the
 * form's own fields (the same names the typed form submits), only into empty ones, and nothing is submitted: the person checks
 * the form and presses its own Save button. Whatever has no field, or whose field already has text, is listed so nothing is lost.
 */
export function FormAssist({ kind }: { kind: Kind }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<{ label: string; value: string; reason: string }[]>([]);
  const form = () => box.current?.closest("form") ?? null;

  const put = (name: string, value: string, mode: FillMode = "set-if-empty"): boolean => {
    const f = form();
    const el = f && controlByName(f, name);
    if (!el || !value) return false;
    // The quantity box starts at 1, which is a default and not something the person typed.
    if (name === "quantity" && el.value === "1" && mode === "set-if-empty") el.value = "";
    return fillControl(el, value, mode);
  };

  const pick = (name: string, test: (text: string, value: string) => boolean): boolean => {
    const f = form();
    const el = f && controlByName(f, name);
    if (!(el instanceof HTMLSelectElement) || el.value) return false;
    const option = [...el.options].find((o) => o.value && test(o.text, o.value));
    return option ? fillControl(el, option.value, "set-if-empty") : false;
  };
  const processOption = (code: keyof typeof PROCESS_NAMES) => (text: string) => {
    const en = PROCESS_NAMES[code].toLowerCase();
    const local = t(PROCESS_NAMES[code]).toLowerCase();
    const x = text.toLowerCase();
    return x === en || x === local || x.includes(en);
  };
  const materialOption = (code: keyof typeof MATERIAL_NAMES) => (text: string) => new RegExp(`\\(${code}\\)`).test(text) || text.toLowerCase() === t(MATERIAL_NAMES[code]).toLowerCase() || text.trim() === code;

  const report = (m: Mapped | { unmapped: Mapped["unmapped"] }, skipped: string[] = []) =>
    setLeft([...m.unmapped.map((u) => ({ label: u.key.replace(/_/g, " "), value: u.value, reason: u.reason })), ...skipped.map((s) => ({ label: s, value: "", reason: "The field already had text, so it was left as it was." }))]);

  const nameplate = (fields: AppliedField[]): number => {
    const m = nameplateToMachine(fields);
    const skipped: string[] = [];
    let placed = 0;
    for (const [k, v] of Object.entries(m.values)) {
      const ok = k === "ratingUnit" ? pick("ratingUnit", (_, val) => val === v) : put(k, v);
      if (ok) placed++;
      else if (k !== "ratingUnit") skipped.push(k);
    }
    if (m.process && pick("process", processOption(m.process))) placed++;
    report(m, skipped);
    return placed;
  };

  const material = (fields: AppliedField[]): number => {
    const m = labelToMaterial(fields);
    const placed = m.material && pick("material", materialOption(m.material)) ? 1 : 0;
    report(m);
    return placed;
  };

  const voice = (rows: VoiceRow[]): number => {
    let placed = 0;
    const extra: { label: string; value: string; reason: string }[] = [];
    const first = <T extends VoiceRow["kind"]>(k: T) => rows.find((r) => r.kind === k) as Extract<VoiceRow, { kind: T }> | undefined;
    if (kind === "machine") {
      const mc = first("machine");
      if (mc) {
        if (pick("process", processOption(mc.process))) placed++;
        if (put("quantity", String(mc.count))) placed++;
        const rating = parseRating(mc.size);
        if (rating) {
          if (put("ratingValue", String(rating.value))) placed++;
          if (pick("ratingUnit", (_, val) => val === rating.unit)) placed++;
        }
        if (rows.filter((r) => r.kind === "machine").length > 1) extra.push({ label: "machines", value: "", reason: "This form adds one machine at a time. Save it, then add the next." });
      }
    } else if (kind === "process") {
      const p = first("process");
      if (p && pick("process", processOption(p.code))) placed++;
      if (rows.filter((r) => r.kind === "process").length > 1) extra.push({ label: "processes", value: "", reason: "This form adds one process at a time. Save it, then add the next." });
    } else if (kind === "material") {
      const mt = first("material");
      if (mt && pick("material", materialOption(mt.code))) placed++;
      if (rows.filter((r) => r.kind === "material").length > 1) extra.push({ label: "materials", value: "", reason: "This form adds one material at a time. Save it, then add the next." });
    } else if (kind === "product") {
      const map: Record<string, string> = { name: "name", category: "category", intended_use: "intendedUse", unit_weight_g: "unitWeightG" };
      for (const r of rows) {
        if (r.kind !== "field") continue;
        if (r.key === "description") placed += put("description", r.value, "append") ? 1 : 0;
        else if (map[r.key]) placed += put(map[r.key], r.value) ? 1 : 0;
        else if (r.key === "material") placed += putSpec({ name: "Material", value: r.value, unit: "" }, extra) ? 1 : 0;
        else extra.push({ label: r.label, value: r.value, reason: "The product form has no field for this." });
      }
    }
    setLeft(extra);
    return placed;
  };

  /** Specification rows: the first empty name/value/unit trio on the form. */
  function putSpec(s: { name: string; value: string; unit: string }, extra: { label: string; value: string; reason: string }[]): boolean {
    const f = form();
    for (let i = 1; f && i <= 9; i++) {
      const n = controlByName(f, `specName${i}`);
      if (!n) break;
      if (!n.value.trim()) {
        put(`specName${i}`, s.name);
        put(`specValue${i}`, s.value);
        if (s.unit) put(`specUnit${i}`, s.unit);
        return true;
      }
    }
    extra.push({ label: s.name, value: `${s.value}${s.unit ? ` ${s.unit}` : ""}`, reason: "There was no empty specification row for this." });
    return false;
  }

  const product = (fields: AppliedField[]): number => {
    const m = toProductForm(fields);
    const extra = [...m.unmapped];
    let placed = 0;
    for (const [k, v] of Object.entries(m.values)) {
      if (put(k, v, k === "description" ? "append" : "set-if-empty")) placed++;
      else extra.push({ key: k, value: v, reason: "The field already had text, so it was left as it was." });
    }
    const rest: { label: string; value: string; reason: string }[] = [];
    for (const s of m.specs) if (putSpec(s, rest)) placed++;
    setLeft([...extra.map((u) => ({ label: u.key.replace(/_/g, " "), value: u.value, reason: u.reason })), ...rest]);
    return placed;
  };

  return (
    <div ref={box} className="rounded-lg border border-dashed bg-muted/40 p-3">
      <div className="flex flex-wrap items-start gap-2">
        {kind === "machine" && (
          <>
            <ImageAssist kind="nameplate" onApply={nameplate} />
            <ImageAssist kind="machine_photo" onApply={nameplate} />
            <VoiceAssist target="factory" onRows={voice} />
          </>
        )}
        {kind === "material" && (
          <>
            <ImageAssist kind="material_label" onApply={material} />
            <VoiceAssist target="factory" onRows={voice} />
          </>
        )}
        {kind === "process" && <VoiceAssist target="factory" onRows={voice} />}
        {kind === "product" && (
          <>
            <VoiceAssist target="product" onRows={voice} fieldId="description" />
            <ImageAssist kind="product_photo" onApply={product} />
            <ImageAssist kind="drawing" onApply={product} />
          </>
        )}
      </div>
      {left.length > 0 && (
        <div role="status" className="mt-3 rounded-md bg-card p-3 text-xs">
          <p className="font-medium">{t("Not added to the form")}</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {left.map((l, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{t(l.label.charAt(0).toUpperCase() + l.label.slice(1))}</span>
                {l.value ? `: ${l.value}` : ""} — {t(l.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
