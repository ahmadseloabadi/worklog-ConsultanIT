// GitHub Pages tidak punya fallback SPA: salin index.html menjadi 404.html
// agar membuka /dashboard atau /reports langsung (atau reload) tetap bekerja.
import { copyFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
console.log("dist/404.html dibuat untuk fallback SPA GitHub Pages.");
