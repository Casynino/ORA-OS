// Maps the locked ORA products (by SKU) to their public packshot + size/colour.
// Keeps the real product imagery consistent across dashboards.

export type ProductMeta = {
  image: string;
  size: string;
  color: string;
  use: string;
  accent: string;
};

export const PRODUCT_META: Record<string, ProductMeta> = {
  "ORA-360": {
    image: "/ora/products/purple-360.jpg",
    size: "360mm",
    color: "Purple",
    use: "Night Flow",
    accent: "#7B61FF",
  },
  "ORA-290": {
    image: "/ora/products/blue-290.jpg",
    size: "290mm",
    color: "Blue",
    use: "Day Flow",
    accent: "#3B82F6",
  },
  "ORA-180": {
    image: "/ora/products/pink-180.jpg",
    size: "180mm",
    color: "Pant Liners",
    use: "Daily Freshness",
    accent: "#FF4DBD",
  },
  "ORA-SAMPLE": {
    image: "/ora/products/purple-360.jpg",
    size: "Sample",
    color: "Free Pack",
    use: "Outreach & Trials",
    accent: "#10B981",
  },
};

const FALLBACK: ProductMeta = {
  image: "/ora/products/purple-360.jpg",
  size: "",
  color: "",
  use: "",
  accent: "#7B61FF",
};

export function productMeta(sku: string): ProductMeta {
  return PRODUCT_META[sku] ?? FALLBACK;
}
