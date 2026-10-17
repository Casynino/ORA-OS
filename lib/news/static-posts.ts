/**
 * News posts that ship with the website itself (no database step needed). They are
 * merged into the newsroom, the homepage strip and /news/[slug] alongside the posts
 * the owner writes in Admin → News. A post written in Admin with the same slug wins.
 *
 * Body uses the same light formatting as Admin posts (## headings, - bullets,
 * **bold**, [link](url), a line with only a link becomes a button, #hashtags).
 */
export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: "NEWS" | "ANNOUNCEMENT" | "EVENT" | "STORY";
  coverImage: string | null;
  publishedAt: Date;
};

export const STATIC_POSTS: PublicPost[] = [
  {
    id: "static-international-girls-day-2026",
    slug: "international-girls-day-2026",
    title: "Her Voice, Her Rights, Her Future: ORA Pads at International Girls' Day 2026",
    excerpt:
      "At Juhudi Jeshini Secondary School, ORA Pads joined Kampala International University in Tanzania to celebrate International Girls' Day 2026 with more than 600 pads, education, water and a day full of laughter.",
    category: "EVENT",
    coverImage: "/ora/news/girls-day-2026.svg",
    publishedAt: new Date("2026-10-17T08:00:00+03:00"),
    body: `On International Girls' Day 2026, ORA Pads had the honour of joining Kampala International University in Tanzania (KIUT) at Juhudi Jeshini Secondary School. The day had one theme, and we felt it in every conversation: **Her Voice, Her Rights, Her Future.**

Our goal was simple. We wanted every girl in the room to feel seen, informed and confident, and to know that her period should never stop her from learning, playing or dreaming.

## What we shared with the girls

- **More than 600 pads.** Every girl can stay in class, comfortable and confident, month after month.
- **Education.** Honest, friendly talks about periods, health and hygiene, so no girl has to feel shy or afraid about her own body.
- **Water.** Something as simple as water made the day more comfortable for everyone.
- **Fun and games.** Laughing, playing and dancing together. The school was full of energy, and we had so much fun with the girls.

## Why this day matters

For many girls, a period means missed school, missed lessons and missed chances. At ORA, we believe that should never be the case. When a girl has a pad, knowledge and people who support her, she can speak up, stand tall and keep moving toward her future.

Her voice matters. Her rights matter. Her future matters. Empowering girls today builds a stronger, brighter tomorrow for all of us.

## Thank you

A heartfelt thank you to Kampala International University in Tanzania (KIUT), KIUTSO, the teachers and students of Juhudi Jeshini Secondary School, and everyone who made this meaningful day possible. Together, we can make a difference in the lives of the next generation.

## See the day for yourself

[See the photos from the day](https://drive.google.com/drive/folders/1RYfLUimlwGHlOw0Tp4neuINUiXbP2NVF)

#ORAPads #InternationalGirlsDay2026 #HerVoiceHerRightsHerFuture #EmpowerGirls`,
  },
];
