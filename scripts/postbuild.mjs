// GitHub Pages tidak punya fallback SPA: salin index.html sebagai fallback
// dan buat entrypoint statis untuk rute publik yang perlu dibuka langsung.
import { copyFileSync, mkdirSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
for (const route of ["privacy-policy", "terms-of-service"]) {
  mkdirSync(`dist/${route}`, { recursive: true });
  copyFileSync("dist/index.html", `dist/${route}/index.html`);
}
console.log("Fallback SPA dan entrypoint halaman legal GitHub Pages dibuat.");
