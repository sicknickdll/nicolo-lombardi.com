// Bundles the parts of three.js the About page head (js/head.js) uses into one small
// file, js/vendor/three.js, so the site needs no build step or CDN at run time.
//   npm install && node tools/vendor-three.mjs
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  stdin: {
    contents: `
      export { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight,
        Group, Vector2, Vector3, Matrix4, Ray, Plane, Raycaster, Box3, Sphere,
        BufferAttribute, SRGBColorSpace } from "three";
      export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
      export { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
    `,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "eof",
  target: "es2020",
  outfile: join(root, "js/vendor/three.js"),
});
console.log("Wrote js/vendor/three.js");
