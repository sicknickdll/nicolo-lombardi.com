# nicolo-lombardi.com

Nicoló Lombardi's portfolio as a plain static website: every page is a
ready-made HTML file, so it runs on any static host (GitHub Pages, Cloudflare Pages, Netlify,
or plain FTP hosting) and search engines can read every project.

```
template.html       page shell (header, "Menu" button, full-screen menu) used for every page
js/data.js          ← ALL CONTENT: projects, texts, videos, order of the Work list
js/views.js         page markup (landing, About, projects), shared by the browser and the generator
js/app.js           interactions: snap scrolling, carousels, About page
js/menu.js          the "Menu +" button and the full-screen menu (Work, About, Archive, Playground, Contact)
js/archive-data.js  ← ARCHIVE CONTENT: collections and their pieces (name, country, location, scans)
js/archive.js       archive collection page: infinite pannable grid, search bar, 3D viewer
js/card3d.js        the 3D card (tilt + glare, drag to turn it over)
js/head.js          About page: 3D head (follows the cursor, rotates on drag / two-finger scroll, reacts to taps)
js/vendor/three.js  the parts of three.js the head needs   (npm install && npm run vendor:three)
js/intro.js         landing intro: words rolling inside a ring of spinning frames
js/eye.js           landing video: the eye follows the cursor
js/galleries.js     video and image carousels on project pages
js/player.js        custom film interface: wheel scrub, bottom progress line, text controls
js/scramble.js      text "decode" effect for the About block of every project page
tools/build.mjs     generates the pages below + sitemap.xml   (npm run build)
tools/optimize-model.mjs  shrinks a 3D scan for the web (assets/about/head.glb)
tools/vendor-three.mjs    rebuilds js/vendor/three.js
tools/make-og-images.py  link-preview images in assets/og/
tools/prepare-video.sh   converts a new video into the needed formats
tools/make-intro-clips.sh  short, light loop clips for the landing intro (assets/intro/)
index.html, about/, work/<id>/   GENERATED pages, don't edit by hand
film/, visuals/     GENERATED redirects: old addresses forward to the Work list on the landing page
assets/             images (.webp), videos (.webm + .mp4 fallback), icons, previews, about/head.glb
CNAME, .nojekyll    GitHub Pages settings · _headers for Netlify / Cloudflare
404.html, robots.txt, sitemap.xml
```

Pages and addresses:

| Address | Page |
| --- | --- |
| `/` | landing video + the full-screen Work list (`/#work`) |
| `/about/` | bio, contact, clients, and the 3D head |
| `/work/<id>/` | one page per project, e.g. `/work/lexus/` |
| `/archive/` | the archive's collections |
| `/archive/la-barra/` | LA BARRA: diagonal infinite pannable grid of the cut-outs on black, search bar, 3D viewer (editorial layout) (`#<piece id>` opens one) |
| `/playground/` | in the menu, not built yet: shows the 404 page |

Old links from the previous site (`/#film`, `/#project/lexus`) and the old `/film/` and
`/visuals/` pages redirect to the new addresses.


## Preview on your computer

With Node installed: `npx serve .`, then open http://localhost:3000.
(Double-clicking `index.html` won't work: browsers block JavaScript modules from `file://`.)

## Changing content

Everything lives in **`js/data.js`**. The comment at the top explains each field.
**After any change, run `node tools/build.mjs`** to regenerate the pages and sitemap, then
commit and push.

- **Edit a text**: change `title`, `type` or `description` of the project. The first ~155
  characters of `description` become the Google snippet, so lead with what and for whom.
- **Reorder / hide projects**: edit `workOrder` at the bottom of the file.
- **Add a project**:
  1. Put a full-screen cover image in `assets/` (`.webp` or `.jpg`, ~2560 px wide).
  2. For each video run `tools/prepare-video.sh path/to/video.mov myproject-01` (needs `ffmpeg`).
  3. Copy an existing project block in `projects`, give it a new `id` (it becomes the address
     `/work/<id>/`), fill in the fields, and add the `id` to `workOrder`.
  4. `python3 tools/make-og-images.py` (link-preview image), then `node tools/build.mjs`.
- **Case layout** (WPP Production, El Águila, Malik Cross): a project with `stills` shows its
  film on top, the text, a two-column grid of stills (`img(path, width, height)`), then an
  optional "Behind the scenes" strip (`bts.images`, scrolls on its own) and an optional
  closing film (`closingVideo`, plays muted while on screen). Videos: `MAX=1440
  tools/prepare-video.sh <file> <name>` makes the .webm, .mp4, poster and thumbnail.
- **About text / contact**: edit `aboutMarkup()` in `js/views.js`, then rebuild.
- **Menu links**: edit the menu in `template.html`, then rebuild. When Archive or Playground
  exist, give them a page in `tools/build.mjs` like About.
- **3D head**: `npm install`, then `node tools/optimize-model.mjs scan.glb assets/about/head.glb`.
  If a new scan doesn't face the camera, change `FACE_TURN` at the top of `js/head.js`.
  The eyes, nose and mouth positions (`FACE` in `js/head.js`) are measured for this scan; a new
  scan needs them re-measured.
- **Archive pieces** (`js/archive-data.js`): export each scan on a transparent background
  (the originals were on black: the cut-out was made with a threshold + flood fill, see the
  commit that added LA BARRA), then save `<id>-front.webp` and `<id>-back.webp` (about 1400 px
  on the long side), plus `<id>-thumb.webp` (720 px), in `assets/archive/<collection>/`.
  `type` is the category shown in the viewer (Napkin, Sugar Sachet, Cup Holder…); a type containing
  "napkin" folds when clicked, anything else squeezes. `ratio` is front width ÷ height. Leave `country` / `location` empty if unknown (shows —).
  Fonts: Caslon Antique (`assets/fonts/`, used unmodified under its licence), Futura with Jost
  as fallback, Helvetica.
- **Head reactions** (`js/head.js`): drag or two-finger scroll rotates (too much = dizzy, eyes roll);
  move over the head = smile; tap an eye = hurt; tap the nose 3 times = it grows; tap the mouth =
  pucker; tap elsewhere = boop; press and hold, then pull = stretch (Mario 64); idle 14 s = sleeps.
- **Landing intro**: the words and the frames that orbit the name are `intro` in `js/data.js`.
  The frames' clips are 4-second, 360px cuts of the project videos: list a new one in
  `tools/make-intro-clips.sh`, run it, then add it to `intro.frames`. It plays when someone enters the site or reloads the landing page, not when they come back
  to it from another page; any click, tap or key skips it, and it never plays with reduced
  motion turned on.

Keep every file under 24 MB so it fits all free hosts.

## SEO checklist (after the site is live)

1. **Google Search Console** (search.google.com/search-console): add a *Domain* property for
   `nicolo-lombardi.com`, verify it with the TXT record it gives you (OVH → DNS zone → add TXT),
   then under *Sitemaps* submit `https://nicolo-lombardi.com/sitemap.xml`.
2. In *URL inspection*, request indexing for `/` and each `/work/…` page.
3. Link the site from Instagram bio, LinkedIn (Contact info + Featured), Vimeo and YouTube
   profiles. Ask collaborators and press to link to the project pages.
4. Test link previews: paste a project address into LinkedIn's Post Inspector.

## Hosting (GitHub Pages + OVH domain)

GitHub Pages is free, includes HTTPS, and redeploys automatically on every push.

### 1. Publish the site

1. This repository must be **public** (free GitHub Pages).
2. Repository **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a
   branch**, branch `main`, folder `/ (root)`, then **Save**.
3. In the same page, under *Custom domain*, enter `nicolo-lombardi.com` and **Save**.

### 2. Point the domain (OVHcloud control panel)

**Web Cloud → Domain names → nicolo-lombardi.com → DNS zone**:

| Action | Subdomain | Type | Target |
| --- | --- | --- | --- |
| Delete | *(empty)* | A | `162.159.143.30` (old ChatGPT host) |
| Delete | *(empty)* | A | `172.66.3.26` (old ChatGPT host) |
| Delete | `www` | A | `213.186.33.5` (OVH "site en construction" page) |
| Add | *(empty)* | A | `185.199.108.153` |
| Add | *(empty)* | A | `185.199.109.153` |
| Add | *(empty)* | A | `185.199.110.153` |
| Add | *(empty)* | A | `185.199.111.153` |
| Add | `www` | CNAME | `sicknickdll.github.io.` |

Leave the **MX** and **TXT** records alone (they belong to OVH e-mail and SPF).

Optional IPv6 (add AAAA records on the empty subdomain): `2606:50c0:8000::153`,
`2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

### 3. Turn on HTTPS

DNS changes take from a few minutes up to 24 h. Back in **Settings → Pages**, wait until the
domain check passes, then tick **Enforce HTTPS** (the certificate can take up to an hour to be
issued). `www.nicolo-lombardi.com` then redirects to `nicolo-lombardi.com` automatically.

Recommended: in your GitHub account **Settings → Pages → Add a domain** to *verify*
`nicolo-lombardi.com` (one TXT record at OVH). That stops anyone else from claiming the domain on
GitHub.

### 4. Finish

- Check `https://nicolo-lombardi.com` and `https://www.nicolo-lombardi.com` on desktop and phone.
- Remove the custom domain from the old ChatGPT site so nothing else claims it.

### Other hosts

Same folder, no changes needed:

- **Cloudflare Pages**: unlimited bandwidth, private repos OK. Using the bare domain requires
  moving the domain's nameservers from OVH to Cloudflare (Cloudflare copies the existing records).
- **Netlify**: drag-and-drop this folder at app.netlify.com/drop, then add the domain and point
  an `A` record to the IP Netlify shows.
