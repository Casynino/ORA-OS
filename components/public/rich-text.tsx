import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Magnetic, Rise, ScrollWords } from "@/components/site/motion";
import { btnPrimary } from "@/components/site/page-hero";
import { cn } from "@/lib/utils";

/**
 * Renders a news post body written in "light markdown" — safe by construction
 * (React elements only, no raw HTML) so an editor can never inject markup:
 *
 *   ## Heading            ### Smaller heading
 *   - bullet              (a block where every line starts with "- ")
 *   **bold**              [link text](https://…)
 *   [Big button](https://…)   ← a paragraph that is ONLY a link becomes a button
 *   #Hashtag #Another     ← a paragraph of only hashtags is shown as small tags
 *   ![Caption](/ora/…jpg "1600x1067")   ← a photo (size in quotes is optional)
 *   (2–4 photo lines in a row become a gallery)
 *   > A line to stand out   ← large pull-quote
 *   ++ 600+ | pads shared   ← highlight numbers (several lines = a row of cards)
 *
 * Plain posts (paragraphs separated by blank lines) render exactly as before. On the public site it reads like a
 * magazine chapter: numbered section heads, a drop cap on the opening line, photos that rise in and zoom gently,
 * a pull-quote that lights up word by word as it is read, and big figures.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))[^\s)]+$/i;
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const ONLY_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const HASHTAG = /^#[A-Za-z0-9_]+$/;
const IMAGE = /^!\[([^\]]*)\]\(((?:\/(?!\/)|https:\/\/)[^)\s"]+)(?:\s+"(\d{2,5})x(\d{2,5})")?\)$/;
const STAT = /^\+\+\s*(.+?)\s*\|\s*(.+)$/;
const MONO = "font-site-mono text-[11px] leading-[1.35] uppercase tracking-[0.22em]";
const PINK = "text-[rgb(var(--s-pink))]";
const ZOOM = "transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105";

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link && SAFE_LINK.test(link[2])) {
          const external = isExternal(link[2]);
          return (
            <a
              key={i}
              href={link[2]}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="font-medium text-[rgb(var(--s-pink))] underline decoration-[rgb(var(--s-pink)/0.4)] underline-offset-4 transition-colors hover:decoration-[rgb(var(--s-pink))]"
            >
              {link[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((l, i) => (
        <span key={i}>
          <Inline text={l} />
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

type Img = { alt: string; src: string; w: number; h: number };
function parseImage(line: string): Img | null {
  const m = line.match(IMAGE);
  if (!m) return null;
  return { alt: m[1], src: m[2], w: m[3] ? Number(m[3]) : 1600, h: m[4] ? Number(m[4]) : 1067 };
}

function Caption({ n, text, small }: { n: number; text: string; small?: boolean }) {
  return (
    <figcaption className={cn("flex gap-3 leading-snug text-white/55", small ? "mt-2.5 text-[13px]" : "mt-3.5 text-sm")}>
      <span className={cn(MONO, PINK, "shrink-0 pt-[2px]")}>{pad(n)}</span>
      <span>{text}</span>
    </figcaption>
  );
}

export function RichText({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Running counters (render is synchronous and in order): numbered section heads and photos.
  let chapter = 0;
  let figure = 0;
  let firstParagraph = true;

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        const lines = block.split("\n");

        // ── Photos: one = a wide figure, several = a staggered gallery ─────
        const images = lines.map(parseImage);
        if (images.every(Boolean)) {
          const list = images as Img[];
          if (list.length === 1) {
            const p = list[0];
            const n = ++figure;
            return (
              <Rise key={i} className="py-6 lg:-mx-14">
                <figure className="group">
                  <div className="overflow-hidden rounded-[22px] bg-white/5">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      width={p.w}
                      height={p.h}
                      sizes="(min-width:1024px) 880px, 100vw"
                      className={cn("h-auto w-full", ZOOM)}
                    />
                  </div>
                  {p.alt && <Caption n={n} text={p.alt} />}
                </figure>
              </Rise>
            );
          }
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-1 items-start gap-4 py-6 sm:gap-5 lg:-mx-14",
                list.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {list.map((p, j) => {
                const n = ++figure;
                // A pair steps down on the right; a trio lowers its middle photo.
                const lower = (list.length === 2 && j === 1) || (list.length === 3 && j === 1);
                return (
                  <Rise key={j} delay={j * 0.08} className={cn(lower && "sm:mt-14")}>
                    <figure className="group">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-white/5">
                        <Image
                          src={p.src}
                          alt={p.alt}
                          fill
                          sizes="(min-width:1024px) 440px, (min-width:640px) 45vw, 100vw"
                          className={cn("object-cover", ZOOM)}
                        />
                      </div>
                      {p.alt && <Caption n={n} text={p.alt} small />}
                    </figure>
                  </Rise>
                );
              })}
            </div>
          );
        }

        // ── Pull-quote: huge, lighting up as it is read ────────────────────
        if (lines.every((l) => l.startsWith("> "))) {
          const quote = lines.map((l) => l.slice(2)).join(" ");
          return (
            <blockquote key={i} className="relative my-10 border-y border-white/10 py-12 lg:-mx-14 lg:py-16">
              <span aria-hidden className="block font-site-serif text-[5.5rem] italic leading-[0.5] text-[rgb(var(--s-pink))]">
                &ldquo;
              </span>
              <ScrollWords
                text={quote}
                className="mt-6 font-site-display text-[clamp(1.6rem,3.6vw,2.9rem)] font-semibold uppercase leading-[1.05] tracking-[-0.03em] text-white"
              />
            </blockquote>
          );
        }

        // ── Highlight numbers ──────────────────────────────────────────────
        if (lines.every((l) => STAT.test(l))) {
          return (
            <div key={i} className="py-6 lg:-mx-14">
              <div
                className={cn(
                  "grid grid-cols-1 divide-y divide-white/10 border-y border-white/10 sm:divide-x sm:divide-y-0",
                  lines.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
                )}
              >
                {lines.map((l, j) => {
                  const m = l.match(STAT)!;
                  return (
                    <Rise key={l} delay={j * 0.08} className="py-7 sm:px-6 sm:first:pl-0 sm:last:pr-0">
                      <p className="break-words font-site-display text-[clamp(1.7rem,2.6vw,2.3rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[rgb(var(--s-pink))] [font-variant-numeric:tabular-nums]">
                        {m[1]}
                      </p>
                      <p className="mt-3 text-[15px] leading-snug text-white/60">{m[2]}</p>
                    </Rise>
                  );
                })}
              </div>
            </div>
          );
        }

        if (block.startsWith("### ") && lines.length === 1)
          return (
            <h3 key={i} className="pt-3 font-site-display text-xl font-semibold tracking-[-0.02em] text-white">
              {block.slice(4)}
            </h3>
          );
        if (block.startsWith("## ") && lines.length === 1) {
          const n = ++chapter;
          return (
            <div key={i} className="pt-10">
              <div className="flex items-center gap-4">
                <span className={cn(MONO, PINK)}>[ {pad(n)} ]</span>
                <span aria-hidden className="h-px flex-1 bg-white/10" />
              </div>
              <h2 className="mt-5 text-balance font-site-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold uppercase leading-[1.02] tracking-[-0.03em] text-white">
                {block.slice(3)}
              </h2>
            </div>
          );
        }

        if (lines.every((l) => /^[-*] /.test(l)))
          return (
            <ul key={i} className="space-y-3">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-4">
                  <span aria-hidden="true" className="mt-[0.9em] h-px w-4 shrink-0 bg-[rgb(var(--s-pink))]" />
                  <span>
                    <Inline text={l.slice(2)} />
                  </span>
                </li>
              ))}
            </ul>
          );

        const only = block.match(ONLY_LINK);
        if (only && SAFE_LINK.test(only[2])) {
          const external = isExternal(only[2]);
          const label = (
            <>
              {only[1]}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
            </>
          );
          return (
            <div key={i} className="pt-4">
              <Magnetic>
                {external ? (
                  <a href={only[2]} target="_blank" rel="noopener noreferrer" className={cn("group", btnPrimary)}>
                    {label}
                  </a>
                ) : (
                  <Link href={only[2]} className={cn("group", btnPrimary)}>
                    {label}
                  </Link>
                )}
              </Magnetic>
            </div>
          );
        }

        const tokens = block.split(/\s+/);
        if (tokens.length > 0 && tokens.every((t) => HASHTAG.test(t)))
          return (
            <p key={i} className="flex flex-wrap gap-2 pt-4">
              {tokens.map((t) => (
                <span key={t} className={cn(MONO, PINK, "rounded-full border border-white/10 px-3 py-2")}>
                  {t}
                </span>
              ))}
            </p>
          );

        // The opening paragraph reads larger, with an ORA-pink drop cap.
        const lead = firstParagraph;
        firstParagraph = false;
        return (
          <p
            key={i}
            className={cn(
              lead &&
                "text-[19px] leading-[1.7] text-white/90 first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-site-serif first-letter:text-[4.4rem] first-letter:italic first-letter:leading-[0.8] first-letter:text-[rgb(var(--s-pink))] sm:text-[21px]",
            )}
          >
            <Lines text={block} />
          </p>
        );
      })}
    </div>
  );
}
