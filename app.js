import { SITE, CATALOG, CATEGORIES, CATEGORY_COUNTS, FEATURED, TOTAL_OFFERS, findProduct } from "./catalog.js";
import { initGlobe } from "./globe.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const API_ORIGIN = "https://vitrine-xpartner.contatodroppfy.workers.dev";

const API_BASE = (() => {
  const host = location.hostname;
  if (host.endsWith(".workers.dev") || host === "localhost" || host === "127.0.0.1") {
    return "";
  }
  return API_ORIGIN;
})();

const state = {
  query: "",
  category: "all",
  sort: "featured",
  unlocked: new Set(),
  lastLead: null,
};

try {
  const raw = sessionStorage.getItem("vp_unlocked");
  if (raw) state.unlocked = new Set(JSON.parse(raw));
} catch {
  /* storage blocked */
}

function persistUnlock(id) {
  state.unlocked.add(id);
  try {
    sessionStorage.setItem("vp_unlocked", JSON.stringify([...state.unlocked]));
  } catch {
    /* ignore */
  }
}

function toast(message, kind = "") {
  const stack = $("#toastStack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast${kind ? ` is-${kind}` : ""}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s ease, transform .3s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

function track(type, payload = {}) {
  const body = JSON.stringify({ type, ...payload });
  fetch(`${API_BASE}/api/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/* ---------------- Header + navigation ---------------- */

function initHeader() {
  const header = $("#siteHeader");
  const onScroll = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = $("#menuToggle");
  const nav = $("#primaryNav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav?.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---------------- Hero globe ---------------- */

function initHero() {
  const canvas = $("#neuralGlobe");
  if (!canvas) return;
  const start = () => initGlobe(canvas);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 800 });
  } else {
    setTimeout(start, 60);
  }
}

/* ---------------- Catalog filtering ---------------- */

const grid = $("#grid");
const cards = $$(".card", grid);
const resultCount = $("#resultCount");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const searchClear = $("#searchClear");
const sortSelect = $("#sortSelect");

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function applyFilters() {
  const q = normalize(state.query.trim());
  let shown = 0;
  for (const card of cards) {
    const matchQuery = !q || card.dataset.search.includes(q);
    const matchCat = state.category === "all" || card.dataset.cat === state.category;
    const visible = matchQuery && matchCat;
    card.hidden = !visible;
    if (visible) shown++;
  }
  if (resultCount) resultCount.innerHTML = `<strong>${shown}</strong> de ${CATALOG.length} oportunidades`;
  if (emptyState) emptyState.hidden = shown !== 0;
  if (searchClear) searchClear.classList.toggle("is-visible", Boolean(state.query));
  syncUrl();
}

function currentSort() {
  const attr = {
    featured: ["featured", "order"],
    offers: ["offers", "order"],
    name: ["name"],
    category: ["cat", "name"],
  }[state.sort] || ["featured", "order"];

  return (a, b) => {
    for (const key of attr) {
      if (key === "featured") {
        const diff = Number(b.dataset.featured) - Number(a.dataset.featured);
        if (diff) return diff;
      } else if (key === "offers") {
        const diff = Number(b.dataset.offers) - Number(a.dataset.offers);
        if (diff) return diff;
      } else if (key === "name") {
        const diff = collator.compare(a.dataset.name, b.dataset.name);
        if (diff) return diff;
      } else if (key === "cat") {
        const diff = collator.compare(a.dataset.cat, b.dataset.cat);
        if (diff) return diff;
      } else if (key === "order") {
        const diff = Number(a.dataset.order) - Number(b.dataset.order);
        if (diff) return diff;
      }
    }
    return 0;
  };
}

function applySort() {
  const sorted = [...cards].sort(currentSort());
  const frag = document.createDocumentFragment();
  for (const card of sorted) frag.appendChild(card);
  grid.appendChild(frag);
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.category !== "all") params.set("cat", state.category);
  if (state.sort !== "featured") params.set("sort", state.sort);
  const next = params.toString();
  history.replaceState(null, "", next ? `?${next}` : location.pathname);
}

function setCategory(id) {
  state.category = id;
  for (const chip of $$(".cat-chip")) {
    const active = chip.dataset.cat === id;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  }
  applyFilters();
}

let searchTimer = 0;
function initFilters() {
  const initial = new URLSearchParams(location.search);
  if (initial.get("q")) state.query = initial.get("q");
  if (initial.get("cat") && CATEGORIES.some((c) => c.id === initial.get("cat"))) {
    state.category = initial.get("cat");
  }
  if (["featured", "offers", "name", "category"].includes(initial.get("sort"))) {
    state.sort = initial.get("sort");
  }
  if (searchInput) searchInput.value = state.query;
  if (sortSelect) sortSelect.value = state.sort;

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value;
      applyFilters();
    }, 110);
  });

  searchClear?.addEventListener("click", () => {
    state.query = "";
    searchInput.value = "";
    searchInput.focus();
    applyFilters();
  });

  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value;
    applySort();
    applyFilters();
  });

  for (const chip of $$(".cat-chip")) {
    chip.addEventListener("click", () => setCategory(chip.dataset.cat));
  }

  for (const link of $$("[data-cat-link]")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setCategory(link.dataset.catLink);
      $("#explorar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  $("#emptyReset")?.addEventListener("click", () => {
    state.query = "";
    state.sort = "featured";
    if (searchInput) searchInput.value = "";
    if (sortSelect) sortSelect.value = "featured";
    setCategory("all");
    applySort();
    applyFilters();
  });

  setCategory(state.category);
  applySort();
  applyFilters();

  const toolbar = $("#toolbar");
  if (toolbar) {
    const io = new IntersectionObserver(
      ([entry]) => toolbar.classList.toggle("is-stuck", !entry.isIntersecting),
      { rootMargin: "-68px 0px 0px 0px", threshold: 0 },
    );
    const marker = document.createElement("div");
    marker.style.cssText = "position:absolute;top:-1px;height:1px;width:1px;";
    toolbar.parentElement?.insertBefore(marker, toolbar);
    io.observe(marker);
  }
}

/* ---------------- Product dialog ---------------- */

const productDialog = $("#productDialog");
const productBody = $("#productContent");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const paths = {
    arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name] || paths.arrow;
  return svg;
}

function openProduct(id, trigger) {
  const product = findProduct(id);
  if (!product || !productDialog) return;

  productBody.replaceChildren();

  const visual = el("div", "product-visual");
  const img = document.createElement("img");
  img.src = product.image;
  img.alt = product.imageAlt;
  img.width = 960;
  img.height = 600;
  visual.appendChild(img);

  const content = el("div", "product-content");

  const cat = el("span", "product-cat");
  const dot = el("i", "dot");
  dot.style.background = product.categoryColor;
  dot.style.boxShadow = `0 0 10px ${product.categoryColor}`;
  cat.append(dot, document.createTextNode(product.categoryLabel));
  content.appendChild(cat);

  content.appendChild(el("h2", "", product.name));
  content.appendChild(el("p", "product-tagline", product.tagline));
  content.appendChild(el("p", "product-desc", product.desc));

  if (product.notice) {
    const box = el("div", "notice-box");
    box.append(icon("alert"), el("span", "", product.notice));
    content.appendChild(box);
  }

  if (product.coupon) {
    const box = el("div", "notice-box");
    box.style.borderColor = "rgba(52,211,153,.35)";
    box.style.background = "rgba(52,211,153,.08)";
    box.style.color = "#a7f3d0";
    box.append(icon("spark"), el("span", "", `Cupom exclusivo: ${product.coupon} — use na finalização.`));
    content.appendChild(box);
  }

  const tags = el("div", "product-tags");
  for (const tag of product.tags.slice(0, 6)) tags.appendChild(el("span", "tag", tag));
  content.appendChild(tags);

  content.appendChild(el("p", "offer-label", product.offerCount === 1 ? "Link oficial" : `${product.offerCount} acessos disponíveis`));

  const list = el("div", "offer-list");
  for (const offer of product.offers) {
    const button = el("button", "offer");
    button.type = "button";
    button.dataset.offer = offer.id;
    button.append(el("span", "offer-num", String(product.offers.indexOf(offer) + 1)));

    const text = el("span", "offer-text");
    text.append(el("strong", "", offer.label));
    if (offer.note) text.append(el("span", "", offer.note));
    button.appendChild(text);

    const arrow = el("span", "offer-arrow");
    arrow.appendChild(icon("arrow"));
    button.appendChild(arrow);

    button.addEventListener("click", () => openLead(product, offer));
    list.appendChild(button);
  }
  content.appendChild(list);

  const note = el("p", "lead-note", "Links oficiais conferidos. Cadastro rápido para liberar o acesso.");
  content.appendChild(note);

  productBody.append(visual, content);
  productDialog.showModal();
  document.body.classList.add("no-scroll");
  productDialog.dataset.trigger = trigger?.dataset.id || "";
  productDialog.querySelector(".dialog-close")?.focus();
  track("product_view", { productId: product.id, offerCount: product.offerCount });
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.close();
  if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
}

function initProductDialog() {
  if (!productDialog) return;
  productDialog.addEventListener("close", () => {
    if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
  });
  productDialog.querySelector("[data-close]")?.addEventListener("click", () => closeDialog(productDialog));
  productDialog.addEventListener("click", (e) => {
    if (e.target === productDialog) closeDialog(productDialog);
  });
  productDialog.addEventListener("cancel", () => {
    if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
  });
}

/* ---------------- Lead capture ---------------- */

const leadDialog = $("#leadDialog");
const leadForm = $("#leadForm");
const leadStatus = $("#leadStatus");
const leadSubmit = $("#leadSubmit");
const leadSubmitLabel = $("#leadSubmitLabel");
const leadSuccess = $("#leadSuccess");
const leadFormWrap = $("#leadFormWrap");
let leadOffer = null;
let leadProduct = null;
let formStartedAt = 0;

const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

function digits(value) {
  return value.replace(/\D+/g, "");
}

function maskPhone(value) {
  const raw = digits(value).slice(0, 11);
  if (raw.length <= 2) return raw.length ? `(${raw}` : "";
  if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
}

function validateName(value) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 3) return "Informe seu nome completo.";
  if (!/^[\p{L}\s.'-]+$/u.test(clean)) return "Use apenas letras no nome.";
  if (clean.split(" ").length < 2) return "Informe nome e sobrenome.";
  if (/^(teste|test|asdf|fulano|cliente|nome|aaa+)$/i.test(clean)) return "Informe seu nome real.";
  return "";
}

function validateEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return "Informe um e-mail válido.";
  const [local, domain] = email.split("@");
  if (/(test|fake|asdf|aaa|exemplo|example)/.test(local) && !/teste\.real/.test(local)) {
    return "Use seu e-mail principal, não um endereço de teste.";
  }
  if (!domain.includes(".")) return "Informe um e-mail válido.";
  return "";
}

function validatePhone(value) {
  const raw = digits(value);
  if (raw.length !== 10 && raw.length !== 11) return "Informe DDD + número (10 ou 11 dígitos).";
  const ddd = Number(raw.slice(0, 2));
  if (!VALID_DDD.has(ddd)) return "DDD inválido.";
  const subscriber = raw.slice(2);
  if (/^(\d)\1+$/.test(subscriber)) return "Informe um número real.";
  if (raw.length === 11 && subscriber[0] !== "9") return "Celular deve começar com 9 após o DDD.";
  if (raw.length === 10 && !/^[2-5]/.test(subscriber)) return "Telefone fixo inválido.";
  return "";
}

const fields = {
  name: { input: $("#leadName"), validate: validateName },
  email: { input: $("#leadEmail"), validate: validateEmail },
  phone: { input: $("#leadPhone"), validate: validatePhone },
};

function setFieldError(key, message) {
  const field = fields[key];
  if (!field?.input) return;
  const wrap = field.input.closest(".field");
  const error = wrap?.querySelector(".field-error");
  if (error) error.textContent = message || "";
  wrap?.classList.toggle("has-error", Boolean(message));
  field.input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateForm() {
  let firstInvalid = null;
  for (const [key, field] of Object.entries(fields)) {
    const message = field.validate(field.input.value);
    setFieldError(key, message);
    if (message && !firstInvalid) firstInvalid = field.input;
  }
  return { valid: !firstInvalid, firstInvalid };
}

function openLead(product, offer) {
  if (state.unlocked.has(offer.id)) {
    track("offer_click", { productId: product.id, offerId: offer.id, mode: "unlocked" });
    window.open(offer.url, "_blank", "noopener");
    toast("Acesso liberado. Abrindo o site oficial…");
    return;
  }

  leadProduct = product;
  leadOffer = offer;

  $("#leadProductName").textContent = product.name;
  $("#leadOfferLabel").textContent = offer.label + (offer.note ? ` · ${offer.note}` : "");
  const thumb = $("#leadThumb");
  thumb.src = product.imageSmall;
  thumb.alt = product.imageAlt;

  leadFormWrap.hidden = false;
  leadSuccess.hidden = true;
  leadStatus.className = "lead-status";
  leadStatus.textContent = "";
  leadForm.reset();
  for (const key of Object.keys(fields)) setFieldError(key, "");
  leadSubmit.disabled = false;
  leadSubmitLabel.textContent = "Liberar acesso agora";

  leadDialog.showModal();
  document.body.classList.add("no-scroll");
  formStartedAt = performance.now();
  setTimeout(() => fields.name.input?.focus(), 60);
  track("lead_open", { productId: product.id, offerId: offer.id });
}

function openUnlockedUrl() {
  if (!state.lastLead) return;
  window.open(state.lastLead.url, "_blank", "noopener");
  closeDialog(leadDialog);
}

function finishLead(payload) {
  leadFormWrap.hidden = true;
  leadSuccess.hidden = false;
  $("#leadSuccessName").textContent = payload.name.split(" ")[0];
  const link = $("#leadOpenLink");
  link.href = payload.url;
  link.onclick = () => {
    track("offer_click", { productId: payload.productId, offerId: payload.offerId, mode: "success" });
  };
  $("#leadOpenLink span").textContent = `Abrir ${payload.productName}`;
  state.lastLead = payload;
  persistUnlock(payload.offerId);

  let seconds = 6;
  const counter = $("#leadCountdown");
  counter.textContent = `Abrindo automaticamente em ${seconds}s…`;
  const timer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(timer);
      counter.textContent = "Pronto! Use o botão acima para abrir.";
      return;
    }
    counter.textContent = `Abrindo automaticamente em ${seconds}s…`;
  }, 1000);
  const auto = setTimeout(() => {
    clearInterval(timer);
    if (!leadDialog.open) return;
    window.open(payload.url, "_blank", "noopener");
    counter.textContent = "Se o site não abriu, use o botão acima.";
  }, 6000);
  leadDialog.addEventListener("close", () => clearTimeout(auto), { once: true });
}

async function submitLead(e) {
  e.preventDefault();
  if (!leadOffer || !leadProduct) return;

  const { valid, firstInvalid } = validateForm();
  if (!valid) {
    firstInvalid?.focus();
    leadStatus.className = "lead-status is-error";
    leadStatus.textContent = "Confira os campos destacados para continuar.";
    return;
  }
  const consent = $("#leadConsent");
  if (!consent.checked) {
    leadStatus.className = "lead-status is-error";
    leadStatus.textContent = "Precisamos do seu consentimento para registrar o contato.";
    consent.focus();
    return;
  }

  const payload = {
    name: fields.name.input.value.trim().replace(/\s+/g, " "),
    email: fields.email.input.value.trim(),
    phone: fields.phone.input.value.trim(),
    productId: leadProduct.id,
    offerId: leadOffer.id,
    offerUrl: leadOffer.url,
    consent: true,
    company: $("#leadCompany").value,
    elapsed: Math.round(performance.now() - formStartedAt),
    source: "vitrine",
    page: location.pathname + location.search,
  };

  leadSubmit.disabled = true;
  leadSubmitLabel.textContent = "Validando seus dados…";
  leadStatus.className = "lead-status";
  leadStatus.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/api/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      if (data.field) setFieldError(data.field, data.message || "");
      leadStatus.className = "lead-status is-error";
      leadStatus.textContent = data.message || "Não foi possível validar agora. Tente novamente em instantes.";
      leadSubmit.disabled = false;
      leadSubmitLabel.textContent = "Tentar novamente";
      return;
    }

    finishLead({ ...payload, productName: data.productName || leadProduct.name, url: data.url || leadOffer.url, leadId: data.leadId });
    track("lead_submit", { productId: leadProduct.id, offerId: leadOffer.id, leadId: data.leadId });
    toast("Cadastro validado. Acesso liberado!", "success");
  } catch {
    leadStatus.className = "lead-status is-error";
    leadStatus.textContent = "Falha de conexão. Verifique sua internet e tente novamente.";
    leadSubmit.disabled = false;
    leadSubmitLabel.textContent = "Tentar novamente";
  }
}

function initLead() {
  if (!leadDialog) return;
  leadDialog.querySelector("[data-close]")?.addEventListener("click", () => closeDialog(leadDialog));
  leadDialog.addEventListener("click", (e) => {
    if (e.target === leadDialog) closeDialog(leadDialog);
  });
  leadDialog.addEventListener("close", () => {
    if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
  });
  leadForm?.addEventListener("submit", submitLead);
  $("#leadOpenLink")?.addEventListener("click", () => {
    setTimeout(() => closeDialog(leadDialog), 400);
  });

  fields.phone.input?.addEventListener("input", (e) => {
    const position = e.target.selectionStart === e.target.value.length;
    e.target.value = maskPhone(e.target.value);
    if (position) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  });

  for (const field of Object.values(fields)) {
    field.input?.addEventListener("blur", () => {
      if (!field.input.value) return;
      setFieldError(Object.keys(fields).find((k) => fields[k] === field), field.validate(field.input.value));
    });
  }
}

/* ---------------- AI consultant ---------------- */

const aiForm = $("#aiForm");
const aiInput = $("#aiInput");
const aiAnswer = $("#aiAnswer");
const aiMatches = $("#aiMatches");
const aiMatchesLabel = $("#aiMatchesLabel");

function renderMatches(ids, label = "Atalhos recomendados") {
  aiMatches.replaceChildren();
  for (const id of ids || []) {
    const product = findProduct(id);
    if (!product) continue;
    const button = el("button", "ai-match");
    button.type = "button";
    const img = document.createElement("img");
    img.src = product.imageSmall;
    img.alt = "";
    img.loading = "lazy";
    img.width = 26;
    img.height = 26;
    button.append(img, document.createTextNode(product.name));
    button.addEventListener("click", () => openProduct(product.id, button));
    aiMatches.appendChild(button);
  }
  if (aiMatchesLabel) {
    aiMatchesLabel.textContent = label;
    aiMatchesLabel.hidden = aiMatches.childElementCount === 0;
  }
}

async function askAi(question) {
  if (!aiAnswer) return;
  aiAnswer.classList.remove("is-empty");
  aiMatches.replaceChildren();
  if (aiMatchesLabel) aiMatchesLabel.hidden = true;
  aiAnswer.innerHTML = '<span class="ai-typing" aria-label="Consultando"><i></i><i></i><i></i></span>';
  try {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      aiAnswer.textContent = data.message || "O consultor está indisponível agora. Explore as categorias abaixo.";
      return;
    }
    aiAnswer.textContent = data.answer || "Não encontrei uma recomendação. Tente descrever seu objetivo com outras palavras.";
    renderMatches(data.matches);
  } catch {
    aiAnswer.textContent = "Não consegui falar com o consultor agora. Verifique sua conexão e tente novamente.";
  }
}

function initAi() {
  if (!aiForm) return;
  renderMatches(FEATURED.slice(0, 4).map((p) => p.id), "Destaques da vitrine");
  aiForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = aiInput.value.trim();
    if (question.length < 3) {
      aiInput.focus();
      return;
    }
    askAi(question);
  });
  for (const chip of $$(".chip-suggest")) {
    chip.addEventListener("click", () => {
      aiInput.value = chip.dataset.q || chip.textContent.trim();
      askAi(aiInput.value);
      $("#consultor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

/* ---------------- Command palette ---------------- */

const palette = $("#palette");
const paletteInput = $("#paletteInput");
const paletteList = $("#paletteList");
let paletteItems = [];
let paletteIndex = 0;

function buildPalette(query = "") {
  const q = normalize(query.trim());
  const matches = CATALOG.filter((p) => !q || p.search.includes(q)).slice(0, 40);
  paletteItems = matches;
  paletteIndex = 0;
  paletteList.replaceChildren();

  if (!matches.length) {
    paletteList.appendChild(el("div", "palette-empty", "Nenhuma oportunidade encontrada."));
    return;
  }

  matches.forEach((product, index) => {
    const button = el("button", "palette-item");
    button.type = "button";
    button.dataset.index = String(index);
    const img = document.createElement("img");
    img.src = product.imageSmall;
    img.alt = "";
    img.loading = "lazy";
    img.width = 40;
    img.height = 40;
    const text = el("span");
    text.append(el("strong", "", product.name), el("span", "", product.categoryLabel));
    button.append(img, text);
    button.addEventListener("click", () => {
      closePalette();
      openProduct(product.id, button);
    });
    button.addEventListener("pointermove", () => setPaletteIndex(index));
    paletteList.appendChild(button);
  });
  setPaletteIndex(0);
}

function setPaletteIndex(index) {
  paletteIndex = index;
  const items = $$(".palette-item", paletteList);
  items.forEach((item, i) => item.classList.toggle("is-active", i === index));
  items[index]?.scrollIntoView({ block: "nearest" });
}

function openPalette() {
  if (!palette) return;
  palette.showModal();
  document.body.classList.add("no-scroll");
  paletteInput.value = "";
  buildPalette("");
  setTimeout(() => paletteInput.focus(), 40);
}

function closePalette() {
  if (!palette?.open) return;
  palette.close();
  if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
}

function initPalette() {
  if (!palette) return;
  $("#searchTrigger")?.addEventListener("click", openPalette);
  $("#paletteClose")?.addEventListener("click", closePalette);
  palette.addEventListener("click", (e) => {
    if (e.target === palette) closePalette();
  });
  palette.addEventListener("close", () => {
    if (!$("dialog[open]")) document.body.classList.remove("no-scroll");
  });

  paletteInput.addEventListener("input", () => buildPalette(paletteInput.value));
  paletteInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteIndex(Math.min(paletteIndex + 1, paletteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteIndex(Math.max(paletteIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const product = paletteItems[paletteIndex];
      if (product) {
        closePalette();
        openProduct(product.id);
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openPalette();
    } else if (e.key === "/" && !typing && !$("dialog[open]")) {
      e.preventDefault();
      openPalette();
    }
  });
}

/* ---------------- Reveal ---------------- */

function initReveal() {
  const targets = $$(".reveal");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const t of targets) t.classList.add("is-visible");
    for (const c of cards) c.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(entry.target.classList.contains("card") ? "is-in" : "is-visible");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
  );
  for (const t of targets) io.observe(t);
  for (const c of cards) io.observe(c);
}

/* ---------------- Card interactions ---------------- */

function initCards() {
  grid?.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    openProduct(card.dataset.id, card);
  });
  grid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    openProduct(card.dataset.id, card);
  });
}

/* ---------------- Boot ---------------- */

initHeader();
initHero();
initFilters();
initProductDialog();
initLead();
initAi();
initPalette();
initReveal();
initCards();

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const dialog of $$("dialog[open]")) {
    if (dialog.id === "palette") closePalette();
    else closeDialog(dialog);
  }
});

window.addEventListener("load", () => {
  const skeleton = $("#heroSkeleton");
  skeleton?.remove();
});

if (typeof window !== "undefined") {
  window.VITRINE = { total: CATALOG.length, offers: TOTAL_OFFERS, categories: CATEGORY_COUNTS.length, site: SITE };
}
