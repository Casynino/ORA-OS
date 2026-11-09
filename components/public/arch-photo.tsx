import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * ORA's signature on the public site: a photo in the arch of the ORA logo — a
 * window whose top is a half circle as wide as the photo. One shape, used for
 * the photos that carry the brand (the hero, the "why" photo, the reel), never
 * for cards or buttons.
 *
 * `ratio` is width / height. The vertical radius is worked out from it so the
 * top is always a true half circle whatever the size.
 */
export function ArchPhoto({
  src,
  alt,
  ratio = 4 / 5,
  sizes,
  priority,
  position = "50% 50%",
  outline = false,
  reveal = false,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  ratio?: number;
  sizes: string;
  priority?: boolean;
  position?: string;
  /** a hairline arch drawn just outside the photo, like the line around the ORA mark */
  outline?: boolean;
  /** rise into the arch once on load (hero only) */
  reveal?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const v = `${(ratio / 2) * 100}%`;
  const radius = `50% 50% 14px 14px / ${v} ${v} 14px 14px`;
  return (
    <div className={cn("relative", className)} style={{ aspectRatio: String(ratio) }}>
      {outline && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 border border-current opacity-20"
          style={{ borderRadius: radius }}
        />
      )}
      <div className={cn("relative h-full w-full overflow-hidden", reveal && "arch-reveal")} style={{ borderRadius: radius }}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover", reveal && "arch-reveal-img", imgClassName)}
          style={{ objectPosition: position }}
        />
      </div>
    </div>
  );
}
