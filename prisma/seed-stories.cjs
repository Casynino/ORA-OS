const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const stories = [
  { slug: "amina-stays-in-school", title: "Amina stays in school", personName: "Amina, Form 2", location: "Jangwani Secondary School, Dar es Salaam", quote: "Now I never miss class during my period.", body: "Since ORA reached Jangwani, I have the pads and the knowledge to manage my period with confidence — I no longer stay home.", sortOrder: 1 },
  { slug: "neema-speaks-up", title: "Neema speaks up", personName: "Neema, Form 3", location: "Jangwani Secondary School, Dar es Salaam", quote: "I'm not ashamed anymore.", body: "The ORA sessions taught us that periods are normal. Now my friends and I talk openly and support one another.", sortOrder: 2 },
  { slug: "zawadi-can-focus", title: "Zawadi can focus", personName: "Zawadi, Form 1", location: "Jangwani Secondary School, Dar es Salaam", quote: "ORA made school feel possible again.", body: "I used to worry every single month. With ORA pads I can now focus on my studies instead of hiding.", sortOrder: 3 },
  { slug: "happy-walks-tall", title: "Happy walks tall", personName: "Happy, Form 4", location: "Jangwani Secondary School, Dar es Salaam", quote: "I walk into exams with my head held high.", body: "Knowing I'm prepared every day of the month means I can give my full attention to my future.", sortOrder: 4 },
];

(async () => {
  await prisma.impactStory.deleteMany();
  await prisma.impactStory.createMany({
    data: stories.map((s) => ({ ...s, published: true })),
  });
  console.log("Replaced impact stories with", stories.length, "Jangwani student voices.");
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
