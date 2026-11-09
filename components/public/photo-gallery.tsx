import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Responsive photo grid with a quiet bento rhythm. Square tiles set the row height; a few tiles span more cells so
 * the grid closes cleanly on every breakpoint for the 16 impact photos:
 *  - phone (2 columns): all square, 8 full rows
 *  - tablet (3 columns): two wide tiles, 6 full rows
 *  - desktop (4 columns): the first photo 2×2 and one wide tile, 5 full rows
 * Spanning tiles have no aspect ratio of their own, so they stretch to the rows the squares define.
 * Pure server component — no client JS. Photos carry no ring or overlay; on hover the photo settles in slightly.
 */
export function PhotoGallery({
  photos,
  alt = "ORA in the community",
}: {
  photos: string[];
  alt?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 [grid-auto-flow:dense] sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
      {photos.map((src, i) => {
        const feature = i === 0; // 2×2 on desktop
        const wide = i === 5; // 2×1 on tablet and desktop
        const wideTablet = i === 11; // 2×1 on tablet only
        return (
          <div
            key={src}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl bg-white/[0.06] sm:rounded-2xl",
              feature && "lg:col-span-2 lg:row-span-2 lg:aspect-auto",
              wide && "sm:col-span-2 sm:aspect-auto",
              wideTablet && "sm:max-lg:col-span-2 sm:max-lg:aspect-auto",
            )}
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes={
                feature
                  ? "(max-width:640px) 50vw, (max-width:1024px) 33vw, 50vw"
                  : wide || wideTablet
                    ? "(max-width:640px) 50vw, (max-width:1024px) 66vw, 50vw"
                    : "(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              }
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}
