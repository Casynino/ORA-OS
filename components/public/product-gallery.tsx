"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
  accent,
}: {
  images: string[];
  name: string;
  accent: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-border"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${accent}1f, transparent 70%)`,
        }}
      >
        <Image
          src={images[active]}
          alt={name}
          fill
          priority
          sizes="(max-width:1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative size-20 overflow-hidden rounded-xl ring-2 transition",
                i === active
                  ? "ring-primary"
                  : "opacity-70 ring-transparent hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
