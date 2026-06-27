// Public-facing product data for the 3 locked ORA products.
// NO pricing here — public pages never expose price or the ordering model.

export type OraProduct = {
  slug: string;
  sku: string;
  name: string;
  shortName: string;
  size: string;
  length: string;
  color: string;
  colorHex: string;
  use: string;
  icon: "moon" | "sun" | "sparkles";
  purpose: string;
  padsPerPack: number;
  packsPerCarton: number;
  moq: number; // minimum order quantity (packs)
  leadTime: string;
  absorbency: number; // 1..5 drops
  tagline: string;
  description: string;
  features: string[];
  bestFor: string;
  topSheet: string;
  image: string;
  gallery: string[];
};

export const products: OraProduct[] = [
  {
    slug: "night-360",
    sku: "ORA-PURPLE-360",
    packsPerCarton: 48,
    moq: 10,
    leadTime: "2–4 days",
    name: "ORA Night Sanitary Pads",
    shortName: "360mm Purple",
    size: "360mm",
    length: "14.1 inch",
    color: "Purple",
    colorHex: "#7B61FF",
    use: "Night use",
    icon: "moon",
    purpose: "Night Flow Protection",
    padsPerPack: 8,
    absorbency: 5,
    tagline: "Sleep easy, wake up worry-free.",
    description:
      "Our longest, most absorbent pad. At 360mm it covers all the way to the back for full overnight security — so you can move, turn and sleep through the night with total confidence.",
    features: [
      "360mm extra-long coverage",
      "Maximum 5-drop absorbency",
      "100% air-breathable top sheet",
      "Soft, rash-free surface",
      "Secure wings that stay in place",
      "8 pads per pack",
    ],
    bestFor: "Heavy flow & overnight",
    topSheet: "100% air-breathable, cotton-feel",
    image: "/ora/products/purple-360.jpg",
    gallery: [
      "/ora/products/purple-360.jpg",
      "/ora/campaign/night.jpg",
      "/ora/campaign/cloud.jpg",
    ],
  },
  {
    slug: "day-290",
    sku: "ORA-BLUE-290",
    packsPerCarton: 48,
    moq: 10,
    leadTime: "2–4 days",
    name: "ORA Day Sanitary Pads",
    shortName: "290mm Blue",
    size: "290mm",
    length: "11.4 inch",
    color: "Blue",
    colorHex: "#3B82F6",
    use: "Day use",
    icon: "sun",
    purpose: "Day Flow Comfort",
    padsPerPack: 10,
    absorbency: 4,
    tagline: "All-day comfort, all-day confidence.",
    description:
      "The everyday essential. 290mm of reliable daytime protection that stays soft, breathable and discreet from morning to evening — keeping you fresh through school, work and everything in between.",
    features: [
      "290mm everyday coverage",
      "4-drop daytime absorbency",
      "100% air-breathable top sheet",
      "Slim, discreet fit",
      "Secure wings that stay in place",
      "10 pads per pack",
    ],
    bestFor: "Medium flow & daytime",
    topSheet: "100% air-breathable, cotton-feel",
    image: "/ora/products/blue-290.jpg",
    gallery: [
      "/ora/products/blue-290.jpg",
      "/ora/campaign/confident.jpg",
      "/ora/campaign/mood.jpg",
    ],
  },
  {
    slug: "liner-180",
    sku: "ORA-LINER-180",
    packsPerCarton: 60,
    moq: 20,
    leadTime: "2–4 days",
    name: "ORA Daily Liners",
    shortName: "180mm Pant Liners",
    size: "180mm",
    length: "7.08 inch",
    color: "Pink",
    colorHex: "#FF4DBD",
    use: "Liner",
    icon: "sparkles",
    purpose: "Daily Freshness",
    padsPerPack: 20,
    absorbency: 2,
    tagline: "Everyday freshness, barely-there feel.",
    description:
      "Light, flexible and breathable — ORA Daily Liners keep you fresh and confident every day of the month. Perfect for light days, daily discharge, or simply that extra peace of mind.",
    features: [
      "180mm light coverage",
      "2-drop light absorbency",
      "100% air-breathable top sheet",
      "Ultra-thin, barely-there feel",
      "Flexible everyday fit",
      "20 liners per pack",
    ],
    bestFor: "Light days & everyday freshness",
    topSheet: "100% air-breathable, cotton-feel",
    image: "/ora/products/pink-180.jpg",
    gallery: [
      "/ora/products/pink-180.jpg",
      "/ora/campaign/no-leaks.jpg",
      "/ora/campaign/rose.jpg",
    ],
  },
];

export function getProduct(slug: string): OraProduct | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductBySku(sku: string): OraProduct | undefined {
  return products.find((p) => p.sku === sku);
}
