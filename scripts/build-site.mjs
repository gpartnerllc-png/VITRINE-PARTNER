import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SITE, CATALOG, CATEGORIES, TOTAL_OFFERS, CATEGORY_COUNTS } from "../vitrine/catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "vitrine");
const YEAR = new Date().getFullYear();
const ORIGIN = SITE.origin;
const API_ORIGIN = "https://vitrine-xpartner.contatodroppfy.workers.dev";
const WHATSAPP = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappMessage)}`;

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

function badgeClass(label) {
  const key = label.toLowerCase();
  if (key === "oficial") return "badge badge-cyan";
  if (key === "novo" || key === "oferta" || key === "ofertas") return "badge badge-gold";
  if (key === "aviso") return "badge badge-warn";
  return "badge";
}

function renderCard(product, index) {
  const badges = [];
  if (product.featured) {
    badges.push(`<span class="badge badge-gold"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.4L21 11l-6.8 2.6L12 20l-2.2-6.4L3 11l6.8-2.6L12 2Z"/></svg>Destaque</span>`);
  }
  for (const label of product.badges || []) {
    badges.push(`<span class="${badgeClass(label)}">${esc(label)}</span>`);
  }

  const loading = index < 4 ? "lazy" : "lazy";
  const offerLabel = product.offerCount === 1 ? "<strong>1</strong> acesso oficial" : `<strong>${product.offerCount}</strong> acessos oficiais`;

  return `<a class="card${product.featured ? " is-featured" : ""}" href="${esc(product.primaryUrl)}" data-id="${esc(product.id)}" data-cat="${esc(product.category)}" data-order="${product.order}" data-featured="${product.featured ? 1 : 0}" data-offers="${product.offerCount}" data-name="${esc(product.name)}" data-search="${esc(normalize(product.search))}" aria-label="${esc(product.name)} — ${esc(product.tagline)}. Ver ofertas" rel="noopener sponsored">
  <div class="card-media">
    <img src="${esc(product.imageSmall)}" srcset="${esc(product.imageSmall)} 480w, ${esc(product.image)} 960w" sizes="(max-width: 420px) 92vw, (max-width: 720px) 46vw, (max-width: 1080px) 31vw, 24vw" width="960" height="600" alt="${esc(product.imageAlt)}" loading="${loading}" decoding="async">
  </div>
  <div class="card-badges">${badges.join("")}</div>
  <div class="card-body">
    <span class="card-cat"><i class="dot" style="background:${product.categoryColor};color:${product.categoryColor}"></i>${esc(product.categoryShort)}</span>
    <h3>${esc(product.name)}</h3>
    <p class="card-tagline">${esc(product.tagline)}</p>
    <div class="card-foot">
      <span class="card-offers">${offerLabel}</span>
      <span class="card-go">${ARROW}</span>
    </div>
  </div>
</a>`;
}

function renderCategoryChips() {
  return CATEGORY_COUNTS.filter((cat) => cat.count > 0)
    .map(
      (cat) =>
        `<button class="cat-chip" type="button" data-cat="${esc(cat.id)}" aria-pressed="false"><span class="dot" style="background:${cat.color}"></span>${esc(cat.short)} <span class="count">${cat.count}</span></button>`,
    )
    .join("\n          ");
}

function renderFooterCategories() {
  return CATEGORIES.filter((cat) => CATEGORY_COUNTS.find((c) => c.id === cat.id)?.count)
    .slice(0, 6)
    .map((cat) => `<a href="?cat=${esc(cat.id)}#explorar" data-cat-link="${esc(cat.id)}">${esc(cat.short)}</a>`)
    .join("\n        ");
}

function buildJsonLd() {
  const itemList = {
    "@type": "ItemList",
    name: "Oportunidades Vitrine xPartner",
    numberOfItems: CATALOG.length,
    itemListElement: CATALOG.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: product.primaryUrl,
    })),
  };

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${ORIGIN}/#organization`,
        name: SITE.name,
        url: `${ORIGIN}/`,
        logo: `${ORIGIN}/icon-512.png`,
        sameAs: [`https://droppfy.com/`],
      },
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: SITE.name,
        inLanguage: "pt-BR",
        publisher: { "@id": `${ORIGIN}/#organization` },
      },
      {
        "@type": "CollectionPage",
        "@id": `${ORIGIN}/#page`,
        url: `${ORIGIN}/`,
        name: `${SITE.name} — ${CATALOG.length} oportunidades com links oficiais`,
        description: `Curadoria de ${CATALOG.length} oportunidades e ${TOTAL_OFFERS} links oficiais em logística, finanças, saúde, beleza, moda, telecom, imóveis e renda online.`,
        isPartOf: { "@id": `${ORIGIN}/#website` },
        inLanguage: "pt-BR",
        mainEntity: itemList,
      },
    ],
  });
}

function cspFor(hash) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'sha256-${hash}'`,
    `connect-src 'self' ${ORIGIN} ${API_ORIGIN}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const css = await fs.readFile(path.join(OUT, "styles.css"), "utf8");
const template = await fs.readFile(path.join(ROOT, "site/template.html"), "utf8");

const jsonLd = buildJsonLd();
const jsonLdHash = createHash("sha256").update(jsonLd).digest("base64");
const csp = cspFor(jsonLdHash);
const metaCsp = csp.replace(/;\s*frame-ancestors 'none'/, "");

const cards = CATALOG.map(renderCard).join("\n        ");

const html = template
  .replaceAll("{{CSS}}", css)
  .replaceAll("{{CARDS}}", cards)
  .replaceAll("{{CATEGORY_CHIPS}}", renderCategoryChips())
  .replaceAll("{{FOOTER_CATEGORIES}}", renderFooterCategories())
  .replaceAll("{{TOTAL_PRODUCTS}}", String(CATALOG.length))
  .replaceAll("{{TOTAL_OFFERS}}", String(TOTAL_OFFERS))
  .replaceAll("{{TOTAL_CATEGORIES}}", String(CATEGORIES.length))
  .replaceAll("{{YEAR}}", String(YEAR))
  .replaceAll("{{ORIGIN}}", ORIGIN)
  .replaceAll("{{WHATSAPP}}", WHATSAPP)
  .replaceAll("{{CSP}}", `<meta http-equiv="Content-Security-Policy" content="${metaCsp}">`)
  .replaceAll("{{JSONLD}}", `<script type="application/ld+json">${jsonLd}</script>`);

await fs.writeFile(path.join(OUT, "index.html"), html, "utf8");
await fs.writeFile(
  path.join(ROOT, "worker/csp.js"),
  `// Generated by scripts/build-site.mjs — do not edit by hand.\nexport const CSP_HASH = "${jsonLdHash}";\n`,
  "utf8",
);

/* ---------- Privacy / terms ---------- */

const privacyBody = `
<main class="container" style="padding:120px 22px 40px;max-width:820px">
  <a class="brand" href="./" style="margin-bottom:28px">
    <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
    <span><small>Vitrine</small>xPartner</span>
  </a>
  <p class="section-kicker">Transparência</p>
  <h1 style="font-family:var(--font-display);font-size:clamp(2rem,5vw,3rem);letter-spacing:-.04em;line-height:1.05;margin:0 0 12px">Privacidade &amp; termos</h1>
  <p style="color:var(--muted)">Última atualização: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}.</p>

  <h2 style="margin-top:38px">1. Quem somos</h2>
  <p>A Vitrine xPartner é um catálogo de indicação de produtos e serviços de terceiros. Nosso papel é apresentar oportunidades verificadas e encaminhar você ao site oficial do parceiro.</p>

  <h2>2. Dados que coletamos</h2>
  <p>Quando você solicita um acesso, coletamos nome, e-mail, WhatsApp, a oportunidade escolhida e informações técnicas de segurança (como endereço IP abreviado e navegador). Também registramos eventos de uso agregados, como visualizações de produto e cliques, para melhorar o catálogo.</p>

  <h2>3. Para que usamos</h2>
  <ul>
    <li>validar que o contato é real (formato de e-mail, domínio e DDD do telefone);</li>
    <li>liberar o link oficial solicitado;</li>
    <li>entrar em contato sobre a oportunidade escolhida, quando você autoriza;</li>
    <li>prevenir fraude, abuso e envio automatizado de cadastros.</li>
  </ul>

  <h2>4. Base legal</h2>
  <p>Tratamos seus dados com base no seu consentimento (art. 7º, I, da LGPD) e no legítimo interesse para segurança e prevenção a fraude (art. 7º, IX). Você pode revogar o consentimento a qualquer momento.</p>

  <h2>5. Compartilhamento</h2>
  <p>Os dados são armazenados em infraestrutura da Cloudflare e enviados à equipe xPartner por meio de canal privado de mensagens. Não vendemos seus dados. O parceiro escolhido só recebe seus dados se você mesmo os informar no site oficial dele.</p>

  <h2>6. Cookies e armazenamento local</h2>
  <p>Não usamos cookies de publicidade. Utilizamos armazenamento de sessão apenas para lembrar, durante a sua visita, quais acessos já foram liberados.</p>

  <h2>7. Seus direitos</h2>
  <p>Você pode solicitar confirmação, acesso, correção, portabilidade ou exclusão dos seus dados, além de revogar o consentimento. Fale com a gente pelo WhatsApp oficial informado no rodapé da vitrine.</p>

  <h2>8. Segurança</h2>
  <p>Adotamos validação de e-mail por registros de domínio, limite de requisições, proteção contra robôs e transporte criptografado. Nenhum sistema é 100% imune, mas trabalhamos para reduzir riscos continuamente.</p>

  <h2>9. Links de afiliado</h2>
  <p>Alguns links desta vitrine são links de afiliado. Isso significa que podemos receber uma comissão se você contratar um serviço após o clique — sem qualquer custo adicional para você. A curadoria não é influenciada por valores de comissão.</p>

  <h2>10. Contato</h2>
  <p>Dúvidas sobre privacidade ou sobre a vitrine: <a href="${esc(WHATSAPP)}" target="_blank" rel="noopener" style="color:var(--gold-soft)">fale no WhatsApp</a>.</p>

  <p style="margin-top:40px"><a class="btn btn-ghost" href="./">Voltar para a vitrine</a></p>
</main>`;

const simplePage = ({ title, description, body, canonical }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#05060a">
<style>${css}</style>
</head>
<body>
<div class="ambient" aria-hidden="true"></div>
${body}
<footer class="site-footer"><div class="container"><div class="footer-bottom" style="margin-top:0;border-top:0"><span>© ${YEAR} Vitrine xPartner</span><a href="./">${SITE.domain}</a></div></div></footer>
</body>
</html>`;

await fs.writeFile(
  path.join(OUT, "privacidade.html"),
  simplePage({
    title: "Privacidade & termos — Vitrine xPartner",
    description: "Como a Vitrine xPartner coleta, valida, usa e protege seus dados, conforme a LGPD.",
    canonical: `${ORIGIN}/privacidade.html`,
    body: privacyBody,
  }),
  "utf8",
);

const notFoundBody = `
<main class="container" style="min-height:74vh;display:grid;place-content:center;text-align:center;padding:120px 22px 40px">
  <p class="section-kicker" style="justify-content:center">Erro 404</p>
  <h1 style="font-family:var(--font-display);font-size:clamp(2.4rem,7vw,4rem);letter-spacing:-.045em;margin:0 0 10px">Essa página saiu da vitrine.</h1>
  <p style="color:var(--muted);margin:0 0 26px">O link pode ter mudado. Volte ao catálogo e encontre a oportunidade que procura.</p>
  <div><a class="btn btn-gold" href="./" style="height:48px;padding:0 26px">Voltar para a vitrine</a></div>
</main>`;

await fs.writeFile(
  path.join(OUT, "404.html"),
  simplePage({
    title: "Página não encontrada — Vitrine xPartner",
    description: "A página solicitada não existe. Volte ao catálogo da Vitrine xPartner.",
    canonical: `${ORIGIN}/404.html`,
    body: notFoundBody,
  }),
  "utf8",
);

await fs.writeFile(
  path.join(OUT, "manifest.webmanifest"),
  JSON.stringify(
    {
      name: "Vitrine xPartner",
      short_name: "Vitrine",
      description: "Oportunidades verificadas com links oficiais.",
      lang: "pt-BR",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#05060a",
      theme_color: "#05060a",
      icons: [
        { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "./favicon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2,
  ),
  "utf8",
);

await fs.writeFile(
  path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /vitrine/\nDisallow: /site/\nDisallow: /scripts/\nDisallow: /worker/\nDisallow: /migrations/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
  "utf8",
);

await fs.writeFile(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>${ORIGIN}/privacidade.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n</urlset>\n`,
  "utf8",
);

await fs.writeFile(
  path.join(OUT, "_headers"),
  `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=2592000
  X-Content-Type-Options: nosniff

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/*.js
  Cache-Control: public, max-age=0, must-revalidate

/*.css
  Cache-Control: public, max-age=0, must-revalidate
`,
  "utf8",
);

console.log(`index.html      ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
console.log(`produtos        ${CATALOG.length}`);
console.log(`ofertas         ${TOTAL_OFFERS}`);
console.log(`categorias      ${CATEGORIES.length}`);
console.log(`destaques       ${CATALOG.filter((p) => p.featured).length}`);
console.log(`csp sha256      ${jsonLdHash.slice(0, 16)}…`);
console.log(`privacidade     404.html manifest robots sitemap _headers`);
