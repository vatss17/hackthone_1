"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface WorldData {
  capabilities: { id: string; label: string; kind: "process" | "material" }[];
  products: { id: string; label: string; href: string; own: boolean; fit: string | null; uses: string[] }[];
}

const W = 960;
const COL = { cap: 16, prod: 350, market: 744 };
const NODE_W = { cap: 200, prod: 260, market: 200 };
const ROW = 50;

/**
 * Factory to World: what your factory can do, the products that capability makes, and where those products can go.
 * Every link is a fact from your own profile (a product needs a process you declared). The only live destination is the UAE;
 * other markets are shown as not live, never as available.
 */
export function FactoryToWorld({ data }: { data: WorldData }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [focus, setFocus] = useState<string | null>(null);
  const caps = data.capabilities.filter((c) => c.kind === "process");
  const mats = data.capabilities.filter((c) => c.kind === "material");
  const rows = Math.max(caps.length, data.products.length, 4);
  const H = rows * ROW + 40;
  const capY = (i: number) => 20 + i * ROW + (rows - caps.length) * (ROW / 2);
  const prodY = (i: number) => 20 + i * ROW + (rows - data.products.length) * (ROW / 2);
  const liveY = H / 2 - 50;
  const laterY = H / 2 + 22;

  const lit = (capId: string | null, prodId: string | null) => {
    if (!focus) return true;
    if (focus.startsWith("cap:")) return capId === focus.slice(4) || (prodId !== null && data.products.find((p) => p.id === prodId)?.uses.includes(focus.slice(4)));
    if (focus.startsWith("prod:")) return prodId === focus.slice(5) || (capId !== null && data.products.find((p) => p.id === focus.slice(5))?.uses.includes(capId));
    return true;
  };

  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

  return (
    <div>
      {/* Wide screens: the connected map */}
      <div className="hidden rounded-lg border bg-card p-4 md:block">
        <div className="grid grid-cols-[216fr_134fr_260fr_134fr_216fr] px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          <span>{t("Your capabilities")}</span>
          <span />
          <span>{t("Products they make")}</span>
          <span />
          <span>{t("Where they can go")}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Your factory's processes, the products they make, and destination markets")}>
          {data.products.map((p, pi) =>
            p.uses.map((u) => {
              const ci = caps.findIndex((c) => c.id === u);
              if (ci < 0) return null;
              const on = lit(u, p.id);
              return (
                <motion.path
                  key={`${u}-${p.id}`}
                  d={curve(COL.cap + NODE_W.cap, capY(ci) + 17, COL.prod, prodY(pi) + 18)}
                  fill="none"
                  stroke={on ? "#1f6f6b" : "#d9d5cc"}
                  strokeWidth={on && focus ? 2 : 1.25}
                  strokeOpacity={on ? 0.75 : 0.5}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 0.1 + pi * 0.06 }}
                />
              );
            }),
          )}
          {data.products.map((p, pi) => (
            <motion.path
              key={`m-${p.id}`}
              d={curve(COL.prod + NODE_W.prod, prodY(pi) + 18, COL.market, liveY + 30)}
              fill="none"
              stroke={lit(null, p.id) ? "#16233f" : "#d9d5cc"}
              strokeOpacity={lit(null, p.id) ? 0.55 : 0.4}
              strokeWidth={1.25}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.6 + pi * 0.06 }}
            />
          ))}

          {caps.map((c, i) => {
            const on = lit(c.id, null);
            return (
              <g key={c.id} transform={`translate(${COL.cap},${capY(i)})`} onMouseEnter={() => setFocus(`cap:${c.id}`)} onMouseLeave={() => setFocus(null)} className="cursor-default" opacity={on ? 1 : 0.4}>
                <rect width={NODE_W.cap} height={34} rx={7} fill="#fff" stroke={focus === `cap:${c.id}` ? "#1f6f6b" : "#e4e0d6"} />
                <circle cx={16} cy={17} r={4} fill="#1f6f6b" />
                <text x={28} y={21.5} fontSize={13.5} fill="#1a2132" fontWeight={500}>{c.label.length > 24 ? `${c.label.slice(0, 23)}…` : c.label}</text>
              </g>
            );
          })}

          {data.products.map((p, i) => {
            const on = lit(null, p.id);
            return (
              <g key={p.id} transform={`translate(${COL.prod},${prodY(i)})`} onMouseEnter={() => setFocus(`prod:${p.id}`)} onMouseLeave={() => setFocus(null)} opacity={on ? 1 : 0.4}>
                <a href={p.href}>
                  <rect width={NODE_W.prod} height={36} rx={7} fill={p.own ? "#16233f" : "#fff"} stroke={p.own ? "#16233f" : focus === `prod:${p.id}` ? "#1f6f6b" : "#e4e0d6"} />
                  <title>{p.label}</title>
                  <text x={12} y={22.5} fontSize={13.5} fill={p.own ? "#fff" : "#1a2132"} fontWeight={500}>{p.label.length > 24 ? `${p.label.slice(0, 23)}…` : p.label}</text>
                  {p.fit && <text x={NODE_W.prod - 10} y={22.5} fontSize={11.5} fontWeight={600} textAnchor="end" fill={p.own ? "#7fd3c9" : "#1f6f6b"}>{p.fit}</text>}
                </a>
              </g>
            );
          })}

          <g transform={`translate(${COL.market},${liveY})`}>
            <rect width={NODE_W.market} height={60} rx={9} fill="#e4f0ee" stroke="#1f6f6b" />
            <text x={14} y={25} fontSize={14} fontWeight={600} fill="#16233f">{t("United Arab Emirates")}</text>
            <circle cx={18} cy={42} r={4} fill="#2c6a4c">
              {!reduce && <animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite" />}
            </circle>
            <text x={28} y={46} fontSize={12} fill="#2c6a4c" fontWeight={500}>{t("Live in Atlas")}</text>
          </g>
          <g transform={`translate(${COL.market},${laterY})`}>
            <rect width={NODE_W.market} height={56} rx={9} fill="#fbfaf7" stroke="#c9c4b8" strokeDasharray="4 4" />
            <text x={14} y={23} fontSize={13} fontWeight={500} fill="#5d6372">{t("More markets")}</text>
            <text x={14} y={41} fontSize={12} fill="#5d6372">{t("Not live yet")}</text>
          </g>
        </svg>
        {mats.length > 0 && (
          <p className="mt-2 px-2 text-xs text-muted-foreground">
            {t("Materials you run: {materials}.", { materials: mats.map((m) => m.label).join(", ") })} {t("Hover a process or product to trace what it connects to. Dark nodes are products you already make.")}
          </p>
        )}
      </div>

      {/* Phones: the same facts as a list */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.products.map((p) => (
          <Link key={p.id} href={p.href} className={cn("rounded-lg border p-4", p.own ? "border-(--brand-navy) bg-(--brand-navy) text-white" : "bg-card")}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{p.label}</span>
              {p.fit && <span className={cn("text-xs", p.own ? "text-(--brand-teal-light)" : "text-(--brand-teal)")}>{p.fit}</span>}
            </span>
            <span className={cn("mt-1 block text-xs", p.own ? "text-white/70" : "text-muted-foreground")}>
              {t("Uses {processes} · to the UAE", { processes: p.uses.map((u) => caps.find((c) => c.id === u)?.label).filter(Boolean).join(", ") || t("processes you have not declared") })}
            </span>
          </Link>
        ))}
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{t("Live destination: United Arab Emirates. More markets are not live yet.")}</p>
      </div>
    </div>
  );
}
