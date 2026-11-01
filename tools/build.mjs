// Generates every page of the site from template.html + js/data.js:
//   index.html, about/index.html, work/<id>/index.html, privacy/index.html, sitemap.xml
// plus small redirect pages at the old /film/ and /visuals/ addresses.
// Each page gets its own title, description, preview image and structured data,
// with the content already in the HTML so Google can read it.
//
// Run after editing js/data.js or template.html:   node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projects, goatcounter } from "../js/data.js";
import {
  esc,
  work,
  fullName,
  homeMarkup,
  aboutMarkup,
  projectImages,
  projectMarkup,
} from "../js/views.js";

const SITE = "https://nicolo-lombardi.com";
const NAME = "Nicoló Lombardi";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(join(root, "template.html"), "utf8").replace(/^<!--.*?-->\n/, "");

const person = {
  "@type": "Person",
  "@id": `${SITE}/#person`,
  name: NAME,
  url: `${SITE}/`,
  image: `${SITE}/assets/og-image.jpg`,
  jobTitle: "AI Filmmaker, Creative Technologist and Art Director",
  email: "mailto:hello.nicolombardi@gmail.com",
  address: { "@type": "PostalAddress", addressLocality: "Madrid", addressCountry: "ES" },
  knowsAbout: [
    "AI filmmaking",
    "Art direction",
    "Generative AI video",
    "Virtual production",
    "VFX",
    "Motion design",
    "Sound design",
  ],
  sameAs: ["https://www.instagram.com/nickprods/", "https://www.linkedin.com/in/nicolo-lombardi/"],
};

// First sentences of a text, cut on a word boundary to fit a search snippet.
function summary(text, max = 158) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const sentence = cut.lastIndexOf(". ");
  return sentence > 80 ? cut.slice(0, sentence + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function head({ title, description, path, image, imageAlt, schema, preload }) {
  const url = SITE + path;
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": schema }, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/\n/g, "\n      ");
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    preload ? `<link rel="preload" as="image" href="${preload}" />` : "",
    `<script type="application/ld+json">\n      ${json}\n    </script>`,
  ]
    .filter(Boolean)
    .map((line) => "    " + line)
    .join("\n");
}

function write(path, headHTML, mainHTML, htmlClass = "") {
  const file = join(root, path, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    template
      .replace("{{HTMLCLASS}}", htmlClass ? ` class="${htmlClass}"` : "")
      .replace("{{HEAD}}", headHTML)
      .replace("{{MAIN}}", mainHTML)
      .replace(
        "{{ANALYTICS}}",
        goatcounter
          ? `    <script data-goatcounter="https://${goatcounter}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`
          : "",
      ),
  );
}

const breadcrumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: SITE + path,
  })),
});
const itemList = (list) => ({
  "@type": "ItemList",
  itemListElement: list.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE}/work/${p.id}/`,
    name: fullName(p),
  })),
});
const brands = [...new Set(projects.map((p) => p.brand))].slice(0, 5).join(", ");

// Landing page
write(
  "",
  head({
    title: `${NAME} — AI Filmmaker & Art Director in Madrid`,
    description: `AI filmmaker, creative technologist and art director based in Madrid. AI-native campaigns, TV commercials, VFX and virtual production for ${brands} and more.`,
    path: "/",
    image: "/assets/og-image.jpg",
    imageAlt: NAME,
    preload: "/assets/anime-eye-poster.webp",
    schema: [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: `${SITE}/`,
        name: NAME,
        publisher: { "@id": person["@id"] },
      },
      person,
      itemList(work),
    ],
  }),
  homeMarkup(),
);

// About page
write(
  "about",
  head({
    title: `About — ${NAME}, AI Filmmaker & Art Director`,
    description: `${NAME} is an AI filmmaker, creative technologist and art director based in Madrid, working with ${brands} and more.`,
    path: "/about/",
    image: "/assets/og-image.jpg",
    imageAlt: NAME,
    schema: [
      {
        "@type": "ProfilePage",
        url: `${SITE}/about/`,
        name: `About ${NAME}`,
        mainEntity: { "@id": person["@id"] },
      },
      breadcrumbs([
        [NAME, "/"],
        ["About", "/about/"],
      ]),
      person,
    ],
  }),
  aboutMarkup(),
  "light",
);

// The Film and Visuals lists now live on the landing page: their old addresses forward there.
for (const slug of ["film", "visuals"]) {
  const file = join(root, slug, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>${NAME}</title>
    <link rel="canonical" href="${SITE}/" />
    <meta http-equiv="refresh" content="0; url=/#work" />
    <script>location.replace("/#work");</script>
  </head>
  <body>
    <p><a href="/#work">See the work of ${NAME}</a></p>
  </body>
</html>
`,
  );
}

// One page per project
for (const p of projects) {
  const path = `/work/${p.id}/`;
  const og = existsSync(join(root, "assets/og", `${p.id}.jpg`))
    ? `/assets/og/${p.id}.jpg`
    : "/assets/og-image.jpg";
  write(
    `work/${p.id}`,
    head({
      title: `${fullName(p)} (${p.type}) — ${NAME}`,
      description: summary(p.description),
      path,
      image: og,
      imageAlt: fullName(p),
      schema: [
        {
          "@type": "CreativeWork",
          "@id": `${SITE}${path}#work`,
          url: SITE + path,
          name: fullName(p),
          headline: `${fullName(p)} — ${p.type}`,
          genre: p.type,
          description: p.description.replace(/\s+/g, " ").trim(),
          image: [SITE + og, ...projectImages(p).map((i) => SITE + i)],
          creator: { "@id": person["@id"] },
          about: { "@type": "Brand", name: p.brand },
          ...(p.externalVideo || p.youtube ? { sameAs: p.externalVideo || p.youtube } : {}),
        },
        breadcrumbs([
          [NAME, "/"],
          [fullName(p), path],
        ]),
        person,
      ],
    }),
    projectMarkup(p),
  );
}

// Sitemap (with images, so covers and stills can show in Google Images)
const today = new Date().toISOString().slice(0, 10);
// Privacy page
write(
  "privacy",
  head({
    title: `Privacy — ${NAME}`,
    description: `How ${NAME}'s portfolio handles your data: no cookies, no tracking, no forms.`,
    path: "/privacy/",
    image: "/assets/og-image.jpg",
    imageAlt: NAME,
    schema: [
      breadcrumbs([
        [NAME, "/"],
        ["Privacy", "/privacy/"],
      ]),
    ],
  }),
  `<article class="legal">
  <h1>Privacy</h1>
  <p class="legal-date">Last updated: ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>
  <h2>In short</h2>
  <p>This website does not use cookies, does not ask for personal data and does not sell or share anything about you.</p>
  <h2>Who is responsible</h2>
  <p>${NAME}, Madrid, Spain — <a href="mailto:hello.nicolombardi@gmail.com">hello.nicolombardi@gmail.com</a>.</p>
  <h2>Visitor statistics</h2>
  <p>${goatcounter ? "To understand which projects people look at, the site counts visits with GoatCounter, a privacy-friendly service that uses no cookies and stores no personal data or IP addresses." : "The site does not collect visitor statistics."}</p>
  <h2>Hosting</h2>
  <p>The site is hosted on GitHub Pages. Like any web server, GitHub may log technical data such as your IP address for security purposes. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's privacy statement</a>.</p>
  <h2>Embedded videos</h2>
  <p>Some projects embed videos from YouTube (in its privacy-enhanced "no cookie" mode) and Vimeo (with "do not track" enabled). When you press play, those services may process data according to their own privacy policies.</p>
  <h2>Contacting me</h2>
  <p>If you write to me by e-mail, I use your message only to reply. Ask me at any time to delete it.</p>
  <h2>Your rights</h2>
  <p>Under the GDPR you can ask to access, correct or delete any personal data I hold about you. Write to the address above.</p>
  <p><a href="/">← Back to the portfolio</a></p>
</article>`,
);

const pages = [
  ["/", ["/assets/og-image.jpg", ...work.map((p) => p.cover)]],
  ["/about/", []],
  ["/privacy/", []],
  ...projects.map((p) => [`/work/${p.id}/`, [p.cover, ...projectImages(p)]]),
];
writeFileSync(
  join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages
  .map(
    ([path, imgs]) => `  <url>
    <loc>${SITE}${path}</loc>
    <lastmod>${today}</lastmod>
${imgs.map((i) => `    <image:image><image:loc>${SITE}${i}</image:loc></image:image>`).join("\n")}
  </url>`,
  )
  .join("\n")}
</urlset>
`,
);
console.log(`Built ${pages.length} pages + sitemap.xml`);
