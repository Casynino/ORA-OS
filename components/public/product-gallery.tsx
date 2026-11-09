"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/site/motion";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** The pack's photos: the big one blurs and settles in when you pick another; it leans in a little on hover. */
export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  return (
    <div>
      <div className="group relative aspect-[4/5] overflow-hidden rounded-[2px] border border-white/10 bg-white/[0.04]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={images[active]}
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, scale: 1.08, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <Image
              src={images[active]}
              alt={name}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
          </motion.div>
        </AnimatePresence>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[rgb(11_6_18/0.65)] to-transparent" />
        <span aria-hidden className="absolute bottom-5 left-5 s-label text-white/85">
          {pad(active + 1)} / {pad(images.length)}
        </span>
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative size-16 overflow-hidden rounded-[2px] bg-white/5 outline-none ring-offset-2 ring-offset-[rgb(var(--s-night))] transition-[opacity,box-shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[rgb(var(--s-pink))] active:scale-95 sm:size-20",
                i === active ? "ring-2 ring-[rgb(var(--s-pink))]" : "opacity-50 hover:opacity-100",
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
