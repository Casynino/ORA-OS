import Image from "next/image";
import { Drift } from "@/components/site/pages/impact/drift";
import { cn } from "@/lib/utils";

/**
 * The impact gallery in the cinematic site's language: four columns of real photos, each column a different
 * height rhythm and each drifting at its own speed as the page scrolls, so the wall moves like a film strip.
 * On phones the same four columns fold into two pairs (two columns side by side, then the next two), so the
 * masonry keeps its shape without duplicating any image. Hover zooms the photo slowly and shows its number.
 */
const SHAPES = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[5/4]"];
const DRIFT = [36, -28, 52, -20];

export function PhotoGallery({
  photos,
  alt = "ORA in the community",
}: {
  photos: string[];
  alt?: string;
}) {
  const COLS = 4;
  const columns = Array.from({ length: COLS }, (_, c) =>
    photos.map((src, i) => ({ src, i })).filter(({ i }) => i % COLS === c),
  );
  const total = String(photos.length).padStart(2, "0");

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-5 sm:gap-y-5 lg:grid-cols-4">
      {columns.map((col, c) => (
        <Drift
          key={c}
          distance={DRIFT[c]}
          className={cn("flex flex-col gap-3 sm:gap-5", c === 1 && "pt-10 sm:pt-16", c === 3 && "pt-10 sm:pt-16 lg:pt-24")}
        >
          {col.map(({ src, i }, row) => (
            <div
              key={src}
              className={cn(
                "group relative overflow-hidden rounded-[2px] bg-white/[0.06] sm:rounded-[2px]",
                SHAPES[(row + c) % SHAPES.length],
              )}
            >
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width:1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                loading="lazy"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(11_6_18/0.7)] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span
                aria-hidden
                className="s-label pointer-events-none absolute bottom-4 left-4 translate-y-2 text-white/90 opacity-0 transition-[opacity,transform] duration-500 group-hover:translate-y-0 group-hover:opacity-100"
              >
                {String(i + 1).padStart(2, "0")} / {total}
              </span>
            </div>
          ))}
        </Drift>
      ))}
    </div>
  );
}
