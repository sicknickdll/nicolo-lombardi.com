// Bundles the parts of three.js the site uses (the About page head, js/head.js, and the Tarot
// Reader's table, js/tarot/scene.js) into one file, js/vendor/three.js, so the site needs no
// CDN at run time.
//   npm install && node tools/vendor-three.mjs
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  stdin: {
    contents: `
      export { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight,
        Group, Vector2, Vector3, Vector4, Matrix4, Plane, Raycaster, Mesh, PlaneGeometry, ShaderMaterial, TextureLoader,
        BufferAttribute, SRGBColorSpace } from "three";
      export { OrthographicCamera, Object3D, BoxGeometry, CylinderGeometry, LatheGeometry, ExtrudeGeometry,
        ShapeGeometry, Shape, BufferGeometry, Float32BufferAttribute, MeshLambertMaterial, MeshBasicMaterial,
        PointsMaterial, Points, CanvasTexture, WebGLRenderTarget, PointLight, AmbientLight, Color, Quaternion, Euler,
        NearestFilter, LinearFilter, RepeatWrapping, AdditiveBlending, DoubleSide, FrontSide, Fog } from "three";
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
