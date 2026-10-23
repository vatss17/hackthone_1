/**
 * The manufacturer's first choice after sign-up: A (export products I already make) or B (discover what else my factory could make).
 * It only decides where the journey starts. It is kept in a cookie on this device, not in the database: no schema change is needed
 * and the product does not claim it follows the person to another device.
 */
export const GOAL_COOKIE = "export-goal";
export type Goal = "A" | "B";

export const parseGoal = (value: unknown): Goal | null => (value === "A" || value === "B" ? value : null);

export const goalHref = (goal: Goal) => (goal === "A" ? "/start/a" : "/start/b");
