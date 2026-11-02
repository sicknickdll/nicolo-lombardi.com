// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE CONTENT: the collections listed on /archive/, each with its own page.
//
// Each collection:  id (address: /archive/<id>/), title, blurb, icon (image, or null for a
//                   placeholder tile), items.
// Each item:        id, name, type, country, location (use "Unknown" if you do not know),
//                   front / back: transparent scans in assets/archive/<collection>/,
//                   ratio: front width ÷ height (sets the card's shape in 3D),
//                   bulge: how plump it is (sachets 0.04, napkins 0.01).
// Add a scan: put <id>-front.webp, <id>-back.webp and <id>-thumb.webp in the folder (see
// README), add an item here, run `node tools/build.mjs`.
// ─────────────────────────────────────────────────────────────────────────────
const scan = (dir, id) => ({
  front: `/assets/archive/${dir}/${id}-front.webp`,
  back: `/assets/archive/${dir}/${id}-back.webp`,
  thumb: `/assets/archive/${dir}/${id}-thumb.webp`,
});

export const collections = [
  {
    id: "la-barra",
    title: "LA BARRA",
    blurb: "An archive of paper napkins and sugar sachets found in bars around the world.",
    icon: null, // placeholder tile for now: set to an image path when there is one
    items: [
      {
        id: "bar-luce",
        name: "Bar Luce",
        type: "Napkin",
        country: "Italy",
        location: "Milan",
        ratio: 1.0332,
        bulge: 0.012,
        ...scan("la-barra", "bar-luce"),
      },
      {
        id: "museo-del-jamon",
        name: "Museo del Jamón",
        type: "Napkin",
        country: "Spain",
        location: "Madrid",
        ratio: 0.699,
        bulge: 0.012,
        ...scan("la-barra", "museo-del-jamon"),
      },
      {
        id: "gracias-por-su-visita-01",
        name: "Gracias por su visita (I)",
        type: "Napkin",
        country: "Spain",
        location: "Madrid",
        ratio: 0.7169,
        bulge: 0.012,
        ...scan("la-barra", "gracias-por-su-visita-01"),
      },
      {
        id: "gracias-por-su-visita-02",
        name: "Gracias por su visita (II)",
        type: "Napkin",
        country: "Spain",
        location: "Madrid",
        ratio: 0.7445,
        bulge: 0.012,
        ...scan("la-barra", "gracias-por-su-visita-02"),
      },
      {
        id: "good-news-kraft",
        name: "Good News, kraft",
        type: "Sweetener sachet",
        country: "Spain",
        location: "Madrid",
        ratio: 1.5046,
        bulge: 0.045,
        ...scan("la-barra", "good-news-kraft"),
      },
      {
        id: "good-news-white",
        name: "Good News, white",
        type: "Sweetener sachet",
        country: "Spain",
        location: "Madrid",
        ratio: 1.2221,
        bulge: 0.045,
        ...scan("la-barra", "good-news-white"),
      },
    ],
  },
];
