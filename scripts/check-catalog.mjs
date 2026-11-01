import fs from "node:fs";
import path from "node:path";
import { CATALOG, CATEGORIES, FEATURED, TOTAL_OFFERS } from "../vitrine/catalog.js";

const errors = [];
const ids = new Set();
const offerIds = new Set();
const urls = new Map();

for (const product of CATALOG) {
  if (ids.has(product.id)) errors.push(`id duplicado: ${product.id}`);
  ids.add(product.id);
  if (!product.name || !product.tagline || !product.desc) errors.push(`texto incompleto: ${product.id}`);
  if (!product.offers.length) errors.push(`sem oferta: ${product.id}`);
  for (const file of [product.image, product.imageSmall]) {
    const local = path.join("vitrine", file.split("?")[0]);
    if (!fs.existsSync(local)) errors.push(`imagem ausente: ${local}`);
  }
  for (const offer of product.offers) {
    if (offerIds.has(offer.id)) errors.push(`oferta duplicada: ${offer.id}`);
    offerIds.add(offer.id);
    if (urls.has(offer.url)) errors.push(`url duplicada: ${offer.url} (${product.id} e ${urls.get(offer.url)})`);
    urls.set(offer.url, product.id);
    if (!/^https:\/\//.test(offer.url)) errors.push(`url não HTTPS: ${offer.url}`);
  }
}

if (TOTAL_OFFERS !== offerIds.size) errors.push(`contagem de ofertas divergente: ${TOTAL_OFFERS} vs ${offerIds.size}`);
if (!FEATURED.length) errors.push("nenhum destaque definido");
for (const product of FEATURED) {
  if (!ids.has(product.id)) errors.push(`destaque inexistente: ${product.id}`);
}
for (const category of CATEGORIES) {
  if (!CATALOG.some((product) => product.category === category.id)) errors.push(`categoria vazia: ${category.id}`);
}

if (errors.length) {
  console.error(`Catálogo inválido (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK ${CATALOG.length} produtos, ${TOTAL_OFFERS} ofertas únicas, ${CATEGORIES.length} categorias, ${FEATURED.length} destaques.`);
