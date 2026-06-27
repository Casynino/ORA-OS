// Real ORA field photos from the school-distribution event (shot by Geofrey Temu).
// Web-optimized copies live in public/ora/event/e01.jpg … e40.jpg.

export const eventPhotos = Array.from(
  { length: 40 },
  (_, i) => `/ora/event/e${String(i + 1).padStart(2, "0")}.jpg`,
);

// A few hand-picked standouts for hero/teaser spots.
export const eventHighlights = {
  distribution: "/ora/event/e40.jpg", // handing pads to schoolgirls
  joyMic: "/ora/event/e28.jpg", // student laughing on the mic
  clapping: "/ora/event/e06.jpg", // girls clapping
  reading: "/ora/event/e08.jpg", // girl with her book
  presenter: "/ora/event/e09.jpg", // host on the ORA stage
  portrait: "/ora/event/e17.jpg", // student portrait in the schoolyard
};
