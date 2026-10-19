// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO CONTENT — this is the only file you need to edit to change projects.
//
// Each project:
//   id              short unique name, used in the URL (#project/<id>)
//   brand / title   shown on the project page (title is hidden if it equals brand)
//   type            small label under the title (e.g. "TVC", "VFX")
//   description     the "About the project" text (use \n\n for a new paragraph)
//   cover           full-screen image used in the Film / Visuals scroll
//   images          optional vertical image gallery
//   videos          optional .webm files; a matching .mp4 with the same name must
//                   sit next to each one (Safari / older iPhones play the .mp4)
//   videoPosters    still frame shown before each video plays (same order)
//   videoThumbnails small previews under the video carousel (same order)
//   videoRatios     width ÷ height of each video, e.g. 16/9 → 1.777, 9/16 → 0.5625
//   youtube         optional YouTube embed URL (replaces local videos)
//   externalVideo   optional Vimeo link (embedded + "Open film on Vimeo" link)
//   autoplay        true = a single video starts playing (muted) when the page opens
//   gallery         "ticker" = show `images` as one endlessly scrolling row instead of
//                   the vertical carousel
//   stills          optional: switches the page to the "case" layout (film on top, text,
//                   then a two-column grid of these stills). Each is img(path, width, height)
//   bts             optional: { images: [img(...)] } "Behind the scenes" strip under the stills
//   closingVideo    optional: { src (.webm + .mp4 twin), poster, ratio, label } film at the
//                   bottom that plays muted on a loop while it is on screen
//                   (with `stills`, `images` becomes a row of portrait key visuals)
//
// The order of `projects` is the order of the "Next project" links.
// `filmOrder` and `visualsOrder` decide what appears in each section, in order.
// ─────────────────────────────────────────────────────────────────────────────
const img = (src, w, h) => ({ src, w, h });
export const projects = [
  {
    id: "uncommonsense",
    brand: "UNCOMMONSENSE",
    title: "UNCOMMONSENSE",
    type: "Social Media Content & Fashion",
    description:
      "UNCOMMONSENSE is an accessories brand founded by @Ohh.Ginger. For the brand, I create end-to-end AI-native campaigns, developing everything from the initial concept and creative direction to image generation, video production, sound design, and final editing. \n\nThe work blends fashion, surrealism, and contemporary visual culture to build distinctive visual narratives, while maintaining strict consistency across characters, products, materials, and textures to faithfully represent the physical product in highly stylized environments.",
    cover: "/assets/uncommonsense-header.webp",
    images: [],
    videos: [
      "/assets/pgvXtdMshKqmetkpEhgM2k1TI.webm",
      "/assets/Ste489lG9zmVBFJeCYP9xDo.webm",
      "/assets/Vfrnp4LUs7aaOAevNvmhbI8FJrw.webm",
      "/assets/3z5frFOL28vZ40IlJCXbcUgW0pc.webm",
      "/assets/FD1kZsJlQdpOLlGLrAbnlQFTPA.webm",
      "/assets/GWH2DGkArjGgTWVAw8hsv6C5rxM.webm",
      "/assets/i7MWkcoSeItRmxvFvuUf3tTLM.webm",
    ],
    youtube: null,
    videoPosters: [
      "/assets/pgvXtdMshKqmetkpEhgM2k1TI-poster.webp",
      "/assets/Ste489lG9zmVBFJeCYP9xDo-poster.webp",
      "/assets/Vfrnp4LUs7aaOAevNvmhbI8FJrw-poster.webp",
      "/assets/3z5frFOL28vZ40IlJCXbcUgW0pc-poster.webp",
      "/assets/FD1kZsJlQdpOLlGLrAbnlQFTPA-poster.webp",
      "/assets/GWH2DGkArjGgTWVAw8hsv6C5rxM-poster.webp",
      "/assets/i7MWkcoSeItRmxvFvuUf3tTLM-poster.webp",
    ],
    videoThumbnails: [
      "/assets/pgvXtdMshKqmetkpEhgM2k1TI-thumb.webp",
      "/assets/Ste489lG9zmVBFJeCYP9xDo-thumb.webp",
      "/assets/Vfrnp4LUs7aaOAevNvmhbI8FJrw-thumb.webp",
      "/assets/3z5frFOL28vZ40IlJCXbcUgW0pc-thumb.webp",
      "/assets/FD1kZsJlQdpOLlGLrAbnlQFTPA-thumb.webp",
      "/assets/GWH2DGkArjGgTWVAw8hsv6C5rxM-thumb.webp",
      "/assets/i7MWkcoSeItRmxvFvuUf3tTLM-thumb.webp",
    ],
    videoRatios: [
      1.3333333333333333, 0.5625, 0.5625, 0.557632398753894, 0.5592515592515592, 0.557632398753894,
      0.5628930817610063,
    ],
  },
  {
    id: "malik-cross",
    brand: "Malik Cross",
    title: "Malik Cross",
    type: "Short Film · Bionic Awards Entry",
    description:
      "Malik Cross /məˈliːk krɔs/ — a short cinematic story about resilience and ambition.\n\nIt's the story of continuing to do what you love, beyond the outcome: the drive that keeps you going when nobody is keeping score.\n\nCreated side by side with Adrián Vicén as our entry for the Bionic Awards, and made entirely with the Freepik AI suite.\n\nJust do it.",
    cover: "/assets/malik-cross-banner.webp",
    images: [],
    stills: [
      img("/assets/malik-cross-still-01.webp", 6336, 2688),
      img("/assets/malik-cross-still-02.webp", 3168, 1344),
      img("/assets/malik-cross-still-03.webp", 3168, 1344),
      img("/assets/malik-cross-still-04.webp", 1584, 672),
      img("/assets/malik-cross-still-05.webp", 3168, 1344),
      img("/assets/malik-cross-still-06.webp", 1920, 817),
    ],
    videos: ["/assets/malik-cross-hero.webm"],
    videoPosters: ["/assets/malik-cross-hero-poster.webp"],
    videoThumbnails: ["/assets/malik-cross-hero-thumb.webp"],
    videoRatios: [2.3453],
    autoplay: true,
    youtube: null,
  },
  {
    id: "toyota",
    brand: "Toyota",
    title: "Ma Toyota est Fantastique",
    type: "Digital Asset",
    description:
      'For Toyota France\'s "Ma Toyota est Fantastique" campaign, I created a photorealistic de-aged portrait of the lead actor alongside the featured vehicle. The asset was printed and used directly on set, with a focus on identity consistency, visual authenticity, and accurate vehicle detailing to seamlessly integrate with the live-action production.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.',
    cover: "/assets/toyota-header.webp",
    images: ["/assets/DTlMGv30IEOltcth8y1RmJJoVug.webp"],
    videos: [],
    youtube:
      "https://www.youtube-nocookie.com/embed/Zykwz9wTaG4?v=Zykwz9wTaG4&iv_load_policy=3&rel=0&modestbranding=1&playsinline=1&autoplay=0&color=white",
  },
  {
    id: "lexus",
    brand: "Lexus",
    title: "Electrified",
    type: "TVC",
    description:
      "AI-generated TV commercial created for the Lexus Electrified series. Working alongside filmmakers, 3D artists, and expert photoretouchers, I helped develop a premium visual pipeline that delivered the cinematic quality, vehicle accuracy, and refined aesthetics expected from a Lexus campaign.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/lexus-header.webp",
    images: [],
    videos: ["/assets/q65cZYQLVwWuvK4CaJ99qUKYaI0.webm"],
    youtube: null,
    videoPosters: ["/assets/q65cZYQLVwWuvK4CaJ99qUKYaI0-poster.webp"],
    videoThumbnails: ["/assets/q65cZYQLVwWuvK4CaJ99qUKYaI0-thumb.webp"],
    videoRatios: [0.8],
  },
  {
    id: "schweppes",
    brand: "Schweppes",
    title: "Schweppes",
    type: "AI Film · Advertising",
    description:
      "A fully AI-generated project for Schweppes. Guided by Clive, the film invites viewers into the iconic Schweppes mansion to celebrate New Year’s Eve in a world where elegance, fantasy, and generative AI come together to create a unique festive experience.\n\nI contributed to the storyboarding and frame generation, and made the final VO and voice design of Clive.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/schweppes-header.webp",
    images: [],
    stills: [1, 2, 3, 4, 5, 6].map((n) => img(`/assets/schweppes-still-0${n}.webp`, 1920, 1080)),
    videos: ["/assets/schweppes-hero.webm"],
    youtube: null,
    videoPosters: ["/assets/schweppes-hero-poster.webp"],
    videoThumbnails: ["/assets/schweppes-hero-thumb.webp"],
    videoRatios: [16 / 9],
  },
  {
    id: "elaguila",
    brand: "El Águila",
    title: "La hora dorada",
    type: "Virtual Production",
    description:
      "For El Águila's \"La Hora Dorada\" campaign, I designed AI-generated virtual production backgrounds that served as extensions of the physical set. Collaborating closely with both the director and DOP, I crafted environments that aligned with the project's visual language, matching light, composition, and atmosphere to achieve a cohesive final image.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/elaguila-header.webp",
    images: [
      "/assets/EbUqwZS95KiNcYsKBk3UANSNwE.webp",
      "/assets/yIEYV8vCubp6Kj2aMdWp37H2M.webp",
      "/assets/D7gRk6cgnwsXzD7ZpcUlbGip1QY.webp",
    ],
    stills: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => img(`/assets/elaguila-still-0${n}.webp`, 1920, 1080)),
    videos: ["/assets/elaguila-hero.webm"],
    youtube: null,
    videoPosters: ["/assets/elaguila-hero-poster.webp"],
    videoThumbnails: ["/assets/elaguila-hero-thumb.webp"],
    videoRatios: [16 / 9],
    closingVideo: {
      src: "/assets/elaguila-film.webm",
      poster: "/assets/elaguila-film-poster.webp",
      ratio: 16 / 9,
      label: "behind the scenes film",
    },
  },
  {
    id: "melia",
    brand: "Meliá",
    title: "Hotel Meliá",
    type: "Social Media Content",
    description:
      "For Meliá Hotels International, I produced social media videos blending AI-generated content with existing hotel assets. \n\nEvery piece was designed to reflect real destinations and experiences, ensuring brand authenticity, visual consistency, and a premium aesthetic across all deliverables.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/YdNyD17WHUrTAhLwd8H2m4OCiio.webp",
    images: [],
    videos: [
      "/assets/9o6UGKJle9O9wkuKGqdLwOqjB2w.webm",
      "/assets/zSZrThHWODZG0ReCYFLVQcZv8fk.webm",
    ],
    youtube: null,
    videoPosters: [
      "/assets/9o6UGKJle9O9wkuKGqdLwOqjB2w-poster.webp",
      "/assets/zSZrThHWODZG0ReCYFLVQcZv8fk-poster.webp",
    ],
    videoThumbnails: [
      "/assets/9o6UGKJle9O9wkuKGqdLwOqjB2w-thumb.webp",
      "/assets/zSZrThHWODZG0ReCYFLVQcZv8fk-thumb.webp",
    ],
    videoRatios: [0.5625, 0.5625],
  },
  {
    id: "wichita",
    brand: "Wichita Production",
    title: "Kill the Boy",
    type: "VFX",
    description:
      "Created the VFX for a Wichita Production music video using a hybrid workflow that combined live-action footage, image inpainting, and video-to-video techniques. Animated and integrated digital assets while maintaining visual consistency and supporting the director’s creative vision.",
    cover: "/assets/wichita-header.webp",
    images: ["/assets/ktb-still.webp", "/assets/ktb-head.webp", "/assets/ktb-head2.webp"],
    videos: [
      "/assets/ktb-film.webm",
      "/assets/ktb-vfx-01.webm",
      "/assets/ktb-vfx-02.webm",
      "/assets/ktb-vfx-03.webm",
      "/assets/ktb-vfx-04.webm",
      "/assets/ktb-vfx-06.webm",
      "/assets/ktb-vfx-07.webm",
    ],
    youtube: null,
    videoPosters: [
      "/assets/ktb-film-poster.webp",
      "/assets/ktb-vfx-01-poster.webp",
      "/assets/ktb-vfx-02-poster.webp",
      "/assets/ktb-vfx-03-poster.webp",
      "/assets/ktb-vfx-04-poster.webp",
      "/assets/ktb-vfx-06-poster.webp",
      "/assets/ktb-vfx-07-poster.webp",
    ],
    videoThumbnails: [
      "/assets/ktb-film-thumb.webp",
      "/assets/ktb-vfx-01-thumb.webp",
      "/assets/ktb-vfx-02-thumb.webp",
      "/assets/ktb-vfx-03-thumb.webp",
      "/assets/ktb-vfx-04-thumb.webp",
      "/assets/ktb-vfx-06-thumb.webp",
      "/assets/ktb-vfx-07-thumb.webp",
    ],
    videoRatios: [
      1.8962962962962964, 1.8962962962962964, 1.8962962962962964, 1.8962962962962964,
      1.8962962962962964, 1.8962962962962964, 1.8962962962962964,
    ],
  },
  {
    id: "anaya",
    externalVideo: "https://vimeo.com/1199356201?share=copy&fl=sv&fe=ci",
    brand: "Anaya",
    title: "ANAYA",
    type: "Educational Video",
    description:
      "Created and produced a series of educational animated videos for Anaya, one of Spain’s leading educational publishers, aimed at primary school students (Grades 1–5). The projects included animated stories, literary adaptations, and informative learning content designed to support classroom education and independent learning.\n\nResponsible for the visual development, art direction, storyboard and frame creation, animation, and overall creative vision of each video. Working from editorial scripts, I translated educational content into engaging visual narratives while ensuring consistency with Anaya’s established visual identity and pedagogical objectives.\n\nAll productions featured narration by acclaimed Spanish voice actor Álvaro Mendoza, contributing to an accessible and engaging learning experience for young audiences.",
    cover: "/assets/anaya-header.webp",
    images: [],
    videos: [],
    youtube: null,
  },
  {
    id: "wppproduction",
    brand: "WPP Production",
    title: "Virtual Production",
    type: "Virtual Production",
    description:
      "A pilot project exploring how AI-generated environments can be integrated into Virtual Production workflows. Crafted on set of WPP Production (old name Hogarth).\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/wppproduction-header.webp",
    images: [],
    stills: [
      img("/assets/wppproduction-still-01.webp", 3840, 2160),
      img("/assets/wppproduction-still-03.webp", 1920, 1080),
      img("/assets/wppproduction-still-04.webp", 1920, 1080),
      img("/assets/wppproduction-still-06.webp", 1920, 1080),
      img("/assets/wppproduction-still-02.webp", 1920, 1080),
      img("/assets/wppproduction-still-07.webp", 1920, 1080),
      img("/assets/9hyo0VkCbLoEIrXSuxcA1SIr6c.webp", 2048, 880),
      img("/assets/naOAPUvjZFYi85q78GDLS8IER0.webp", 2048, 877),
      img("/assets/tCWzlzIAE7jQHlAVps91sxPcyj8.webp", 2048, 874),
      img("/assets/ioNHN6Zjwan6br7R43sdHv4a2uQ.webp", 2048, 874),
    ],
    bts: {
      images: [
        img("/assets/wppproduction-bts-01.webp", 3840, 2160),
        img("/assets/wppproduction-bts-02.webp", 3840, 2160),
        img("/assets/jc4FOKsSx1h4P4kwI6ODDCKpm9Q.webp", 2048, 877),
        img("/assets/wppproduction-bts-03.webp", 3840, 2160),
        img("/assets/wppproduction-bts-04.webp", 3840, 2160),
        img("/assets/wppproduction-bts-05.webp", 3840, 2160),
        img("/assets/wppproduction-bts-06.webp", 3840, 2160),
      ],
    },
    videos: ["/assets/wppproduction-hero.webm", "/assets/Ldb4lUOdpBMLqQgyUIvXayYlE.webm"],
    youtube: null,
    videoPosters: [
      "/assets/wppproduction-hero-poster.webp",
      "/assets/Ldb4lUOdpBMLqQgyUIvXayYlE-poster.webp",
    ],
    videoThumbnails: [
      "/assets/wppproduction-hero-thumb.webp",
      "/assets/Ldb4lUOdpBMLqQgyUIvXayYlE-thumb.webp",
    ],
    videoRatios: [2.3529, 1.7777777777777777],
    closingVideo: {
      src: "/assets/wppproduction-bts.webm",
      poster: "/assets/wppproduction-bts-poster.webp",
      ratio: 16 / 9,
      label: "behind the scenes film",
    },
  },
  {
    id: "soapandglory",
    brand: "Soap & Glory",
    title: "Soap & Glory",
    type: "AI Product Shot",
    description:
      "A series of AI-crafted beauty visuals for Soap & Glory, blending playful, fragrance-inspired worlds with precise product reproduction. Working alongside expert photoretouchers, I developed campaign-ready imagery that preserves packaging accuracy, material realism, and texture detail while pushing the creative possibilities beyond traditional product photography.\n\nProperty of WPP Production / WPP Holding. Featured here to showcase my contribution as part of the production and creative team.",
    cover: "/assets/soapandglory-header.webp",
    gallery: "ticker",
    images: [
      "/assets/fQqLobjVjQLcjn0oYAmyuUyPAs.webp",
      "/assets/SKCYB8BMwkneaPvdQDQqhbuyVKE.webp",
      "/assets/VsTh5pQROkDtulNoeTzjH4oFN10.webp",
      "/assets/WPCII4Q6wfoAC5QLMGvrtZzfiMg.webp",
      "/assets/ZNevGqjeZtnNwmtIkJQYvFLGwNI.webp",
      "/assets/qxYVszQfCWqf8VjXjMmMxJaTd9I.webp",
      "/assets/soapandglory-01.webp",
      "/assets/soapandglory-02.webp",
      "/assets/soapandglory-03.webp",
      "/assets/soapandglory-04.webp",
    ],
    videos: [],
    youtube: null,
  },
  {
    id: "wichita-666",
    brand: "Wichita Production",
    title: "666",
    type: "Music Video · Edit & VFX",
    description:
      'Edit and VFX for "666" by Pratzo ft. Sato, a music video produced by Wichita Production.\n\nEdited the music video and in charge of the VFX, shaping the visuals and final look of the film in close collaboration with the Wichita team.',
    cover: "/assets/wichita-666-header.webp",
    images: [],
    videos: [],
    youtube:
      "https://www.youtube-nocookie.com/embed/Bg-ywjQUpUk?iv_load_policy=3&rel=0&modestbranding=1&playsinline=1&color=white",
  },
];

// Sections shown in the top navigation, as lists of project ids.
// The landing page shows the hero video followed by the film list.
export const filmOrder = [
  "schweppes",
  "elaguila",
  "wppproduction",
  "lexus",
  "toyota",
  "uncommonsense",
  "anaya",
  "malik-cross",
  "wichita",
  "wichita-666",
  "melia",
];
export const visualsOrder = ["soapandglory", "toyota", "elaguila", "anaya", "wppproduction"];

// "Selected clients" logo strip in the About panel, in this order.
// ratio = logo width ÷ height (used to give every logo the same visual weight).
export const clients = [
  { name: "Coca-Cola", logo: "/assets/clients/cocacola.webp", ratio: 3.184 },
  { name: "Heineken", logo: "/assets/clients/heineken.webp", ratio: 1.986 },
  { name: "Lexus", logo: "/assets/clients/lexus.webp", ratio: 2.228 },
  { name: "Toyota", logo: "/assets/clients/toyota.webp", ratio: 7.639 },
  { name: "Boots", logo: "/assets/clients/boots.webp", ratio: 1.885 },
  { name: "Soap & Glory", logo: "/assets/clients/soapglory.webp", ratio: 4.624 },
  { name: "Meliá Hotels & Resorts", logo: "/assets/clients/melia.webp", ratio: 2.077 },
  { name: "El Águila", logo: "/assets/clients/aguila.webp", ratio: 1.062 },
  { name: "Osborne", logo: "/assets/clients/osborne.webp", ratio: 7.289 },
  { name: "Anaya", logo: "/assets/clients/anaya.webp", ratio: 4.306 },
  { name: "WPP Production", logo: "/assets/clients/wpp.webp", ratio: 9.475 },
  { name: "Wichita Production", logo: "/assets/clients/wichita.webp", ratio: 0.712 },
  { name: "Graphomedia", logo: "/assets/clients/graphomedia.webp", ratio: 1.792 },
  { name: "UNCOMMONSENSE", logo: "/assets/clients/uncommonsense.webp", ratio: 13.03 },
];

// Visitor statistics (GoatCounter: free, no cookies, no cookie banner needed).
// Create an account at https://www.goatcounter.com and put your code here, e.g. "nicolo".
export const goatcounter = "";

// Landing intro (js/intro.js). `words` roll through in the name's place before the
// name itself appears, while the `frames` spin around them on a ring; the ring is then
// pulled back into the name. ratio = width ÷ height. A frame with `video` plays that
// clip on a loop (its .mp4 twin must exist; `src` is its first frame, shown until it
// plays). The clips are 4-second, 360px cuts of the project videos made by
// tools/make-intro-clips.sh, so they load fast: add new ones there.
const clip = (name, ratio) => ({
  src: `/assets/intro/${name}.webp`,
  video: `/assets/intro/${name}.webm`,
  ratio,
});
const still = (name, ratio) => ({ src: `/assets/intro/${name}.webp`, ratio });
export const intro = {
  words: [
    "AI Production Specialist",
    "Art Direction",
    "AI Filmmaking",
    "VFX",
    "Virtual Production",
  ],
  frames: [
    clip("elaguila-hero", 16 / 9),
    still("elaguila-still-02", 16 / 9),
    still("wppproduction-still-01", 16 / 9),
    clip("malik-cross-hero", 2.3453),
    still("soapandglory-01", 1),
    still("lexus-header", 16 / 9),
    clip("pgvXtdMshKqmetkpEhgM2k1TI", 1.333),
    still("elaguila-still-05", 16 / 9),
    still("malik-cross-still-02", 2.357),
    still("wppproduction-still-04", 16 / 9),
    clip("Ste489lG9zmVBFJeCYP9xDo", 0.5625),
    still("soapandglory-03", 1),
    still("elaguila-still-08", 16 / 9),
    clip("wppproduction-hero", 2.3529),
    still("wppproduction-still-06", 16 / 9),
    still("SKCYB8BMwkneaPvdQDQqhbuyVKE", 1),
    still("malik-cross-still-06", 2.35),
    clip("q65cZYQLVwWuvK4CaJ99qUKYaI0", 0.8),
    still("elaguila-still-01", 16 / 9),
    still("wichita-666-header", 16 / 9),
    still("soapandglory-02", 1),
    still("wppproduction-still-03", 16 / 9),
  ],
};

// Landing page background loop (an .mp4 with the same name is the Safari fallback).
export const hero = "/assets/anime-eye.webm";
export const heroPoster = "/assets/anime-eye-poster.webp";
