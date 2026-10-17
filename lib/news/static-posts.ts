/**
 * News posts that ship with the website itself (no database step needed). They are
 * merged into the newsroom, the homepage strip and /news/[slug] alongside the posts
 * the owner writes in Admin → News. A post written in Admin with the same slug wins.
 *
 * Body uses the same light formatting as Admin posts (## headings, - bullets,
 * **bold**, [link](url), a line with only a link becomes a button, #hashtags) plus
 * photos (![caption](/path "WxH")), galleries (2–4 photo lines in a row),
 * > pull-quotes and ++ highlight numbers. See components/public/rich-text.tsx.
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

const P = "/ora/events/girls-day-2026";

export const STATIC_POSTS: PublicPost[] = [
  {
    id: "static-international-girls-day-2026",
    slug: "international-girls-day-2026",
    title: "Her Voice, Her Rights, Her Future: International Girls' Day 2026 at Juhudi Jeshini",
    excerpt:
      "More than 600 pads, honest conversations, water and a lot of laughter: how ORA Pads and Kampala International University in Tanzania celebrated International Girls' Day 2026 with the girls of Juhudi Jeshini Secondary School.",
    category: "EVENT",
    coverImage: `${P}/group-hero.jpg`,
    publishedAt: new Date("2026-10-17T08:00:00+03:00"),
    body: `The hall at Juhudi Jeshini Secondary School was already glowing before the first speaker picked up the microphone. Pink and gold balloons framed a banner that said it all: **Her Voice. Her Rights. Her Future.**

It was International Girls' Day 2026, and ORA Pads had been invited by Kampala International University in Tanzania (KIUT) to share the day with the girls of the school. What followed was learning, laughter, and a promise kept: that no girl should have to face her period alone.

![The hall at Juhudi Jeshini Secondary School, dressed for International Girls' Day 2026.](${P}/hall.jpg "1600x1067")

## A hall full of girls

From the moment the girls took their seats, the room hummed with anticipation. This was a day made for them: a day to be heard, to learn, and to be reminded that they matter.

![Girls filled the hall, ready to listen.](${P}/girls-listening.jpg "1600x1067")
![Every row of the school came together for the day.](${P}/girls-seated.jpg "1600x1067")

## Learning without shame

Too many girls grow up believing that periods are something to hide. We came to change that story. Speakers from ORA and KIUT stood in front of the girls and spoke plainly and kindly about periods, health and hygiene: what is happening in their bodies, how to stay clean and comfortable, and why there is nothing to be ashamed of.

![Talking openly about periods, health and hygiene.](${P}/speaker-girls.jpg "1600x1067")

When a girl understands her body, she stops being afraid of it, and that confidence follows her into the classroom.

![The ORA team speaking directly to the girls.](${P}/speaker-ora.jpg "1600x1067")
![Clear, friendly information, with a pad in hand.](${P}/speaker-pad.jpg "1600x1067")

> Her voice matters. Her rights matter. Her future matters.

## More than 600 pads

++ 600+ | pads shared with the girls
++ Education | honest talks on periods, health and hygiene
++ Water and games | to keep everyone refreshed and smiling

At the front of the hall, pads were stacked high, more than 600 of them, ready to go home with the girls. For a girl who cannot find or afford a pad, a period can mean days of missed lessons every month. A pad in her bag changes that. It means she can stay in class, keep up with her friends and keep her eyes on her dreams.

![More than 600 ORA pads, ready for the girls to take home.](${P}/pads-table.jpg "1600x1038")

![A pyramid of pads on the table, shared by ORA and KIUT.](${P}/pads-pyramid.jpg "1600x1067")
![Students and teams came together at the pads table.](${P}/student-table.jpg "1600x962")

## From our hands to theirs

Then came the moment everyone had been waiting for. Packet by packet, our team and volunteers handed the pads to the girls, and the hall filled with smiles.

![Handing pads to the girls, one by one.](${P}/handing-1.jpg "1600x1067")
![Smiles all round as the pads were handed out.](${P}/handing-2.jpg "1600x1067")

![Pads raised high: the girls celebrate.](${P}/pads-raised.jpg "1600x1067")

## Water, games and a lot of laughter

Between the talks and the handover, we made sure the day was joyful. Water kept everyone refreshed, and games and playful activities had the girls laughing and cheering together. It turns out that learning about your body and having fun can happen in the same room.

![Hands in: ORA, KIUT and the girls of Juhudi Jeshini, together.](${P}/hands-together.jpg "1600x1067")

![Pads in the air, smiles everywhere.](${P}/smiles-pads.jpg "1600x1067")
![Teachers, guests and students celebrating side by side.](${P}/guests-girls.jpg "1600x1067")

## One school, one big photo

At the end of the day, everyone gathered outside for a group photograph: students, teachers, the KIUT team and the ORA team, with many of the girls holding their new pads high.

![The whole Juhudi Jeshini community with the ORA and KIUT teams.](${P}/group-all.jpg "1600x1072")

![Joy outside, beside the ORA van.](${P}/van-joy.jpg "1600x1067")
![The girls, their pads and the ORA van.](${P}/van-girls.jpg "1600x1067")

## Thank you

A heartfelt thank you to Kampala International University in Tanzania (KIUT) and KIUTSO for inviting us and for bringing so much heart to the day. Thank you to the teachers and students of Juhudi Jeshini Secondary School for welcoming us, and to everyone who helped make it happen.

Empowered girls build stronger futures. We are already looking forward to the next school, the next hall full of girls, and the next chance to say it together: **Her voice. Her rights. Her future.**

## See more of the day

[See all the photos from the day](https://drive.google.com/drive/folders/1RYfLUimlwGHlOw0Tp4neuINUiXbP2NVF)

#ORAPads #InternationalGirlsDay2026 #HerVoiceHerRightsHerFuture #EmpowerGirls`,
  },
];
