import { copyFileSync, mkdirSync } from "node:fs";
const dest = "public/maplibre";
mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  copyFileSync("node_modules/maplibre-gl/dist/" + file, dest + "/" + file);
