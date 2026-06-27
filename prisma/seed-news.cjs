const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const posts = [
  {
    slug: "ora-reaches-5000-girls-mwanza",
    title: "Ora Pads reaches 5,000 girls in Mwanza",
    category: "NEWS",
    coverImage: "/ora/event/e40.jpg",
    publishedAt: new Date("2025-05-10"),
    excerpt: "A milestone month: 5,000 girls in and around Mwanza received ORA pads and menstrual-health education.",
    body: "This month marked a milestone for the ORA movement: 5,000 girls in and around Mwanza received ORA pads and menstrual-health education through our school outreach programme.\n\nFor many of these girls, a reliable pad means the difference between attending class and staying home. Teachers reported noticeably higher attendance in the weeks that followed.\n\nThank you to every partner, agent and donor who made this possible. The cycle of dignity continues.",
  },
  {
    slug: "world-menstrual-hygiene-day-2025",
    title: "World Menstrual Hygiene Day 2025",
    category: "EVENT",
    coverImage: "/ora/event/e30.jpg",
    publishedAt: new Date("2025-05-05"),
    excerpt: "ORA joined schools across the country to break the silence around periods.",
    body: "On World Menstrual Hygiene Day, ORA joined schools and communities across the country to break the silence around periods.\n\nStudents led the conversation — asking questions, busting myths and standing tall. Our team handed out pads and ran open, judgement-free sessions on menstrual health.\n\nPeriods are normal. Dignity is a right. Together we're making both the norm.",
  },
  {
    slug: "new-school-partnership-dodoma",
    title: "New school partnership in Dodoma",
    category: "ANNOUNCEMENT",
    coverImage: "/ora/event/e16.jpg",
    publishedAt: new Date("2025-04-28"),
    excerpt: "A new partnership will bring ORA pads and education to thousands more girls in Dodoma.",
    body: "We're proud to announce a new school partnership in Dodoma that will bring ORA pads and education to thousands more girls this year.\n\nThrough this partnership, ORA will work hand in hand with local schools to keep girls in class every day of the month.\n\nThis is what the movement is about — reaching one more school, one more community, one girl at a time.",
  },
];

(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  for (const post of posts) {
    const data = { ...post, published: true, authorId: admin ? admin.id : null };
    await prisma.newsPost.upsert({
      where: { slug: post.slug },
      update: data,
      create: data,
    });
  }
  console.log("Seeded", posts.length, "news posts.");
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
