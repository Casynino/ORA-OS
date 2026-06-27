// Maps an education article to a relevant ORA photo (no DB image column needed).
// Deterministic per-slug so each article keeps a stable cover.

const COVERS: Record<string, string[]> = {
  MENSTRUAL_HEALTH: ["/ora/lifestyle-1.jpg", "/ora/gallery/g5.jpg"],
  HYGIENE: ["/ora/flatlay.jpg", "/ora/lifestyle-2.jpg"],
  MYTHS_FACTS: ["/ora/gallery/g7.jpg", "/ora/gallery/g3.jpg"],
  COMMUNITY_STORY: ["/ora/gallery/g1.jpg", "/ora/gallery/g4.jpg"],
};

const FALLBACK = ["/ora/gallery/g4.jpg"];

export function educationCover(category: string, slug: string): string {
  const list = COVERS[category] ?? FALLBACK;
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return list[h % list.length];
}
