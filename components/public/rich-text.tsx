import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Renders a news post body written in "light markdown" — safe by construction
 * (React elements only, no raw HTML) so an editor can never inject markup:
 *
 *   ## Heading            ### Smaller heading
 *   - bullet              (a block where every line starts with "- ")
 *   **bold**              [link text](https://…)
 *   [Big button](https://…)   ← a paragraph that is ONLY a link becomes a button
 *   #Hashtag #Another     ← a paragraph of only hashtags is shown as small tags
 *
 * Plain posts (paragraphs separated by blank lines) render exactly as before.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))[^\s)]+$/i;
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const ONLY_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const HASHTAG = /^#[A-Za-z0-9_]+$/;

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

export function RichText({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.startsWith("### ") && !block.includes("\n"))
          return (
            <h3 key={i} className="pt-2 font-display text-lg font-semibold tracking-tight text-foreground">
              {block.slice(4)}
            </h3>
          );
        if (block.startsWith("## ") && !block.includes("\n"))
          return (
            <h2 key={i} className="pt-4 font-display text-2xl font-bold tracking-tight text-foreground">
              {block.slice(3)}
            </h2>
          );

        const lines = block.split("\n");
        if (lines.every((l) => /^[-*] /.test(l)))
          return (
            <ul key={i} className="space-y-3">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
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
                  className={buttonVariants({ variant: "accent", size: "lg" })}
                >
                  {only[1]} <ArrowRight className="size-4" />
                </a>
              ) : (
                <Link href={only[2]} className={buttonVariants({ variant: "accent", size: "lg" })}>
                  {only[1]} <ArrowRight className="size-4" />
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
