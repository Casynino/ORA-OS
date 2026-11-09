import { Unbounded, Instrument_Serif, Geist_Mono } from "next/font/google";

/*
 * The public website's faces (2026-11-09 cinematic redesign, after the owner pointed at the Reckless and Vegas sites):
 * a wide, round display face for the big words (its curves echo the ORA arch), an italic serif for the one word that
 * gets the accent, Poppins (the brand face, from the root layout) for reading, and a mono for the small index labels.
 * Only the public site uses them; the staff app keeps Poppins alone.
 */
export const siteDisplay = Unbounded({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-site-display", display: "swap" });
export const siteSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic", "normal"], variable: "--font-site-serif", display: "swap" });
export const siteMono = Geist_Mono({ subsets: ["latin"], variable: "--font-site-mono", display: "swap" });

export const siteFontVars = `${siteDisplay.variable} ${siteSerif.variable} ${siteMono.variable}`;
