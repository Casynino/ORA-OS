import type { MetadataRoute } from "next";

/**
 * Lets ORA be added to a phone's home screen and open full screen, like an app (no browser
 * address bar). It opens on the sign-in screen, which sends anyone already signed in straight
 * to their own dashboard. Dark colours so the launch screen and Android's status bar match the
 * sign-in scene instead of flashing white.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/login",
    name: "ORA-Pads",
    short_name: "ORA",
    description: "Orders, stock, sales and credit for the ORA team and partners.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "any",
    lang: "en",
    categories: ["business", "productivity"],
    background_color: "#0b0014",
    theme_color: "#0b0014",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android, Samsung and Huawei cut the home-screen icon to their own shape: the mark sits
      // inside the safe circle on a full-bleed ground, so nothing is clipped.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
