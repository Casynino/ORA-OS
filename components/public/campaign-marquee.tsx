import Image from "next/image";

// Real ORA-in-the-field photos (school distributions, outreach) — web-optimized
// in public/ora/event. Single scrolling line.
const PHOTOS = [
  "/ora/event/e40.jpg", // handing pads to schoolgirls
  "/ora/event/e28.jpg", // student laughing on the mic
  "/ora/event/e06.jpg", // girls clapping
  "/ora/event/e08.jpg", // girl with her book
  "/ora/event/e09.jpg", // host on the ORA stage
  "/ora/event/e17.jpg", // student portrait in the schoolyard
  "/ora/event/e30.jpg", // girl on the mic by the pad pyramids
  "/ora/event/e32.jpg", // girl carrying chairs, smiling
  "/ora/event/e02.jpg", // girls on the bench
  "/ora/event/e21.jpg", // greeting on stage
  "/ora/event/e27.jpg", // crowd of students smiling
  "/ora/event/e16.jpg", // presenter on the ORA stage
  "/ora/event/e03.jpg", // boy laughing in the crowd
  "/ora/event/e39.jpg", // student portrait
  "/ora/event/e11.jpg", // presenter with the mic
  "/ora/event/e29.jpg", // kids on the mic
];

export function CampaignMarquee() {
  // Duplicate so the -50% translate loops seamlessly.
  const items = [...PHOTOS, ...PHOTOS];
  return (
    <div className="marquee-row overflow-hidden">
      <div className="flex w-max animate-marquee">
        {items.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative mr-4 size-60 shrink-0 overflow-hidden rounded-2xl shadow-soft ring-1 ring-border sm:size-72"
          >
            <Image
              src={src}
              alt="ORA outreach in Tanzania"
              fill
              sizes="288px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
