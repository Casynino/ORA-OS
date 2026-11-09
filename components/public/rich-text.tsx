import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

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
 * Plain posts (paragraphs separated by blank lines) render exactly as before.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))[^\s)]+$/i;
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const ONLY_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const HASHTAG = /^#[A-Za-z0-9_]+$/;
const IMAGE = /^!\[([^\]]*)\]\(((?:\/(?!\/)|https:\/\/)[^)\s"]+)(?:\s+"(\d{2,5})x(\d{2,5})")?\)$/;
const STAT = /^\+\+\s*(.+?)\s*\|\s*(.+)$/;
const BUTTON =
  "inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]";

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
          return (
            <strong key={i} className="font-semibold text-foreground">
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
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
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

export function RichText({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        const lines = block.split("\n");

        // ── Photos: one = a wide figure, several = a gallery ──────────────
        const images = lines.map(parseImage);
        if (images.every(Boolean)) {
          const list = images as Img[];
          if (list.length === 1) {
            const p = list[0];
            return (
              <figure key={i} className="py-4 lg:-mx-14">
                <div className="overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={p.src}
                    alt={p.alt}
                    width={p.w}
                    height={p.h}
                    sizes="(min-width:1024px) 960px, 100vw"
                    className="h-auto w-full"
                  />
                </div>
                {p.alt && (
                  <figcaption className="mt-3 text-sm leading-snug text-muted-foreground">
                    {p.alt}
                  </figcaption>
                )}
              </figure>
            );
          }
          return (
            <div
              key={i}
              className={`grid grid-cols-1 gap-3 py-4 sm:gap-4 lg:-mx-14 ${list.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {list.map((p, j) => (
                <figure key={j}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      sizes="(min-width:1024px) 470px, (min-width:640px) 45vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  {p.alt && (
                    <figcaption className="mt-2 text-[13px] leading-snug text-muted-foreground">
                      {p.alt}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          );
        }

        // ── Pull-quote ─────────────────────────────────────────────────────
        if (lines.every((l) => l.startsWith("> "))) {
          return (
            <div key={i} className="py-6">
              <blockquote className="border-l-2 border-primary py-1 pl-6 sm:pl-8">
                <p className="text-balance font-display text-2xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-3xl">
                  {lines.map((l) => l.slice(2)).join(" ")}
                </p>
              </blockquote>
            </div>
          );
        }

        // ── Highlight numbers ──────────────────────────────────────────────
        if (lines.every((l) => STAT.test(l))) {
          return (
            <div key={i} className="py-4 lg:-mx-14">
              <div
                className={`grid grid-cols-1 divide-y divide-border border-y border-border sm:divide-x sm:divide-y-0 ${lines.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
              >
                {lines.map((l) => {
                  const m = l.match(STAT)!;
                  return (
                    <div key={l} className="py-6 sm:px-6 sm:first:pl-0">
                      <p className="text-balance font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-primary tabular-nums">
                        {m[1]}
                      </p>
                      <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{m[2]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (block.startsWith("### ") && lines.length === 1)
          return (
            <h3 key={i} className="pt-2 font-display text-xl font-semibold tracking-[-0.015em] text-foreground">
              {block.slice(4)}
            </h3>
          );
        if (block.startsWith("## ") && lines.length === 1)
          return (
            <h2 key={i} className="text-balance pt-6 font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-3xl">
              {block.slice(3)}
            </h2>
          );

        if (lines.every((l) => /^[-*] /.test(l)))
          return (
            <ul key={i} className="space-y-3">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-3">
                  <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
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
          return (
            <div key={i} className="pt-2">
              {external ? (
                <a
                  href={only[2]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group ${BUTTON}`}
                >
                  {only[1]}
                  <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                </a>
              ) : (
                <Link href={only[2]} className={`group ${BUTTON}`}>
                  {only[1]}
                  <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}
            </div>
          );
        }

        const tokens = block.split(/\s+/);
        if (tokens.length > 0 && tokens.every((t) => HASHTAG.test(t)))
          return (
            <p key={i} className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-sm font-medium text-primary/80">
              {tokens.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </p>
          );

        return (
          <p key={i}>
            <Lines text={block} />
          </p>
        );
      })}
    </div>
  );
}
