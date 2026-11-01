// Makes a scanned 3D model light enough for the web: welds and simplifies the mesh,
// shrinks the texture to 2048 px WebP and compresses the geometry (meshopt).
//   npm install && node tools/optimize-model.mjs input.glb assets/about/head.glb [ratio]
// ratio = share of triangles to keep (default 0.12: 509k-vertex scan → ~70k vertices).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, simplify, prune, textureCompress, meshopt } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const [input, output, ratio = "0.12"] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: node tools/optimize-model.mjs input.glb output.glb [ratio]");
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.0005 }),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [2048, 2048], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(output, doc);
console.log(`Wrote ${output}`);
