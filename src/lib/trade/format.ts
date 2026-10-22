export const fmtUsd = (n: number) => (n >= 1e9 ? `USD ${(n / 1e9).toFixed(2)} billion` : `USD ${(n / 1e6).toFixed(1)} million`);
export const fmtTonnes = (kg: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(kg / 1000)} tonnes`;
