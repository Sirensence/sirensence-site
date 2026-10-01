import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "./catalog-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "auto-catalog.json");
const sources = JSON.parse(await fs.readFile(path.join(root, "data", "release-sources.json"), "utf8"));
const links = JSON.parse(await fs.readFile(path.join(root, "data", "manual-links.json"), "utf8"));
const previousText = await fs.readFile(outputPath, "utf8").catch(() => "");
const previous = previousText ? JSON.parse(previousText) : null;

// All network requests and validation finish before touching the published file.
const catalog = await buildCatalog(sources, links, previous);
const output = JSON.stringify(catalog, null, 2) + "\n";
if (JSON.stringify(previous) === JSON.stringify(catalog)) {
  console.log("Sin cambios: " + catalog.releases.length + " lanzamientos revisados.");
} else {
  const temporary = outputPath + ".tmp";
  await fs.writeFile(temporary, output, "utf8");
  await fs.rename(temporary, outputPath);
  console.log("Actualizado: " + catalog.releases.length + " lanzamientos, " + catalog.releases.reduce((count, release) => count + release.tracks.length, 0) + " canciones.");
}
