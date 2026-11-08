import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { NewVersionNotice } from "@/components/app/new-version-notice";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_NAME = "ORA-Pads";
const SITE_TAGLINE = "ORA-Pads — Empowering Every Cycle";
const SITE_DESCRIPTION =
  "ORA-Pads stands for women's health and period dignity across Tanzania — menstrual education, community impact, and the confidence for every girl and woman to thrive through every cycle.";

// Explicit, mobile-correct viewport — fits device width, no forced zoom,
// and users keep the ability to pinch-zoom for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0014",
};

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  // Added to a phone's home screen, ORA opens full screen like an app.
  appleWebApp: { capable: true, title: "ORA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Next only writes the standard `mobile-web-app-capable`; older iPhones read Apple's own name.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: {
    default: SITE_TAGLINE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "women's health",
    "menstrual education",
    "period dignity",
    "menstrual health",
    "girls empowerment",
    "community impact",
    "Tanzania",
    "ORA-Pads",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <Toaster />
          <NewVersionNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
