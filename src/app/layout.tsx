import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// IBM Plex Sans has no Devanagari or Gujarati glyphs, so these two are the fallback for those scripts.
const notoDeva = Noto_Sans_Devanagari({ variable: "--font-noto-deva", subsets: ["devanagari"], preload: false });
const notoGuj = Noto_Sans_Gujarati({ variable: "--font-noto-guj", subsets: ["gujarati"], preload: false });

export const metadata: Metadata = {
  title: "Atlas · Export operating system",
  description: "Atlas helps Indian manufacturers plan, cost and prepare exports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} ${notoDeva.variable} ${notoGuj.variable}`}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
