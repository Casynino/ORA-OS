import Image from "next/image";

/**
 * Responsive photo grid with a subtle bento rhythm (every 7th tile spans 2×2
 * on large screens). Pure server component — no client JS.
 */
export function PhotoGallery({
  photos,
  alt = "ORA in the community",
}: {
  photos: string[];
  alt?: string;
}) {
  return (
    <div className="grid auto-rows-[1fr] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [grid-auto-flow:dense]">
      {photos.map((src, i) => {
        const feature = i % 7 === 0;
        return (
          <div
            key={src}
            className={`group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-border ${
              feature ? "lg:col-span-2 lg:row-span-2" : ""
            }`}
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes={
                feature
                  ? "(max-width:640px) 50vw, (max-width:1024px) 33vw, 50vw"
                  : "(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              }
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        );
      })}
    </div>
  );
}
