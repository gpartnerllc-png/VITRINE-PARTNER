import { CATALOG, findProduct } from "../vitrine/catalog.js";
import { CSP_HASH } from "./csp.js";

const DISPOSABLE = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com", "anonbox.net", "antichef.com",
  "binkmail.com", "bobmail.info", "burnermail.io", "deadaddress.com", "discard.email", "dispostable.com",
  "dropmail.me", "emailondeck.com", "fakeinbox.com", "fakemail.net", "getairmail.com", "getnada.com",
  "grr.la", "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de", "guerrillamail.info",
  "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "harakirimail.com", "inboxbear.com",
  "jetable.org", "mail-temporaire.fr", "mailcatch.com", "maildrop.cc", "mailinator.com", "mailinator.net",
  "mailnesia.com", "mintemail.com", "mohmal.com", "mytemp.email", "nada.email", "pokemail.net",
  "sharklasers.com", "spam4.me", "spambox.us", "spamgourmet.com", "temp-mail.io", "temp-mail.org",
  "tempail.com", "tempmail.com", "tempmail.net", "tempmailo.com", "throwawaymail.com", "trash-mail.com",
  "trashmail.com", "trashmail.de", "trashmail.net", "yopmail.com", "yopmail.fr", "yopmail.net",
  "example.com", "example.net", "example.org", "test.com", "teste.com", "localhost.com",
]);

const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const EVENT_TYPES = new Set(["page_view", "product_view", "lead_open", "lead_submit", "offer_click", "ai_query"]);
const AI_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.2-3b-instruct"];

const JSON_CT = "application/json; charset=utf-8";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": JSON_CT, "cache-control": "no-store", ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function withHeaders(response, extra) {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(extra)) merged.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

function securityHeaders(pathname) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'sha256-" + CSP_HASH + "'",
    "connect-src 'self' https://droppfy.com https://www.droppfy.com https://vitrine-xpartner.contatodroppfy.workers.dev",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  return {
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "cross-origin-opener-policy": "same-origin",
    "cache-control": "public, max-age=0, must-revalidate",
  };
}

async function readJson(request, limit = 4096) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > limit) throw new HttpError(413, "Cadastro muito grande.");
  const text = await request.text();
  if (text.length > limit) throw new HttpError(413, "Cadastro muito grande.");
  try {
    const data = JSON.parse(text || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, "Formato de dados inválido.");
  }
}

class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const clean = (value, max = 120) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const onlyDigits = (value) => String(value ?? "").replace(/\D+/g, "");

function validateName(value) {
  const name = clean(value, 90).replace(/\s+/g, " ");
  if (name.length < 3) throw new HttpError(422, "Informe seu nome completo.", "name");
  if (name.length > 90) throw new HttpError(422, "Nome muito longo.", "name");
  if (!/^[\p{L}\s.'-]+$/u.test(name)) throw new HttpError(422, "Use apenas letras no nome.", "name");
  if (name.split(" ").length < 2) throw new HttpError(422, "Informe nome e sobrenome.", "name");
  if (/^(teste|test|asdf|fulano|cliente|nome|aaa+|abc|xyz)\b/i.test(name)) {
    throw new HttpError(422, "Informe seu nome real.", "name");
  }
  return name;
}

function validateEmail(value) {
  const email = clean(value, 120).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    throw new HttpError(422, "Informe um e-mail válido.", "email");
  }
  const [local, domain] = email.split("@");
  if (local.length < 2) throw new HttpError(422, "E-mail inválido.", "email");
  if (/(^|\.)(test|teste|fake|asdf|aaa+|abc|exemplo|example|naoexiste)($|\.)/.test(local)) {
    throw new HttpError(422, "Use seu e-mail principal, não um endereço de teste.", "email");
  }
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`))) {
    throw new HttpError(422, "E-mails temporários não são aceitos. Use seu e-mail principal.", "email");
  }
  return { email, domain };
}

function normalizePhone(value) {
  const raw = onlyDigits(value);
  const local = raw.startsWith("55") && raw.length > 11 ? raw.slice(2) : raw;
  if (local.length !== 10 && local.length !== 11) {
    throw new HttpError(422, "Informe DDD + número (10 ou 11 dígitos).", "phone");
  }
  const ddd = Number(local.slice(0, 2));
  if (!VALID_DDD.has(ddd)) throw new HttpError(422, "DDD inválido.", "phone");
  const subscriber = local.slice(2);
  if (/^(\d)\1+$/.test(subscriber)) throw new HttpError(422, "Informe um número real.", "phone");
  if (local.length === 11 && subscriber[0] !== "9") {
    throw new HttpError(422, "Celular deve começar com 9 após o DDD.", "phone");
  }
  if (local.length === 10 && !/^[2-5]/.test(subscriber)) {
    throw new HttpError(422, "Telefone fixo inválido.", "phone");
  }
  return { e164: `+55${local}`, formatted: formatPhone(local) };
}

function formatPhone(local) {
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
}

async function sha256(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hit(env, key, limit, ttl) {
  const current = Number((await env.KV.get(key)) || 0) + 1;
  await env.KV.put(key, String(current), { expirationTtl: ttl });
  return current <= limit;
}

async function domainHasMail(domain, env) {
  const key = `mx:${domain}`;
  const cached = await env.KV.get(key);
  if (cached) return cached === "1";

  const ask = async (type) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { status: -1, answers: [] };
    const data = await res.json();
    return { status: Number(data.Status ?? -1), answers: Array.isArray(data.Answer) ? data.Answer : [] };
  };

  let ok = false;
  try {
    const mx = await ask("MX");
    if (mx.status === 3) {
      ok = false;
    } else if (mx.answers.some((a) => a.type === 15 || a.type === 5)) {
      ok = true;
    } else {
      const a = await ask("A");
      const aaaa = a.answers.length ? a : await ask("AAAA");
      ok = aaaa.answers.some((rec) => rec.type === 1 || rec.type === 28);
    }
  } catch {
    ok = true;
  }

  await env.KV.put(key, ok ? "1" : "0", { expirationTtl: ok ? 86400 : 3600 });
  return ok;
}

function resolveOffer(body) {
  if (body.productId && body.offerId) {
    const product = findProduct(clean(body.productId, 60));
    const offer = product?.offers.find((item) => item.id === body.offerId);
    if (!product || !offer) throw new HttpError(400, "Oportunidade não encontrada.");
    if (body.offerUrl && body.offerUrl !== offer.url) {
      throw new HttpError(400, "Link divergente. Recarregue a página e tente novamente.");
    }
    return { product, offer };
  }
  if (body.link) {
    const url = clean(body.link, 400);
    for (const product of CATALOG) {
      const offer = product.offers.find((item) => item.url === url);
      if (offer) return { product, offer };
    }
    throw new HttpError(400, "Link não autorizado.");
  }
  throw new HttpError(400, "Oportunidade não informada.");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyTelegram(env, lead) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const when = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const text = [
    "<b>🚀 Novo lead — Vitrine xPartner</b>",
    "",
    `<b>Nome:</b> ${escapeHtml(lead.name)}`,
    `<b>E-mail:</b> ${escapeHtml(lead.email)}`,
    `<b>WhatsApp:</b> ${escapeHtml(lead.phone)}`,
    `<b>Oportunidade:</b> ${escapeHtml(lead.productName)}`,
    `<b>Acesso:</b> ${escapeHtml(lead.offerLabel)}`,
    `<b>Origem:</b> ${escapeHtml(lead.source)}${lead.country ? ` · ${escapeHtml(lead.country)}` : ""}${lead.city ? `/${escapeHtml(lead.city)}` : ""}`,
    `<b>Quando:</b> ${escapeHtml(when)} (BRT)`,
    `<b>ID:</b> <code>${escapeHtml(lead.id)}</code>`,
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleLead(request, env) {
  const body = await readJson(request, 4096);

  if (clean(body.company)) {
    throw new HttpError(400, "Não foi possível validar o cadastro.");
  }
  const elapsed = Number(body.elapsed || 0);
  if (elapsed > 0 && elapsed < 1800) {
    throw new HttpError(400, "Muito rápido. Revise os dados e tente novamente.");
  }
  if (body.consent !== true) {
    throw new HttpError(422, "É necessário consentir com o tratamento dos dados.", "consent");
  }

  const name = validateName(body.name);
  const { email, domain } = validateEmail(body.email);
  const phone = normalizePhone(body.phone ?? body.whatsapp);

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = (await sha256(`${ip}:${env.IP_SALT || "vitrine-xpartner"}`)).slice(0, 32);

  const perMinute = await hit(env, `rl:m:${ipHash}`, 5, 60);
  if (!perMinute) throw new HttpError(429, "Muitas tentativas. Aguarde um minuto e tente novamente.");
  const perHour = await hit(env, `rl:h:${ipHash}`, 25, 3600);
  if (!perHour) throw new HttpError(429, "Limite de cadastros por hora atingido. Tente mais tarde.");
  const perEmail = await hit(env, `rl:e:${await sha256(email)}`, 6, 3600);
  if (!perEmail) throw new HttpError(429, "Limite de cadastros para este e-mail. Tente mais tarde.", "email");

  const { product, offer } = resolveOffer(body);

  const mailOk = await domainHasMail(domain, env);
  if (!mailOk) {
    throw new HttpError(422, "O domínio do e-mail não aceita mensagens. Confira o endereço.", "email");
  }

  const dedupeKey = `dd:${await sha256(`${email}|${phone.e164}|${offer.id}`)}`;
  if (await env.KV.get(dedupeKey)) {
    throw new HttpError(429, "Já recebemos este cadastro. Use o link liberado anteriormente.");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const source = clean(body.source, 40) || "vitrine";
  const page = clean(body.page, 200);
  const userAgent = clean(request.headers.get("user-agent"), 300);
  const country = clean(request.headers.get("cf-ipcountry"), 8);
  const city = clean(request.cf?.city, 60);

  await env.DB.prepare(
    `INSERT INTO leads (id, created_at, name, email, email_normalized, email_domain, phone, phone_e164,
      product_id, product_name, offer_id, offer_label, offer_url, source, page, user_agent, ip_hash,
      country, city, consent, status, telegram_sent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      createdAt,
      name,
      email,
      email,
      domain,
      phone.formatted,
      phone.e164,
      product.id,
      product.name,
      offer.id,
      offer.label,
      offer.url,
      source,
      page,
      userAgent,
      ipHash,
      country,
      city,
      1,
      "new",
      0,
    )
    .run();

  await env.KV.put(dedupeKey, id, { expirationTtl: 300 });

  const telegramSent = await notifyTelegram(env, {
    id,
    name,
    email,
    phone: phone.formatted,
    productName: product.name,
    offerLabel: offer.label,
    source,
    country,
    city,
  });

  if (telegramSent) {
    try {
      await env.DB.prepare("UPDATE leads SET telegram_sent = 1 WHERE id = ?").bind(id).run();
    } catch {
      /* non-blocking */
    }
  }

  return json({ ok: true, leadId: id, url: offer.url, productName: product.name, offerId: offer.id });
}

async function handleEvent(request, env) {
  const body = await readJson(request, 2048);
  const type = clean(body.type, 40);
  if (!EVENT_TYPES.has(type)) throw new HttpError(400, "Evento inválido.");

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = (await sha256(`${ip}:${env.IP_SALT || "vitrine-xpartner"}`)).slice(0, 32);
  const allowed = await hit(env, `rl:ev:${ipHash}`, 120, 3600);
  if (!allowed) return new Response(null, { status: 204 });

  const productId = clean(body.productId, 60) || null;
  const offerId = clean(body.offerId, 80) || null;
  const meta = clean(JSON.stringify({ path: clean(body.path, 120), offerCount: body.offerCount ?? null, leadId: body.leadId ?? null }), 400);

  await env.DB.prepare("INSERT INTO events (created_at, type, product_id, offer_id, meta) VALUES (?,?,?,?,?)")
    .bind(new Date().toISOString(), type, productId, offerId, meta)
    .run();

  return new Response(null, { status: 204 });
}

function catalogContext() {
  return CATALOG.map(
    (p) => `${p.id} | ${p.name} | ${p.categoryShort} | ${p.tagline} | tags: ${p.tags.slice(0, 4).join(", ")}`,
  ).join("\n");
}

async function handleAi(request, env) {
  if (!env.AI) throw new HttpError(503, "Consultor indisponível no momento.");
  const body = await readJson(request, 2048);
  const question = clean(body.question, 280);
  if (question.length < 4) throw new HttpError(422, "Descreva melhor o que você procura.");

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = (await sha256(`${ip}:${env.IP_SALT || "vitrine-xpartner"}`)).slice(0, 32);
  const allowed = await hit(env, `rl:ai:${ipHash}`, 40, 86400);
  if (!allowed) throw new HttpError(429, "Limite diário do consultor atingido. Explore as categorias no catálogo.");

  const system = [
    "Você é o consultor da Vitrine xPartner, um catálogo brasileiro de oportunidades de negócio.",
    "Responda em português do Brasil, em no máximo 70 palavras, com tom direto, cordial e sem promessas de ganho garantido.",
    "O campo answer deve ser uma frase completa, sem terminar em dois-pontos, explicando por que as oportunidades escolhidas atendem ao pedido.",
    "Escolha de 1 a 3 oportunidades do catálogo que realmente atendam ao pedido do usuário.",
    "Responda SOMENTE com um objeto JSON válido, sem markdown, no formato:",
    '{"answer":"frase completa explicando a recomendação","matches":["id-do-produto","id-do-produto"]}',
    "Use apenas ids existentes na lista. Se nada se encaixar, devolva matches vazio e explique.",
    "",
    "CATÁLOGO (id | nome | categoria | resumo | tags):",
    catalogContext(),
  ].join("\n");

  let raw = "";
  let lastError = "";
  for (const model of AI_MODELS) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
        max_tokens: 340,
        temperature: 0.3,
      });
      const value = typeof result === "string" ? result : result?.response;
      raw = typeof value === "string" ? value : value ? JSON.stringify(value) : "";
      if (raw) break;
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }
  if (!raw) {
    console.error("ai_error", lastError);
    throw new HttpError(503, "O consultor está indisponível agora. Tente novamente em instantes.");
  }

  let answer = "";
  let matches = [];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      answer = clean(parsed.answer, 500);
      matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    } catch {
      /* fall through */
    }
  }
  if (!answer) answer = clean(raw.replace(/```json|```/g, ""), 500) || "Não encontrei uma recomendação para esse pedido.";

  const valid = [];
  for (const id of matches) {
    const product = findProduct(String(id));
    if (product && !valid.includes(product.id)) valid.push(product.id);
    if (valid.length === 3) break;
  }

  try {
    await env.DB.prepare("INSERT INTO events (created_at, type, product_id, offer_id, meta) VALUES (?,?,?,?,?)")
      .bind(new Date().toISOString(), "ai_query", valid[0] || null, null, JSON.stringify({ q: question.length, n: valid.length }))
      .run();
  } catch {
    /* non-blocking */
  }

  return json({ ok: true, answer, matches: valid });
}

async function handleConfig(env) {
  let leads = 0;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM leads").first();
    leads = Number(row?.total || 0);
  } catch {
    /* database not ready */
  }
  return json({
    ok: true,
    products: CATALOG.length,
    offers: CATALOG.reduce((sum, p) => sum + p.offerCount, 0),
    categories: new Set(CATALOG.map((p) => p.category)).size,
    leads,
  });
}

async function handleHealth(env) {
  const checks = { d1: false, kv: false, ai: Boolean(env.AI) };
  try {
    await env.DB.prepare("SELECT 1").first();
    checks.d1 = true;
  } catch {
    /* ignore */
  }
  try {
    await env.KV.put("health", String(Date.now()), { expirationTtl: 60 });
    checks.kv = true;
  } catch {
    /* ignore */
  }
  const ok = checks.d1 && checks.kv;
  return json({ ok, checks, time: new Date().toISOString() }, ok ? 200 : 503);
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  if (method === "GET" && path === "/api/health") return handleHealth(env);
  if (method === "GET" && path === "/api/config") return handleConfig(env);
  if (method === "POST" && path === "/api/lead") return handleLead(request, env);
  if (method === "POST" && path === "/api/event") return handleEvent(request, env);
  if (method === "POST" && path === "/api/ai") return handleAi(request, env);

  throw new HttpError(404, "Rota não encontrada.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const cors = corsHeaders(request, env);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      try {
        const response = await route(request, env);
        return withHeaders(response, cors);
      } catch (error) {
        if (error instanceof HttpError) {
          return json({ ok: false, message: error.message, field: error.field }, error.status, cors);
        }
        console.error("unhandled", error?.message);
        return json({ ok: false, message: "Erro interno. Tente novamente em instantes." }, 500, cors);
      }
    }

    const response = await env.ASSETS.fetch(request);
    if (!response.headers.get("content-type")?.includes("text/html")) return response;
    return withHeaders(response, securityHeaders(url.pathname));
  },
};
