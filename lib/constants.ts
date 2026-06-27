// Shared constants (safe to import from both server and client modules).

// System buyer used for field / over-the-counter cash sales so they never
// touch a real partner's account, owned-stock or credit.
export const WALKIN_EMAIL = "walkin@orapads.org";

/**
 * Official ORA contact details. Single source of truth — used by the public
 * contact page, footer, support sections, partner pages and mobile menu.
 * The social URLs are universal links: tapping them on mobile opens the
 * Instagram / TikTok app when installed, and the browser otherwise.
 */
export const ORA_CONTACT = {
  phoneDisplay: "+255 750 849 736",
  phoneHref: "tel:+255750849736",
  email: "info@ora.co.tz",
  emailHref: "mailto:info@ora.co.tz",
  instagram:
    "https://www.instagram.com/orapads.tz?igsh=MTNsZXlxNnJ2OWRzOQ%3D%3D&utm_source=qr",
  tiktok: "https://www.tiktok.com/@ora.sanitary.pads?_r=1&_t=ZS-97Z3mAfMBJk",
} as const;
