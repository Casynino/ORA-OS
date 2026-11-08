import type { MetadataRoute } from "next";

/**
 * Lets ORA be added to a phone's home screen and open full screen, like an app (no browser
 * address bar). It opens on the sign-in screen, which sends anyone already signed in straight
 * to their own dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ORA-Pads",
    short_name: "ORA",
    description: "Orders, stock, sales and credit for the ORA team and partners.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#0b0014",
    theme_color: "#0b0014",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
