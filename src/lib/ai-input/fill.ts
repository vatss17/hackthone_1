/**
 * Puts confirmed text into an EXISTING form control, so voice and image input fill the same forms and the same validation
 * as typing. It only ever adds: a field that already has text keeps it, and the new text goes after it. It does not submit.
 */

export type FillMode = "append" | "set-if-empty";

export function fillControl(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, text: string, mode: FillMode = "append"): boolean {
  const add = text.trim();
  if (!add || el.disabled || (el as HTMLInputElement).readOnly) return false;
  const current = el.value ?? "";
  let next: string;
  if (el instanceof HTMLSelectElement) {
    const option = [...el.options].find((o) => o.value === add || o.text.trim().toLowerCase() === add.toLowerCase());
    if (!option || (current && mode === "set-if-empty")) return false;
    next = option.value;
  } else if (!current.trim()) next = add;
  else if (mode === "set-if-empty") return false;
  else next = `${current.replace(/\s+$/, "")}${el instanceof HTMLTextAreaElement ? "\n" : " "}${add}`;
  // The native setter plus a real input event makes React-controlled fields notice the change.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function fillById(id: string, text: string, mode: FillMode = "append"): boolean {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? fillControl(el, text, mode) : false;
}

/** Finds a control by its form `name` inside a form (or the document), for forms that were rendered on the server. */
export function controlByName(root: ParentNode, name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = root.querySelector(`[name="${name.replace(/"/g, "")}"]`);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el : null;
}
