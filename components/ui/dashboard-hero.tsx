import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export type DashboardHeroStat = { label: string; value: string; sub?: string };

// ORA's own product photographs, which stand at the side of the banner (softly on a phone).
const PICTURES = {
  purple: { src: "/ora/products/purple-360.jpg", position: "50% 66%" },
  pink: { src: "/ora/products/pink-180.jpg", position: "50% 60%" },
  blue: { src: "/ora/products/blue-290.jpg", position: "50% 55%" },
} as const;
export type DashboardHeroPicture = keyof typeof PICTURES;

/** Today, written out, on ORA's own calendar (Tanzania). */
function today() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date());
}

/**
 * THE BANNER every department opens on — the clean one, copied from Target Express and Super Drive.
 *
 * Deep ORA purple with a pink glow on the right and a little light from the top. The person's
 * name stands in wide capitals between two pink rules, their job small in pink under it, then the
 * date; a product photograph fades in at the side. No sentences and no numbers inside it — the
 * figures (if a department has any for its banner) sit just under it as small cards, and any
 * one-line note goes under that.
 *
 * Everything is passed in from whoever is signed in, so a banner can never show a name and a
 * title that disagree.
 */
export function DashboardHero({
  name,
  role,
  picture = "purple",
  stats,
  note,
}: {
  /** First name, shown in capitals. */
  name: string;
  /** Job or department, small, under the name. */
  role: string;
  picture?: DashboardHeroPicture;
  /** Optional KPI cards, shown just under the banner (2-up on phones, 4-up on desktop). */
  stats?: DashboardHeroStat[];
  /** Optional one-line note under the banner (quiet text, not inside it). */
  note?: React.ReactNode;
}) {
  const pic = PICTURES[picture];
  // A long name gets narrower letters, or a phone would push it onto two lines.
  const long = name.length > 10;

  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#12041f_0%,#1d0836_45%,#2d0f55_75%,#43187f_100%)] text-white shadow-[0_12px_30px_-14px_rgba(40,8,70,0.75),inset_0_1px_0_rgba(255,255,255,0.10)] ring-1 ring-white/10 print:hidden">
        {/* Depth, painted in: a pink light from the right, a little rose from the top, a fine
            sheen along the top edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_220px_at_92%_60%,rgba(244,42,170,0.36),transparent_62%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_150px_at_50%_-10%,rgba(255,150,225,0.16),transparent_70%)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        {/* The photograph at the side: softly on a phone, clearer on a computer. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-[45%] opacity-35 [mask-image:linear-gradient(to_left,#000_20%,transparent)] sm:w-[34%] sm:opacity-60 lg:w-[30%] lg:opacity-75 lg:[mask-image:linear-gradient(to_left,#000_40%,transparent)]"
        >
          <Image
            src={pic.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, 45vw"
            className="object-cover"
            style={{ objectPosition: pic.position }}
          />
        </div>

        <div className="relative flex min-h-[5.75rem] flex-col items-center justify-center px-5 py-4 text-center sm:min-h-[7.5rem] sm:py-5">
          <h1
            className={cn(
              "flex max-w-full items-center gap-4 font-display font-semibold uppercase text-white",
              long
                ? "text-base tracking-[0.2em] sm:text-2xl sm:tracking-[0.3em] lg:text-3xl"
                : "text-xl tracking-[0.32em] sm:text-3xl sm:tracking-[0.5em] lg:text-4xl",
            )}
          >
            <span aria-hidden className="hidden h-px w-10 shrink-0 bg-[#ff7fd0]/60 sm:block" />
            {/* The padding gives back the space the wide tracking leaves after the last letter, so
                the word sits truly in the middle. */}
            <span className={cn("min-w-0 break-words", long ? "pl-[0.2em] sm:pl-[0.3em]" : "pl-[0.32em] sm:pl-[0.5em]")}>{name}</span>
            <span aria-hidden className="hidden h-px w-10 shrink-0 bg-[#ff7fd0]/60 sm:block" />
          </h1>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#ff7fd0] sm:mt-2 sm:text-[11px]">{role}</p>
          <p className="mt-1 text-xs text-white/65 sm:mt-1.5 sm:text-sm">{today()}</p>
        </div>
      </section>

      {stats && stats.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-soft">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 truncate font-display text-[15px] font-bold leading-tight sm:text-lg">{s.value}</p>
              {s.sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
    </Reveal>
  );
}
