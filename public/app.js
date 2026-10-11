const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function toast(message, { bag = false } = {}) {
  $("#toastText").textContent = message;
  $("#toastBag").hidden = !bag;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
$("#toastBag").addEventListener("click", () => {
  $("#toast").classList.remove("show");
  openBag();
});
const emptyMeasurements = () => ({
  unit: "cm",
  back: "",
  chest: "",
  neck: "",
  confirmed: false,
});
const state = {
  pets: [
    {
      id: "whispurr",
      name: "Whispurr",
      type: "Cat",
      photos: [],
      note: "",
      twinReady: false,
      designs: [],
      measurements: emptyMeasurements(),
    },
  ],
  activePetId: "whispurr",
  shopView: "pet",
  shopFilter: "all",
  ownerMode: "subtle",
  route: "landing",
  measureUnit: "cm",
  twinCreating: false,
  pdp: { slug: "cloud-bed", thumb: 0, qty: 1, pers: 0, trim: 0, acc: 0 },
  custSlug: null,
};
const activePet = () => state.pets.find((p) => p.id === state.activePetId);
const petName = (pet) => pet.name.trim() || "Your pet";
const SIGN_IN_URL = `/signin-with-chatgpt?return_to=${encodeURIComponent("/index.html#/studio")}`;
const safeId = (name) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36).slice(-4)}`;
const money = (amount, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number(amount));

// ---- Catalog: concept pieces from specialist makers (not orderable yet) ----
const PRODUCTS = [
  { slug: "cloud-bed", name: "The Cloud Bed", sub: "Washable canvas · embroidered", price: 128, audience: "pet", cat: "rest", badge: "Best fit", tint: "#ffe0cc" },
  { slug: "ribbon-scarf", name: "Ribbon Scarf", sub: "Silk twill · custom print", price: 42, audience: "pet", cat: "wear", badge: "Arcade-ready surface", tint: "#ffd6e5" },
  { slug: "everyday-harness", name: "Everyday Harness", sub: "Fit-matched · padded", price: 68, audience: "pet", cat: "walk", badge: "", tint: "#cdf2e2" },
  { slug: "portrait-bowl", name: "Portrait Bowl", sub: "Stoneware · dishwasher safe", price: 54, audience: "pet", cat: "dine", badge: "", tint: "#fff0b8" },
  { slug: "water-bottle", name: "Everyday Water Bottle", sub: "Stainless steel · 24 oz", price: 38, audience: "owner", badge: "Owner favorite", tint: "#d6ecff" },
  { slug: "sticker-pack", name: "Pet Personality Stickers", sub: "Weatherproof · 8-piece sheet", price: 14, audience: "owner", badge: "", tint: "#ffe3f0" },
  { slug: "market-tote", name: "Portrait Market Tote", sub: "Heavy canvas · printed or embroidered", price: 46, audience: "owner", badge: "Pattern-ready", tint: "#ffe0cc" },
  { slug: "phone-case", name: "Pocket Portrait Case", sub: "Protective shell · matte finish", price: 34, audience: "owner", badge: "", tint: "#e5ddff" },
];
const productBySlug = (slug) => PRODUCTS.find((p) => p.slug === slug);
const PERSONALIZATION = ["Name + portrait mark", "Name only", "Pattern only", "No personalization"];
const TRIMS = [
  ["#ff6b3d", "Clay"],
  ["#ffc93c", "Butter"],
  ["#14936c", "Sage"],
  ["#7c5cff", "Grape"],
];

// ---- Bag: kept on this device. Arcade lines can be checked out; concept lines can't yet ----
const BAG_KEY = "pawprint.bag.v1";
const bag = {
  lines: [],
  open: false,
  confirming: false,
  load() {
    try {
      this.lines = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
    } catch {
      this.lines = [];
    }
  },
  save() {
    try {
      localStorage.setItem(BAG_KEY, JSON.stringify(this.lines));
    } catch {
      // Private browsing or blocked storage: the bag still works for this visit.
    }
    renderBag();
  },
  add(line) {
    const existing = this.lines.find((l) => l.key === line.key);
    if (existing) existing.qty += line.qty;
    else this.lines.push(line);
    this.confirming = false;
    this.save();
  },
  count: () => bag.lines.reduce((n, l) => n + l.qty, 0),
};
function addConceptToBag(slug, qty = 1, persIndex = state.pdp.pers, trimIndex = state.pdp.trim) {
  const product = productBySlug(slug);
  const pers = PERSONALIZATION[persIndex];
  const trim = TRIMS[trimIndex][1];
  bag.add({
    key: `${slug}|${pers}|${trim}`,
    kind: "concept",
    slug,
    name: product.name,
    price: product.price,
    qty,
    detail: `${pers} · ${trim} trim`,
    tint: product.tint,
  });
  toast(`${product.name} added for ${petName(activePet())}`, { bag: true });
}
function addArcadeToBag(product) {
  if (!product || product.status !== "succeeded") return false;
  if (bag.lines.some((l) => l.key === `arcade|${product.id}`)) return true;
  bag.add({
    key: `arcade|${product.id}`,
    kind: "arcade",
    productId: product.id,
    name: product.title || product.categoryName,
    price: Number(product.unitPrice?.amount ?? 0),
    currency: product.unitPrice?.currency || "USD",
    qty: 1,
    detail: product.selectionLabel || "Made by Arcade",
    image: product.imageUrl || null,
    tint: "#e6f4ff",
  });
  return true;
}
function openBag({ confirming = false } = {}) {
  bag.open = true;
  bag.confirming = confirming;
  renderBag();
}
function closeBag() {
  bag.open = false;
  bag.confirming = false;
  renderBag();
}
function renderBag() {
  const count = bag.count();
  $("#bagCount").textContent = count;
  $("#bagHeadCount").textContent = `(${count})`;
  $("#bagDrawer").hidden = !bag.open;
  document.body.classList.toggle("overlay-open", bag.open || !$("#customizer").hidden);
  const has = bag.lines.length > 0;
  $("#bagEmpty").hidden = has;
  $("#bagLines").hidden = !has;
  $("#bagFoot").hidden = !has;
  if (!has) return;
  const name = petName(activePet()).toUpperCase();
  $("#bagLines").innerHTML = bag.lines
    .map(
      (l) => `<div class="bag-line">
        <span class="bag-thumb" style="--tint:${escapeHtml(l.tint || "#fff4e6")}">${l.image ? `<img src="${escapeHtml(l.image)}" alt="">` : escapeHtml(name)}</span>
        <div class="bag-line-body">
          <div><b>${escapeHtml(l.name)}</b><b>${money(l.price * l.qty, l.currency)}</b></div>
          <small>${escapeHtml(l.detail)}</small>
          ${l.kind === "concept" ? '<small class="concept-tag">Concept piece · not orderable yet</small>' : ""}
          <div class="bag-line-actions">
            <div class="mini-stepper"><button type="button" data-bag-dec="${escapeHtml(l.key)}" aria-label="Decrease quantity">−</button><span>${l.qty}</span><button type="button" data-bag-inc="${escapeHtml(l.key)}" aria-label="Increase quantity">+</button></div>
            <button type="button" class="remove-link" data-bag-remove="${escapeHtml(l.key)}">Remove</button>
          </div>
        </div>
      </div>`,
    )
    .join("");
  const subtotal = bag.lines.reduce((n, l) => n + l.price * l.qty, 0);
  $("#bagSubtotal").textContent = money(subtotal);
  const orderable = bag.lines.filter((l) => l.kind === "arcade");
  const concepts = bag.lines.length - orderable.length;
  const notice = $("#bagNotice");
  if (bag.confirming) {
    notice.hidden = false;
    notice.innerHTML =
      "This opens Arcade’s checkout in a new tab. Paying there places a real order that will be made and shipped." +
      (concepts ? `<br><br>${concepts} concept piece${concepts > 1 ? "s stay" : " stays"} in your bag; they can’t be ordered yet.` : "");
  } else if (!orderable.length) {
    notice.hidden = false;
    notice.textContent =
      "These are concept pieces from makers we haven’t connected yet, so they can’t be ordered. Make a real piece with Arcade from the shop or the Cubby.";
  } else notice.hidden = true;
  const checkout = $("#bagCheckout");
  checkout.disabled = !orderable.length;
  checkout.innerHTML = `${bag.confirming ? "Continue to secure checkout" : orderable.length && concepts ? `Checkout ${orderable.length} Arcade piece${orderable.length > 1 ? "s" : ""}` : "Checkout"} <span>→</span>`;
}
$("#bagLines").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const key = btn.dataset.bagInc || btn.dataset.bagDec || btn.dataset.bagRemove;
  const line = bag.lines.find((l) => l.key === key);
  if (!line) return;
  if (btn.dataset.bagInc) line.qty += 1;
  if (btn.dataset.bagDec) line.qty -= 1;
  if (btn.dataset.bagRemove || line.qty < 1) bag.lines = bag.lines.filter((l) => l !== line);
  bag.confirming = false;
  bag.save();
});
$$("[data-close-bag]").forEach((el) => el.addEventListener("click", closeBag));
$("#bagButton").addEventListener("click", () => openBag());
$("#bagCheckout").addEventListener("click", async (e) => {
  const lines = bag.lines.filter((l) => l.kind === "arcade");
  if (!lines.length) return;
  if (!bag.confirming) {
    bag.confirming = true;
    return renderBag();
  }
  // Open the tab synchronously so popup blockers allow it, then point it at Arcade.
  const tab = window.open("", "_blank");
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const { checkoutUrl } = await api("/api/checkouts", {
      method: "POST",
      body: { lines: lines.map((l) => ({ productId: l.productId, quantity: l.qty })) },
    });
    if (tab) {
      tab.opener = null;
      tab.location.href = checkoutUrl;
    } else location.href = checkoutUrl;
    closeBag();
    toast("Opened Arcade’s secure checkout in a new tab");
  } catch (error) {
    tab?.close();
    toast(error.message);
  } finally {
    btn.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (bag.open) closeBag();
  if (!$("#customizer").hidden) closeCustomizer();
  if (!$("#petModal").hidden) $("#petModal").hidden = true;
});

// ---- Routing ----
const routeAliases = {
  "": "landing",
  studio: "studio",
  pets: "studio",
  designs: "designs",
  brand: "designs",
  shop: "shop",
  collection: "shop",
  "for-you": "shop",
  product: "product",
  home: "home",
  space: "home",
  cubby: "home",
};
const hashPath = () => location.hash.replace(/^#\/?/, "").split("?")[0];
const hashParams = () => new URLSearchParams(location.hash.split("?")[1] || "");
function currentRoute() {
  return routeAliases[hashPath().split("/")[0]] || "landing";
}
function renderRoute() {
  const route = currentRoute();
  const changed = route !== state.route;
  state.route = route;
  document.body.dataset.route = route;
  $$("[data-route]").forEach((el) => (el.hidden = el.dataset.route !== route));
  const tab = route === "product" ? "shop" : route;
  $$("[data-nav-route]").forEach((link) => {
    const selected = link.dataset.navRoute === tab;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route === "shop") {
    const params = hashParams();
    if (["pet", "owner"].includes(params.get("view"))) state.shopView = params.get("view");
    if (params.get("filter")) state.shopFilter = params.get("filter");
    renderShop();
  }
  if (route === "product") {
    const slug = hashPath().split("/")[1];
    if (slug && slug !== state.pdp.slug) state.pdp = { slug, thumb: 0, qty: 1, pers: 0, trim: 0, acc: 0 };
    renderProduct();
  }
  if (route === "designs") updateReferenceOption();
  if (route === "home") renderCubby();
  if (route === "landing") requestAnimationFrame(fitHeroStage);
  closeBag();
  closeCustomizer();
  if (changed || route === "product") window.scrollTo({ top: 0, behavior: "auto" });
}
window.addEventListener("hashchange", renderRoute);

// ---- 01 Home ----
const HERO_TILES = [
  ["The Cloud Bed", "from $128", "#ffd6e5", "cloud-bed"],
  ["Everyday Harness", "from $68", "#ffc93c", "everyday-harness"],
  ["Market Tote", "from $46", "#d6ecff", "market-tote"],
  ["Portrait Bowl", "from $54", "#cdf2e2", "portrait-bowl"],
];
const CATEGORY_LINKS = [
  ["Rest", "#ffd6e5", "#/shop?view=pet&filter=rest"],
  ["Wear", "#ffc93c", "#/shop?view=pet&filter=wear"],
  ["Walk", "#cdf2e2", "#/shop?view=pet&filter=walk"],
  ["Dine", "#d6ecff", "#/shop?view=pet&filter=dine"],
  ["For you", "#e5ddff", "#/shop?view=owner"],
];
function productCard(product, { featured = false } = {}) {
  const name = petName(activePet()).toUpperCase();
  return `<article class="product-card">
    <a class="product-tile" style="--tint:${product.tint}" href="#/product/${product.slug}" aria-label="${escapeHtml(product.name)} details">
      <span class="tile-name">${featured ? escapeHtml(product.name) : escapeHtml(name)}</span>
      <span class="tile-shot">product shot · ${escapeHtml(product.name.toLowerCase())}</span>
      ${featured ? (product.badge ? `<span class="tile-badge">${escapeHtml(product.badge)}</span>` : "") : '<span class="tile-badge concept">Concept</span>'}
      <span class="tile-view">View details →</span>
    </a>
    <a class="product-meta" href="#/product/${product.slug}"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sub)}</small></span><b>${money(product.price)}</b></a>
    <div class="product-actions">
      <button type="button" class="btn btn-ink" data-add="${product.slug}">Add to bag</button>
      ${featured ? `<a class="btn btn-line" href="#/product/${product.slug}">Details</a>` : `<button type="button" class="btn btn-soft" data-customize="${product.slug}">Customize</button>`}
    </div>
  </article>`;
}
function renderHome() {
  $("#heroTiles").innerHTML = HERO_TILES.map(
    ([label, price, bg, slug]) => `<a class="hero-tile" style="--tile:${bg}" href="#/product/${slug}">${label}<span>${price}</span></a>`,
  ).join("");
  $("#categoryStrip").innerHTML = CATEGORY_LINKS.map(
    ([label, bg, href]) => `<a style="--tile:${bg}" href="${href}">${label}</a>`,
  ).join("");
  $("#featuredGrid").innerHTML = ["cloud-bed", "ribbon-scarf", "water-bottle", "market-tote"]
    .map((slug) => productCard(productBySlug(slug), { featured: true }))
    .join("");
}
// The hero scene is drawn on a 560px stage; scale it to the frame.
function fitHeroStage() {
  const frame = $("#heroFrame");
  if (frame.clientWidth) frame.style.setProperty("--stage-scale", frame.clientWidth / 560);
}
new ResizeObserver(fitHeroStage).observe($("#heroFrame"));
// Add to bag / customize buttons anywhere in the page.
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) addConceptToBag(add.dataset.add, 1, 0, 0);
  const customize = e.target.closest("[data-customize]");
  if (customize) openCustomizer(customize.dataset.customize);
});

// ---- 04 Shop ----
const PET_FILTERS = [
  ["all", "All"],
  ["wear", "Wear"],
  ["rest", "Rest"],
  ["walk", "Walk"],
  ["dine", "Dine"],
];
const OWNER_MODES = [
  ["subtle", "Quiet nod"],
  ["portrait", "Portrait"],
  ["pattern", "Full pattern"],
];
function renderShop() {
  const view = state.shopView,
    name = petName(activePet());
  $$(".shop-context-tabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.shopView === view));
  $("#shopEyebrow").textContent = view === "pet" ? `Recommended for ${name}` : "For their favorite person";
  $("#shopTitle").textContent = view === "pet" ? "A collection that already knows them." : "Carry a little piece of them.";
  const chips = view === "pet" ? PET_FILTERS : OWNER_MODES;
  const activeChip = view === "pet" ? state.shopFilter : state.ownerMode;
  $("#shopChips").innerHTML = chips
    .map(([key, label]) => `<button type="button" class="chip ${key === activeChip ? "active" : ""}" data-chip="${key}">${label}</button>`)
    .join("");
  renderShopGrid();
  const design = (activePet().arcadeDesigns || []).find((d) => d.id === state.shopDesignId && d.status === "succeeded");
  $("#appliedBanner").hidden = !design;
  if (design) $("#appliedBanner").innerHTML = `<span>Showing every piece in <b>${escapeHtml(design.name)}</b>, sized for ${escapeHtml(name)}.</span>`;
  renderArcadeShop();
}
// Pet filters map onto Arcade use cases (wear and walk are both "out").
const FILTER_USE_CASES = { rest: ["sleep"], wear: ["out"], walk: ["out"], dine: ["dine"] };
/** Arcade pieces first (real, orderable), then concept pieces, for the current view and filter. */
function renderShopGrid() {
  const view = state.shopView,
    filter = view === "pet" ? state.shopFilter : "all";
  const concepts = PRODUCTS.filter((p) => p.audience === view && (filter === "all" || p.cat === filter));
  const design = arcade.signedIn && arcade.configured ? shopDesign() : null;
  const arcadeItems = (arcade.catalog || []).filter(
    (item) => item.audience === view && (filter === "all" || FILTER_USE_CASES[filter]?.includes(item.useCase)),
  );
  const total = arcadeItems.length + concepts.length;
  $("#shopCount").textContent = `${total} piece${total === 1 ? "" : "s"}`;
  $("#shopGrid").innerHTML =
    arcadeItems.map((item) => arcadeProductCard(item, design)).join("") + concepts.map((p) => productCard(p)).join("");
}
$("#shopChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (!chip) return;
  if (state.shopView === "pet") state.shopFilter = chip.dataset.chip;
  else {
    state.ownerMode = chip.dataset.chip;
    toast(`${chip.textContent} treatment applied to owner products`);
  }
  renderShop();
});
$$(".shop-context-tabs button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.shopView = btn.dataset.shopView;
    history.replaceState(null, "", `#/shop?view=${state.shopView}`);
    renderShop();
  }),
);

// ---- 05 Product ----
const PDP_SHOTS = ["Front", "On pet", "Detail", "Scale"];
function fitProfileText(pet) {
  const m = pet.measurements;
  return m.confirmed ? "Measurement-calibrated" : "Photo estimate";
}
function renderProduct() {
  const product = productBySlug(state.pdp.slug) || PRODUCTS[0];
  const pet = activePet(),
    name = petName(pet),
    s = state.pdp;
  const total = money(product.price * s.qty);
  const accordion = [
    ["Materials & care", `${product.sub}. Personalization is printed or embroidered to order.`],
    ["Fit", `Built from ${name}’s fit profile (${fitProfileText(pet).toLowerCase()}). Add tape measurements in Pets for a more precise fit; every order gets a fit review before production.`],
    ["Making & delivery", "Each piece is sent to a vetted specialist once the fit is confirmed. Track every custom piece together after one checkout."],
  ];
  $("#product").innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/shop?view=${product.audience}">Shop</a><span>/</span><span>${product.audience === "pet" ? "For your pet" : "For you"}</span><span>/</span><b>${escapeHtml(product.name)}</b></nav>
    <div class="pdp-grid">
      <div class="pdp-gallery">
        <div class="pdp-main" style="--tint:${product.tint};--trim:${TRIMS[s.trim][0]}">
          <span class="tile-name">${escapeHtml(name.toUpperCase())}</span>
          <span class="tile-shot">${["product shot", "on-pet preview", "detail shot", "scale shot"][s.thumb]} · ${escapeHtml(product.name.toLowerCase())}</span>
          ${product.badge ? `<span class="tile-badge">${escapeHtml(product.badge)}</span>` : ""}
        </div>
        <div class="pdp-thumbs">${PDP_SHOTS.map((label, i) => `<button type="button" class="${i === s.thumb ? "active" : ""}" style="--tint:${product.tint}" data-pdp-thumb="${i}">${label}</button>`).join("")}</div>
      </div>
      <div class="pdp-info">
        <div>
          <p class="eyebrow">Made for ${escapeHtml(name)}</p>
          <h1>${escapeHtml(product.name)}</h1>
          <div class="price-line"><b>${total}</b><small>${escapeHtml(product.sub)}</small></div>
        </div>
        <div class="fit-note"><span>✓</span><span><b>Sized to ${escapeHtml(name)}’s fit profile</b><small>${fitProfileText(pet)}. Measurements checked before production.</small></span></div>
        <div class="control-group"><span class="control-label">Personalization</span><div class="option-grid">${PERSONALIZATION.map((label, i) => `<button type="button" class="${i === s.pers ? "active" : ""}" data-pdp-pers="${i}">${label}</button>`).join("")}</div></div>
        <div class="control-group"><span class="control-label">Thread / trim · <span style="font-weight:400">${TRIMS[s.trim][1]}</span></span><div class="trim-row">${TRIMS.map(([hex, label], i) => `<button type="button" class="swatch ${i === s.trim ? "active" : ""}" style="--swatch:${hex}" aria-label="${label}" data-pdp-trim="${i}"></button>`).join("")}</div></div>
        <div class="buy-row">
          <div class="qty-stepper"><button type="button" data-pdp-qty="-1" aria-label="Decrease quantity">−</button><span>${s.qty}</span><button type="button" data-pdp-qty="1" aria-label="Increase quantity">+</button></div>
          <button type="button" class="btn btn-ink btn-block" data-pdp-add>Add to bag <span>${total}</span></button>
        </div>
        <div class="check-row" style="color:var(--muted);font-weight:400;margin-top:-8px"><span>Made to order</span><span>Fit review before making</span><span>One checkout for every piece</span></div>
        <div class="pdp-accordion">${accordion.map(([title, body], i) => `<div><button type="button" data-pdp-acc="${i}" aria-expanded="${s.acc === i}">${title}<span>${s.acc === i ? "−" : "＋"}</span></button>${s.acc === i ? `<p>${escapeHtml(body)}</p>` : ""}</div>`).join("")}</div>
      </div>
    </div>`;
}
$("#product").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const s = state.pdp;
  if (btn.dataset.pdpThumb) s.thumb = Number(btn.dataset.pdpThumb);
  else if (btn.dataset.pdpPers) s.pers = Number(btn.dataset.pdpPers);
  else if (btn.dataset.pdpTrim) s.trim = Number(btn.dataset.pdpTrim);
  else if (btn.dataset.pdpQty) s.qty = Math.max(1, s.qty + Number(btn.dataset.pdpQty));
  else if (btn.dataset.pdpAcc) s.acc = s.acc === Number(btn.dataset.pdpAcc) ? -1 : Number(btn.dataset.pdpAcc);
  else if ("pdpAdd" in btn.dataset) return addConceptToBag(s.slug, s.qty, s.pers, s.trim);
  else return;
  renderProduct();
});

// ---- Quick customizer ----
function openCustomizer(slug) {
  state.custSlug = slug;
  state.pdp = { ...state.pdp, slug, pers: 0, trim: 0, qty: 1 };
  renderCustomizer();
  $("#customizer").hidden = false;
  renderBag();
}
function closeCustomizer() {
  $("#customizer").hidden = true;
  document.body.classList.toggle("overlay-open", bag.open);
}
function renderCustomizer() {
  const product = productBySlug(state.custSlug);
  if (!product) return;
  const s = state.pdp;
  $("#customizer .sheet").innerHTML = `
    <div class="sheet-head"><span><p class="eyebrow">Quick customizer</p><b id="customizerTitle">${escapeHtml(product.name)}</b></span><button type="button" class="close-btn" data-close-customizer aria-label="Close">×</button></div>
    <div class="cust-preview" style="--tint:${product.tint};--trim:${TRIMS[s.trim][0]}"><span>${escapeHtml(petName(activePet()).toUpperCase())}</span></div>
    <div class="control-group"><span class="control-label">Personalization</span><div class="option-grid">${PERSONALIZATION.map((label, i) => `<button type="button" class="${i === s.pers ? "active" : ""}" data-cust-pers="${i}">${label}</button>`).join("")}</div></div>
    <div class="control-group"><span class="control-label">Thread / trim · <span style="font-weight:400">${TRIMS[s.trim][1]}</span></span><div class="trim-row">${TRIMS.map(([hex, label], i) => `<button type="button" class="swatch ${i === s.trim ? "active" : ""}" style="--swatch:${hex}" aria-label="${label}" data-cust-trim="${i}"></button>`).join("")}</div></div>
    <button type="button" class="btn btn-ink btn-block" data-cust-add>Add to bag <span>${money(product.price)}</span></button>
    <a class="text-button" style="text-decoration:underline;text-align:center" href="#/product/${product.slug}">Open product details →</a>`;
}
$("#customizer").addEventListener("click", (e) => {
  if (e.target.closest("[data-close-customizer]")) return closeCustomizer();
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.custPers) state.pdp.pers = Number(btn.dataset.custPers);
  else if (btn.dataset.custTrim) state.pdp.trim = Number(btn.dataset.custTrim);
  else if ("custAdd" in btn.dataset) {
    addConceptToBag(state.custSlug, 1, state.pdp.pers, state.pdp.trim);
    return closeCustomizer();
  } else return;
  renderCustomizer();
});

// ---- 02 Pets ----
function renderSavedDesigns() {
  const wrap = $("#savedDesigns"),
    pet = activePet(),
    remote = pet.arcadeDesigns || [],
    local = pet.designs || [];
  const remoteButtons = remote.map(
    (d) =>
      `<button type="button" class="arcade-design ${d.id === state.activeDesignId ? "active" : ""} ${d.status}" data-design-id="${escapeHtml(d.id)}">${d.thumbnailUrl ? `<img src="${escapeHtml(d.thumbnailUrl)}" alt="">` : `<span>${d.status === "failed" ? "!" : "✦"}</span>`}${escapeHtml(d.name)}${d.status === "running" ? " · generating" : d.status === "failed" ? " · failed" : ""}</button>`,
  );
  const localButtons = local.map(
    (d, i) => `<button type="button" data-design-index="${i}"><span>✦</span>${escapeHtml(d.name)}</button>`,
  );
  wrap.innerHTML = remoteButtons.concat(localButtons).join("") || '<span class="empty-design">No saved designs yet</span>';
  $$("[data-design-id]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const design = remote.find((d) => d.id === btn.dataset.designId);
      setDesignMode("pattern");
      showArcadeDesign(design);
      toast(design.status === "failed" ? design.error || `${design.name} failed` : `${design.name} loaded`);
    }),
  );
  $$("[data-design-index]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const design = local[Number(btn.dataset.designIndex)];
      showArcadeDesign(null);
      $("#patternPrompt").value = design.prompt;
      $("#applyBrand").disabled = false;
      toast(`${design.name} loaded`);
    }),
  );
}
function syncPetUI() {
  const pet = activePet(),
    name = petName(pet),
    initial = name[0].toUpperCase();
  pet.designs = pet.designs || [];
  pet.measurements = pet.measurements || emptyMeasurements();
  state.measureUnit = pet.measurements.unit || "cm";
  if ($("#petName").value !== pet.name) $("#petName").value = pet.name;
  document.body.dataset.petType = (pet.type || "Other").toLowerCase();
  $("#petType").value = pet.type;
  $$(".name-copy").forEach((x) => (x.textContent = name.toUpperCase()));
  $$(".chat-pet-name, .pet-name-copy").forEach((x) => (x.textContent = name));
  $("#portraitName").textContent = name.toUpperCase();
  $$(".bandana").forEach((x) => (x.textContent = initial));
  $$(".unit-toggle button").forEach((x) => x.classList.toggle("active", x.dataset.unit === state.measureUnit));
  $$(".measurement-unit").forEach((x) => (x.textContent = state.measureUnit));
  $$(".measurement-input").forEach((input) => {
    const cm = pet.measurements[input.dataset.key];
    input.dataset.cm = cm;
    input.value =
      cm === "" ? "" : state.measureUnit === "cm" ? Number(Number(cm).toFixed(1)) : Number((Number(cm) / 2.54).toFixed(1));
  });
  $("#confirmMeasurements").checked = Boolean(pet.measurements.confirmed);
  renderPhotos();
  renderPetSwitcher();
  renderSavedDesigns();
  renderTwinCard();
  if (state.route === "shop") renderShop();
  if (state.route === "product") renderProduct();
}
function renderPetSwitcher() {
  const wrap = $("#petSwitcher");
  wrap.querySelectorAll(".pet-chip").forEach((x) => x.remove());
  state.pets.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pet-chip ${p.id === state.activePetId ? "active" : ""}`;
    b.dataset.petId = p.id;
    b.innerHTML = `<span class="pet-avatar">${escapeHtml(petName(p)[0].toUpperCase())}</span><span><b>${escapeHtml(petName(p))}</b><small>${p.id === state.activePetId ? "Active profile" : escapeHtml(p.type)}</small></span>`;
    b.addEventListener("click", () => {
      state.activePetId = p.id;
      state.activeDesignId = null;
      syncPetUI();
      showArcadeDesign(null);
      loadArcadeDesigns();
      loadPetMedia();
      toast(`Now designing for ${petName(p)}`);
    });
    wrap.insertBefore(b, $("#addPet"));
  });
}
$("#addPet").addEventListener("click", () => {
  $("#petModal").hidden = false;
  setTimeout(() => $("#newPetName").focus(), 50);
});
$("#closePetModal").addEventListener("click", () => ($("#petModal").hidden = true));
$("#petModalBackdrop").addEventListener("click", () => ($("#petModal").hidden = true));
$("#petForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#newPetName").value.trim();
  if (!name) return;
  const pet = {
    id: safeId(name),
    name,
    type: $("#newPetType").value,
    photos: [],
    note: "",
    twinReady: false,
    designs: [],
    measurements: emptyMeasurements(),
  };
  state.pets.push(pet);
  state.activePetId = pet.id;
  e.currentTarget.reset();
  $("#petModal").hidden = true;
  state.activeDesignId = null;
  syncPetUI();
  showArcadeDesign(null);
  loadArcadeDesigns();
  loadPetMedia();
  toast(`${name} has a new profile`);
});
$("#petName").addEventListener("input", (e) => {
  activePet().name = e.target.value;
  syncPetUI();
});
$("#petType").addEventListener("change", (e) => {
  activePet().type = e.target.value;
  syncPetUI();
});
function setMeasurementsOpen(open) {
  $("#measurements").hidden = !open;
  $("#measureToggle").setAttribute("aria-expanded", String(open));
  $("#measureIcon").textContent = open ? "−" : "＋";
}
$("#measureToggle").addEventListener("click", () => setMeasurementsOpen($("#measurements").hidden));
$$(".measurement-input").forEach((input) =>
  input.addEventListener("input", () => {
    const pet = activePet(),
      cm = input.value === "" ? "" : state.measureUnit === "cm" ? input.value : (Number(input.value) * 2.54).toFixed(2);
    input.dataset.cm = cm;
    pet.measurements[input.dataset.key] = cm;
    pet.measurements.confirmed = false;
    $("#confirmMeasurements").checked = false;
    renderTwinCard();
  }),
);
$$(".unit-toggle button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.measureUnit = btn.dataset.unit;
    activePet().measurements.unit = state.measureUnit;
    $$(".unit-toggle button").forEach((x) => x.classList.toggle("active", x === btn));
    $$(".measurement-input").forEach((input) => {
      const cm = input.dataset.cm;
      input.value =
        cm === "" ? "" : state.measureUnit === "cm" ? Number(Number(cm).toFixed(1)) : Number((Number(cm) / 2.54).toFixed(1));
    });
    $$(".measurement-unit").forEach((label) => (label.textContent = state.measureUnit));
    renderTwinCard();
  }),
);
$("#confirmMeasurements").addEventListener("change", (e) => {
  const complete = ["back", "chest", "neck"].every((key) => Number(activePet().measurements[key]) > 0);
  if (e.target.checked && !complete) {
    e.target.checked = false;
    toast("Enter back, chest, and neck before confirming");
    return;
  }
  activePet().measurements.confirmed = e.target.checked;
  renderTwinCard();
});
$("#adjustFit").addEventListener("click", () => {
  setMeasurementsOpen(true);
  $("#measureToggle").scrollIntoView({ behavior: "smooth", block: "center" });
});
$("#attachPhotos").addEventListener("click", () => $("#petPhotos").click());
$("#addAngle").addEventListener("click", () => $("#petPhotos").click());
const setStorageStatus = (message, tone = "") => {
  const el = $("#storageStatus");
  el.className = `storage-status ${tone}`.trim();
  el.innerHTML = message;
};
async function savePrivatePhoto(file, photo, pet) {
  setStorageStatus(`Saving ${escapeHtml(file.name)} privately…`, "saving");
  const form = new FormData();
  form.append("file", file);
  form.append("petId", pet.id);
  form.append("petName", petName(pet));
  form.append("petType", pet.type);
  try {
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      photo.status = "local-only";
      setStorageStatus(
        `<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to save photos privately. This preview stays on this device only.`,
        "error",
      );
      return false;
    }
    if (!response.ok) throw new Error(payload.error || "Private upload failed");
    photo.id = payload.photo.id;
    photo.deleteAfter = payload.photo.deleteAfter;
    photo.status = "stored";
    if (photo.removed) {
      // Removed while the upload was in flight.
      await deletePrivatePhoto(photo);
      return false;
    }
    const date = new Date(photo.deleteAfter).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    setStorageStatus(`Stored privately · automatic deletion on ${date}.`);
    return true;
  } catch (error) {
    photo.status = "local-only";
    setStorageStatus(`${escapeHtml(error.message)}. Preview remains on this device only.`, "error");
    return false;
  } finally {
    renderPhotos();
  }
}
async function deletePrivatePhoto(photo) {
  if (!photo.id) return;
  try {
    await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
  } catch {}
}
const fileToData = (file) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
$("#petPhotos").addEventListener("change", async (e) => {
  const pet = activePet(),
    files = [...e.target.files].slice(0, 8 - pet.photos.length);
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const photo = { name: file.name, url: await fileToData(file), size: file.size, demo: false, status: "saving" };
    pet.photos.push(photo);
    renderPhotos();
    await savePrivatePhoto(file, photo, pet);
  }
  e.target.value = "";
  if (files.length) toast(`${files.length} photo${files.length > 1 ? "s" : ""} attached`);
});
const DEMO_PHOTO_URL = "assets/whispurr-demo.jpg";
// Made earlier by Meshy image-to-3D from the demo photo, then simplified for the web.
const DEMO_TWIN_URL = "assets/whispurr-twin-storybook.glb";
$("#useDemoPhoto").addEventListener("click", async () => {
  const pet = activePet();
  if (pet.photos.some((photo) => photo.demo)) return toast("The demo photo is already attached");
  const demo = { name: "whispurr-demo.jpg", url: DEMO_PHOTO_URL, size: 0, demo: true, status: "saving" };
  pet.photos.push(demo);
  renderPhotos();
  // Saved like a real upload so the demo can drive the Meshy twin and stickers.
  try {
    const blob = await fetch(DEMO_PHOTO_URL).then((r) => r.blob());
    demo.size = blob.size;
    await savePrivatePhoto(new File([blob], demo.name, { type: blob.type || "image/jpeg" }), demo, pet);
  } catch {
    demo.status = "local-only";
  }
  toast("Photo attached · full body and face visible");
});
function photoStatusText(photo) {
  if (photo.status === "saving") return "Saving privately…";
  if (photo.status === "stored") return `${photo.demo ? "Full body and face visible · " : ""}stored privately for 30 days`;
  return "On this device only";
}
function renderPhotos() {
  const pet = activePet();
  $("#photoTray").innerHTML = pet.photos
    .map(
      (photo, i) =>
        `<div class="photo-row"><img src="${escapeHtml(photo.url)}" alt="${photo.demo ? "Demo photo of Whispurr" : "Pet photo"}"><span><b>${i === 0 ? "Photo attached" : `Extra angle ${i}`}</b><small>${escapeHtml(photoStatusText(photo))}</small></span><button type="button" data-remove-photo="${i}">Remove</button></div>`,
    )
    .join("");
  $("#photoOptions").hidden = pet.photos.length > 0;
  $("#addAngle").hidden = !pet.photos.length || pet.photos.length >= 8;
  updateReferenceOption();
  renderTwinCard();
}
$("#photoTray").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remove-photo]");
  if (!btn) return;
  const pet = activePet(),
    photo = pet.photos[Number(btn.dataset.removePhoto)];
  if (!photo) return;
  photo.removed = true;
  pet.photos = pet.photos.filter((x) => x !== photo);
  if (!pet.photos.length && !pet.twinJob) pet.twinReady = false;
  renderPhotos();
  await deletePrivatePhoto(photo);
  setStorageStatus(photo.id ? "Photo removed from private storage." : "Photo removed from this device.");
});
function measurementSummary(pet) {
  const m = pet.measurements,
    unit = state.measureUnit;
  if (!m.confirmed) return "Photo estimate";
  const show = (cm) => (unit === "cm" ? Number(Number(cm).toFixed(1)) : Number((Number(cm) / 2.54).toFixed(1)));
  return `Back ${show(m.back)} · Chest ${show(m.chest)} · Neck ${show(m.neck)} ${unit}`;
}
/** Draws the twin card and the Pets progress from the active pet's state. */
function renderTwinCard() {
  const pet = activePet(),
    photo = pet.photos[0],
    job = pet.twinJob;
  const inProgress = state.twinCreating || TWIN_IN_PROGRESS.includes(job?.status);
  const ready = pet.twinReady && !inProgress;
  $("#twinEmpty").hidden = Boolean(photo);
  $("#twinPhoto").hidden = !photo;
  if (photo && $("#twinPhoto").getAttribute("src") !== photo.url) $("#twinPhoto").src = photo.url;
  $("#twinSpinner").hidden = !inProgress;
  $(".twin-card").classList.toggle("twin-ready", ready);
  const pill = $("#twinStatus");
  pill.classList.toggle("ready", ready);
  pill.classList.toggle("received", !ready && Boolean(photo));
  if (!inProgress) pill.textContent = ready ? (job?.status === "ready" ? "3D twin ready" : "Twin ready") : photo ? "Photo received" : "Waiting for photos";
  $("#twinNextActions").hidden = !ready;
  const btn = $("#createTwin");
  btn.disabled = !pet.photos.length || inProgress;
  btn.innerHTML = `${inProgress ? "Creating your twin…" : pet.twinReady ? "Recreate twin" : "Create prototype twin"} <span>→</span>`;
  $("#twinDims").textContent = measurementSummary(pet);
  $("#fitProfile").textContent = fitProfileText(pet);
  const step = ready ? 3 : photo ? 2 : 1;
  $$(".flow-progress span").forEach((el, i) => {
    el.classList.toggle("done", i + 1 < step);
    el.classList.toggle("current", i + 1 === step);
    el.querySelector("b").textContent = i + 1 < step ? "✓" : String(i + 1);
  });
  showTwinModel(pet);
}
$("#createTwin").addEventListener("click", async () => {
  const pet = activePet(),
    error = $("#twinError");
  error.textContent = "";
  if (!pet.photos.length) {
    error.textContent = "Add at least one photo so we have a likeness to work from.";
    return;
  }
  const savedPhoto = pet.photos.find((photo) => photo.id);
  state.twinCreating = true;
  $("#twinStatus").textContent = "Creating…";
  renderTwinCard();
  try {
    if (savedPhoto?.demo) {
      // The demo photo already has a Meshy model, so demos don't spend credits.
      await sleep(1200);
      pet.twinJob = { id: "demo", status: "ready", progress: 100, modelUrl: DEMO_TWIN_URL, demo: true };
    } else if (savedPhoto) {
      const { job } = await api("/api/twin-jobs", { method: "POST", body: { petId: pet.id, photoId: savedPhoto.id } });
      pet.twinJob = job;
    } else {
      // Not saved privately (signed out): a local preview twin only.
      await sleep(1200);
      $("#pipelineState").hidden = false;
      $("#pipelineDetail").textContent = "Local preview · sign in to save the photo privately and build a real 3D twin with Meshy.";
    }
    pet.twinReady = true;
  } catch (jobError) {
    error.textContent = jobError.message;
  } finally {
    state.twinCreating = false;
  }
  renderTwinCard();
  if (TWIN_IN_PROGRESS.includes(pet.twinJob?.status)) {
    showTwinProgress(pet, pet.twinJob);
    pollTwin(pet, pet.twinJob.id);
    toast(`${petName(pet)}'s 3D twin is on its way`);
  } else if (pet.twinReady) toast(`${petName(pet)}'s twin is ready`);
});

// ---- 03 Designs: shared controls ----
$$(".style").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".style").forEach((x) => x.classList.toggle("active", x === btn));
  }),
);
$$(".palette button[data-color]").forEach((btn) =>
  btn.addEventListener("click", () => {
    btn.classList.toggle("selected");
    btn.setAttribute("aria-pressed", String(btn.classList.contains("selected")));
  }),
);
$("#newDesign").addEventListener("click", () => {
  showArcadeDesign(null);
  setArcadeStatus("");
  $("#applyBrand").disabled = true;
  $("#generatePattern").innerHTML = generateLabel();
  $("#patternPrompt").value = `A fresh design inspired by ${petName(activePet())}, playful shapes and warm colors.`;
  $$(".style").forEach((x, i) => x.classList.toggle("active", i === 0));
  toast("New design canvas ready");
});
async function saveLocalPreviewDesign(btn, reason) {
  btn.disabled = true;
  btn.innerHTML = "Generating… <span>✦</span>";
  $("#canvasHint").textContent = "generating a local preview…";
  await sleep(1200);
  const designs = activePet().designs || (activePet().designs = []),
    design = { name: `Preview ${designs.length + 1}`, prompt: $("#patternPrompt").value };
  designs.push(design);
  showArcadeDesign(null);
  $("#applyBrand").disabled = false;
  btn.disabled = false;
  btn.innerHTML = generateLabel();
  $("#canvasHint").textContent = "your design appears here";
  renderSavedDesigns();
  setArcadeStatus(`Preview only · ${reason}`, "warn");
  toast(`${design.name} saved as a preview for ${petName(activePet())}`);
}
$("#generatePattern").addEventListener("click", async (e) => {
  const pet = activePet(),
    btn = e.currentTarget;
  if (state.designMode === "lettering") return saveLettering(btn);
  if (state.designMode !== "pattern") return generateMeshyImage(btn);
  const prompt = $("#patternPrompt").value.trim();
  if (!prompt) return setArcadeStatus("Describe the design you want first.", "error");
  if (arcade.signedIn === false)
    return saveLocalPreviewDesign(btn, `<a href="${SIGN_IN_URL}">sign in</a> to generate with Arcade.`);
  if (arcade.configured === false) return saveLocalPreviewDesign(btn, "Arcade is not connected on this site yet.");
  const photo = storedPhoto(pet),
    usePhoto = Boolean(photo && $("#usePhotoReference").checked);
  btn.disabled = true;
  btn.innerHTML = "Generating… <span>✦</span>";
  $("#canvasHint").textContent = "generating with Arcade…";
  setArcadeStatus(usePhoto ? "Sharing the reference photo and starting the design…" : "Starting the design…");
  try {
    const { design } = await api("/api/designs", {
      method: "POST",
      body: {
        petKey: pet.id,
        petName: petName(pet),
        petType: pet.type,
        prompt,
        style: $(".style.active")?.dataset.style || "storybook",
        colors: selectedColors(),
        photoId: usePhoto ? photo.id : undefined,
        characterId: state.patternCharacterId || undefined,
      },
    });
    pet.arcadeDesigns = [design, ...(pet.arcadeDesigns || [])];
    if (state.pendingProduct && !state.pendingProduct.designId) state.pendingProduct.designId = design.id;
    state.activeDesignId = design.id;
    renderSavedDesigns();
    await pollArcadeDesign(pet, design.id);
  } catch (error) {
    state.pendingProduct = null;
    if (error.status === 401) {
      arcade.signedIn = false;
      return saveLocalPreviewDesign(btn, `<a href="${SIGN_IN_URL}">sign in</a> to generate with Arcade.`);
    }
    if (error.code === "ARCADE_NOT_CONFIGURED") {
      arcade.configured = false;
      return saveLocalPreviewDesign(btn, "Arcade is not connected on this site yet.");
    }
    if (error.status === 429 && error.payload?.designId) {
      setArcadeStatus("A design is still generating — showing it here.");
      state.activeDesignId = error.payload.designId;
      await pollArcadeDesign(pet, error.payload.designId);
    } else setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = generateLabel();
    $("#canvasHint").textContent = "your design appears here";
  }
});
$("#applyBrand").addEventListener("click", () => {
  const design = activeArcadeDesign();
  state.shopDesignId = design?.status === "succeeded" ? state.activeDesignId : null;
  location.hash = "#/shop";
  toast(design ? `${design.name} applied to the collection` : "Preview applied to the collection");
});

// ---- Arcade: real pattern generation, products, and checkout ----
const arcade = { signedIn: null, configured: null, catalog: null, products: {}, starting: new Set() };
const polling = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    ...(body
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    Object.assign(error, { status: response.status, code: payload.code, payload });
    throw error;
  }
  return payload;
}
const storedPhoto = (pet) => pet.photos.find((photo) => photo.id && !photo.removed);
const selectedColors = () =>
  $$(".palette button.selected[data-color]").map((btn) => btn.dataset.color);
const activeArcadeDesign = () =>
  (activePet().arcadeDesigns || []).find((d) => d.id === state.activeDesignId) || null;
const formatPrice = (price) =>
  price
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(
        Number(price.amount),
      )
    : "Price pending";
function setArcadeStatus(html, tone = "") {
  const el = $("#arcadeStatus");
  el.className = `arcade-status ${tone}`.trim();
  el.innerHTML = html;
}
function updateReferenceOption() {
  const photo = storedPhoto(activePet());
  // A sticker sheet is drawn from a character, so the photo opt-in doesn't apply.
  $("#arcadeReference").hidden = !photo || !["pattern", "character"].includes(state.designMode);
  if (!photo) $("#usePhotoReference").checked = false;
}
function showArcadeDesign(design) {
  const img = $("#arcadePattern"),
    canvas = $("#portraitCanvas");
  state.activeDesignId = design ? design.id : null;
  const ready = design?.status === "succeeded" && design.imageUrl;
  img.hidden = !ready;
  if (ready) {
    img.src = design.imageUrl;
    img.alt = `${design.name}: Arcade pattern for ${petName(activePet())}`;
    $("#patternPrompt").value = design.prompt;
  } else img.removeAttribute("src");
  canvas.classList.toggle("has-arcade-pattern", Boolean(ready));
  canvas.classList.toggle("brand-ready", Boolean(ready));
  $("#applyBrand").disabled = !ready;
  if (design?.status === "failed")
    setArcadeStatus(escapeHtml(design.error || "Arcade could not finish this design."), "error");
  renderSavedDesigns();
}
async function loadArcadeDesigns() {
  const pet = activePet();
  try {
    const { designs, configured } = await api(`/api/designs?petKey=${encodeURIComponent(pet.id)}`);
    arcade.signedIn = true;
    arcade.configured = configured;
    pet.arcadeDesigns = designs;
    if (pet === activePet()) renderSavedDesigns();
    designs.filter((d) => d.status === "running").forEach((d) => pollArcadeDesign(pet, d.id));
  } catch (error) {
    if (error.status === 401) arcade.signedIn = false;
  }
}
async function pollArcadeDesign(pet, designId) {
  if (polling.has(designId)) return;
  polling.add(designId);
  const started = Date.now();
  try {
    // Arcade asks for polls no faster than every 2 seconds; generation takes 1–2 minutes.
    while (Date.now() - started < 6 * 60 * 1000) {
      const seconds = Math.round((Date.now() - started) / 1000);
      if (pet === activePet() && state.activeDesignId === designId)
        setArcadeStatus(`<span class="arcade-spinner"></span>Arcade is generating the pattern · ${seconds}s`);
      await sleep(4000);
      let design;
      try {
        ({ design } = await api(`/api/designs/${encodeURIComponent(designId)}`));
      } catch (error) {
        if (error.status >= 500 || error.status === 429) continue;
        throw error;
      }
      pet.arcadeDesigns = (pet.arcadeDesigns || []).map((d) => (d.id === design.id ? design : d));
      if (design.status === "running") continue;
      if (pet === activePet()) {
        showArcadeDesign(design);
        if (design.status === "succeeded") {
          setArcadeStatus(`${escapeHtml(design.name)} is ready. Apply it to make real products.`, "ok");
          toast(`${design.name} is ready`);
        }
        if (state.pendingProduct?.designId === design.id) finishPendingProduct(design);
      }
      return;
    }
    if (pet === activePet())
      setArcadeStatus("Still generating. It will appear in saved designs when it's done.", "warn");
  } catch (error) {
    if (pet === activePet()) setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    polling.delete(designId);
  }
}

// Shop: real Arcade products made from the applied design.
function shopDesign() {
  const designs = activePet().arcadeDesigns || [];
  return (
    designs.find((d) => d.id === state.shopDesignId && d.status === "succeeded") ||
    designs.find((d) => d.status === "succeeded") ||
    null
  );
}
function setShopNote(html) {
  $$(".arcade-shop-note").forEach((el) => (el.innerHTML = html));
}
async function renderArcadeShop() {
  if (arcade.signedIn === null) await loadArcadeDesigns();
  try {
    await loadCatalog();
  } catch (error) {
    return setShopNote(escapeHtml(error.message));
  }
  const design = arcade.signedIn && arcade.configured ? shopDesign() : null;
  if (arcade.signedIn === false)
    setShopNote(`<a href="${SIGN_IN_URL}">Sign in</a> to make the Arcade pieces for real in ${escapeHtml(petName(activePet()))}’s pattern.`);
  else if (!arcade.configured) setShopNote("Arcade isn't connected on this site yet, so these pieces can't be made.");
  else if (!design) setShopNote(`<a href="#/designs">Create a pattern</a> to make the Arcade pieces in ${escapeHtml(petName(activePet()))}’s pattern.`);
  else setShopNote(`Arcade pieces use <b>${escapeHtml(design.name)}</b>. Make one, then check out everything that’s ready together.`);
  if (design && !arcade.products[design.id]) {
    try {
      const { products } = await api(`/api/arcade-products?designId=${encodeURIComponent(design.id)}`);
      arcade.products[design.id] = products;
      products.filter((p) => p.status === "running").forEach((p) => pollArcadeProduct(design.id, p.id));
    } catch (error) {
      setShopNote(escapeHtml(error.message));
    }
  }
  if (state.route === "shop") renderShopGrid();
}
/** An Arcade category as a full product card: Arcade's photo, then the made product's mockup and price. */
function arcadeProductCard(item, design) {
  const action = arcadeAction(item, design),
    product = action.product;
  const image = product?.imageUrl || item.imageUrl;
  const ready = product?.status === "succeeded";
  const note = product?.status === "failed" ? product.error || "Arcade couldn't build this" : product?.selectionLabel || item.note;
  return `<article class="product-card arcade-product-card">
    <div class="product-tile has-photo" style="--tint:#e6f4ff">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product?.title || item.name)}" loading="lazy">` : `<span class="tile-shot">${escapeHtml(item.name.toLowerCase())}</span>`}
      <span class="tile-badge arcade">${ready ? "Ready to order" : "Made by Arcade"}</span>
    </div>
    <div class="product-meta"><span><strong>${escapeHtml(product?.title || item.name)}</strong><small>${escapeHtml(note)}</small></span><b>${product?.unitPrice ? escapeHtml(formatPrice(product.unitPrice)) : '<small class="price-pending">Priced when made</small>'}</b></div>
    <div class="product-actions">${arcadeButton(action, item, design)}</div>
  </article>`;
}
// Make / ready buttons for Arcade pieces, shared by the shop and the Cubby.
document.addEventListener("click", (e) => {
  const make = e.target.closest("[data-make-category]");
  if (make && !make.disabled) makeArcadeProduct(make.dataset.designId, make.dataset.makeCategory);
  const ready = e.target.closest("[data-ready-product]");
  if (ready) {
    const product = Object.values(arcade.products).flat().find((p) => p.id === ready.dataset.readyProduct);
    if (addArcadeToBag(product)) openBag({ confirming: true });
  }
});
/** The action for one Arcade category given the current design and what's been made. */
function arcadeAction(item, design) {
  if (arcade.signedIn === false) return { label: "Sign in to make", tone: "soft", href: SIGN_IN_URL };
  if (!arcade.configured || !item.categoryId) return { label: "Arcade not connected", tone: "soft", disabled: true };
  if (!design) return { label: "Create a design first", tone: "soft", href: "#/designs" };
  const product = (arcade.products[design.id] || []).find((p) => p.categoryId === item.categoryId);
  if (arcade.starting.has(`${design.id}|${item.categoryId}`))
    return { label: "Setting up…", tone: "soft", disabled: true, spin: true, product };
  if (!product) return { label: "Make this piece", tone: "ink", make: true };
  if (product.status === "running") return { label: "Making…", tone: "soft", disabled: true, spin: true, product };
  if (product.status === "failed") return { label: "Try again", tone: "ink", make: true, product };
  return { label: "Ready · checkout", tone: "ready", ready: product.id, product };
}
function arcadeButton(action, item, design) {
  const cls = `arcade-btn ${action.tone}`;
  const label = `${action.spin ? '<span class="arcade-spinner"></span>' : ""}${escapeHtml(action.label)}`;
  if (action.href) return `<a class="${cls}" href="${escapeHtml(action.href)}">${label}</a>`;
  const data = action.make
    ? `data-make-category="${escapeHtml(item.categoryId)}" data-design-id="${escapeHtml(design.id)}"`
    : action.ready
      ? `data-ready-product="${escapeHtml(action.ready)}"`
      : "";
  return `<button type="button" class="${cls}" ${data} ${action.disabled ? "disabled" : ""}>${label}</button>`;
}
async function makeArcadeProduct(designId, categoryId) {
  const key = `${designId}|${categoryId}`;
  if (arcade.starting.has(key)) return;
  arcade.starting.add(key);
  refreshProductViews();
  const name = arcade.catalog?.find((c) => c.categoryId === categoryId)?.name || "piece";
  toast(`Arcade is setting up the ${name.toLowerCase()}. This can take a minute.`);
  try {
    const { product } = await api("/api/arcade-products", { method: "POST", body: { designId, categoryId } });
    const list = (arcade.products[designId] || []).filter((p) => p.categoryId !== categoryId);
    arcade.products[designId] = [product, ...list];
    if (product.status === "running") pollArcadeProduct(designId, product.id);
  } catch (error) {
    toast(error.message);
  } finally {
    arcade.starting.delete(key);
    refreshProductViews();
  }
}
async function pollArcadeProduct(designId, productId) {
  if (polling.has(productId)) return;
  polling.add(productId);
  const started = Date.now();
  try {
    while (Date.now() - started < 6 * 60 * 1000) {
      await sleep(4000);
      let product;
      try {
        ({ product } = await api(`/api/arcade-products/${encodeURIComponent(productId)}`));
      } catch (error) {
        if (error.status >= 500 || error.status === 429) continue;
        throw error;
      }
      arcade.products[designId] = (arcade.products[designId] || []).map((p) => (p.id === product.id ? product : p));
      if (product.status === "running") continue;
      refreshProductViews();
      if (product.status === "succeeded") toast(`${product.title || product.categoryName} is ready to order`);
      return;
    }
  } catch (error) {
    toast(error.message);
  } finally {
    polling.delete(productId);
  }
}
// ---- Meshy: characters and sticker sheets (2D), and the 3D twin ----
// A character is the pet's own illustrated art; sticker sheets (and patterns) are made from it.
state.designMode = "pattern";
state.patternCharacterId = null;
state.sheetSourceId = null;
const MESHY_MODES = ["character", "sheet"];
const generateLabel = () =>
  `${{ character: "Draw character with Meshy", sheet: "Make sticker sheet with Meshy", lettering: "Save lettering to gallery" }[state.designMode] || "Generate with Arcade"} <span>✦</span>`;
const petCharacters = (pet) => (pet.characters || []).filter((c) => c.kind === "character");
const readyCharacters = (pet) => petCharacters(pet).filter((c) => c.status === "succeeded");
const stickerSheets = (pet) => (pet.characters || []).filter((c) => c.kind === "sticker_sheet");
const DESIGN_NOTES = {
  pattern:
    "Arcade generates the repeat pattern, usually in 1–2 minutes. Each saved design can be made into real Arcade products from the shop.",
  character:
    "Meshy draws the character as a transparent PNG in about a minute. It joins the gallery below, ready to become stickers or a pattern.",
  sheet: "Meshy draws nine hand-drawn stickers of the chosen character on one transparent sheet, in about a minute.",
  lettering:
    "Lettering is stitched right here from single-line embroidery fonts: no AI and no credits. Save it to the gallery or download a transparent PNG.",
};
// Each mode keeps its own description, so pattern text never leaks into a character prompt.
state.promptByMode = {
  pattern: $("#patternPrompt").value,
  character: "Big round eyes, sitting proudly, extra fluffy tail.",
};
const PROMPT_LABELS = { pattern: "Or make it yours", character: "Describe their character" };
function setDesignMode(mode) {
  if (state.designMode in state.promptByMode) state.promptByMode[state.designMode] = $("#patternPrompt").value;
  state.designMode = mode;
  $$("[data-modes]").forEach((el) => (el.hidden = !el.dataset.modes.split(" ").includes(mode)));
  if (mode in state.promptByMode) $("#patternPrompt").value = state.promptByMode[mode];
  $("#promptLabel").textContent = PROMPT_LABELS[mode] || "";
  $$("[data-design-mode]").forEach((btn) => {
    const active = btn.dataset.designMode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const meshy = MESHY_MODES.includes(mode);
  $("#generatePattern").innerHTML = generateLabel();
  $$(".ref-provider").forEach((el) => (el.textContent = meshy ? "Meshy" : "Arcade"));
  $$(".ref-output").forEach((el) => (el.textContent = mode === "character" ? "character" : "pattern"));
  $("#designNote").textContent = DESIGN_NOTES[mode];
  $("#applyBrand").hidden = mode !== "pattern";
  $("#sheetOptions").hidden = mode !== "sheet";
  $("#portraitCanvas").classList.toggle("sticker-mode", meshy);
  $("#portraitCanvas").classList.toggle("lettering-mode", mode === "lettering");
  $("#letteringStage").hidden = mode !== "lettering";
  if (mode === "lettering") {
    if (!$("#letterText").value.trim()) $("#letterText").value = petName(activePet());
    renderLettering();
  }
  updateReferenceOption();
  renderSheetSources();
  renderPatternReference();
  setArcadeStatus("");
  const pet = activePet();
  const latest = (mode === "sheet" ? stickerSheets(pet) : readyCharacters(pet)).find((c) => c.status === "succeeded");
  showSticker(meshy ? latest : null);
}
$$("[data-design-mode]").forEach((btn) =>
  btn.addEventListener("click", () => setDesignMode(btn.dataset.designMode)),
);
function renderSheetSources() {
  const wrap = $("#sheetSources"),
    ready = readyCharacters(activePet());
  if (!ready.some((c) => c.id === state.sheetSourceId)) state.sheetSourceId = ready[0]?.id || null;
  wrap.innerHTML = ready.length
    ? ready
        .map(
          (c) =>
            `<button type="button" class="${c.id === state.sheetSourceId ? "active" : ""}" data-sheet-source="${escapeHtml(c.id)}" aria-pressed="${c.id === state.sheetSourceId}"><img src="${escapeHtml(c.imageUrl)}" alt="">${escapeHtml(c.name)}</button>`,
        )
        .join("")
    : '<span class="empty-design">Draw a character first — sticker sheets are made from one.</span>';
  $$("[data-sheet-source]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sheetSourceId = btn.dataset.sheetSource;
      renderSheetSources();
    }),
  );
}
function renderPatternReference() {
  const chip = $("#patternReference"),
    character = (activePet().characters || []).find((c) => c.id === state.patternCharacterId);
  if (!character) state.patternCharacterId = null;
  chip.hidden = state.designMode !== "pattern" || !character;
  if (character) {
    $("img", chip).src = character.imageUrl;
    $("b", chip).textContent = character.name;
  }
}
$("#patternReference button").addEventListener("click", () => {
  state.patternCharacterId = null;
  renderPatternReference();
});
function showSticker(asset) {
  const img = $("#stickerPreview");
  img.hidden = !asset?.imageUrl;
  if (asset?.imageUrl) {
    img.src = asset.imageUrl;
    img.alt = `${asset.name}: ${asset.kind === "sticker_sheet" ? "sticker sheet" : "character"} of ${petName(activePet())}`;
  }
  $("#portraitCanvas").classList.toggle("has-sticker", Boolean(asset?.imageUrl));
}
function galleryCard(asset) {
  if (asset.kind === "lettering")
    return `<figure class="sticker-card lettering"><div class="sticker-art"><img src="${escapeHtml(asset.imageUrl)}" alt="${escapeHtml(asset.name)}"></div><figcaption><b>${escapeHtml(asset.name)}</b><small>Embroidery · ${escapeHtml(asset.prompt)}</small><span><a href="${escapeHtml(asset.imageUrl)}?download=1">Download</a></span></figcaption></figure>`;
  const sheet = asset.kind === "sticker_sheet";
  const cls = `sticker-card${sheet ? " sheet" : ""}`;
  if (asset.status === "running")
    return `<figure class="${cls} pending"><div class="sticker-art"><span class="arcade-spinner"></span></div><figcaption><b>${escapeHtml(asset.name)}</b><small>Meshy is drawing…</small></figcaption></figure>`;
  if (asset.status === "failed")
    return `<figure class="${cls} failed"><div class="sticker-art">!</div><figcaption><b>${escapeHtml(asset.name)}</b><small>${escapeHtml(asset.error || "Couldn't be drawn")}</small></figcaption></figure>`;
  const source = sheet && (activePet().characters || []).find((c) => c.id === asset.sourceAssetId);
  const note = sheet
    ? `9 stickers${source ? ` · from ${source.name}` : ""}${asset.prompt ? ` · ${asset.prompt}` : ""}`
    : "Their own character";
  const actions = sheet
    ? `<a href="${escapeHtml(asset.imageUrl)}?download=1">Download sheet</a>`
    : `<a href="${escapeHtml(asset.imageUrl)}?download=1">Download</a><button type="button" data-make-sheet="${escapeHtml(asset.id)}">Make stickers</button><button type="button" data-use-character="${escapeHtml(asset.id)}">Use in a pattern</button><button type="button" data-pillow="${escapeHtml(asset.id)}">Put on a pillow</button>`;
  return `<figure class="${cls}"><div class="sticker-art"><img src="${escapeHtml(asset.imageUrl)}" alt="${escapeHtml(asset.name)}"></div><figcaption><b>${escapeHtml(asset.name)}</b><small>${escapeHtml(note)}</small><span>${actions}</span></figcaption></figure>`;
}
function renderStickerPack() {
  const pet = activePet(),
    items = [...petCharacters(pet), ...stickerSheets(pet), ...letterings(pet)];
  $("#stickerPack").classList.toggle("empty", !items.length);
  $("#stickerGrid").innerHTML = items.map(galleryCard).join("");
  $$("[data-make-sheet]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sheetSourceId = btn.dataset.makeSheet;
      setDesignMode("sheet");
      $("#portraitCanvas").scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Pick a remix theme, then make the sticker sheet");
    }),
  );
  $$("[data-use-character]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.patternCharacterId = btn.dataset.useCharacter;
      setDesignMode("pattern");
      $("#portraitCanvas").scrollIntoView({ behavior: "smooth", block: "start" });
      toast("The next Arcade pattern will be guided by this character");
    }),
  );
  $$("[data-pillow]").forEach((btn) => btn.addEventListener("click", () => putCharacterOnProduct(btn.dataset.pillow, "Decorative Pillows")));
  if (MESHY_MODES.includes(state.designMode)) renderSheetSources();
}
/**
 * Character -> Arcade product in one step: Arcade generates a pattern with the
 * character as its motif (it only prints its own patterns), then builds the product.
 */
async function putCharacterOnProduct(characterId, categoryName) {
  const pet = activePet(),
    character = readyCharacters(pet).find((c) => c.id === characterId);
  if (!character) return;
  if (arcade.signedIn === null) await loadArcadeDesigns();
  if (arcade.signedIn === false) return toast("Sign in with ChatGPT to make products with Arcade");
  if (arcade.configured === false) return toast("Arcade isn't connected on this site yet");
  state.patternCharacterId = character.id;
  state.pendingProduct = { categoryName };
  setDesignMode("pattern");
  $("#patternPrompt").value = `${character.name} as the centerpiece on a soft cream background, with scattered tiny stars and paw prints.`;
  $("#portraitCanvas").scrollIntoView({ behavior: "smooth", block: "start" });
  toast(`Arcade is designing ${categoryName.toLowerCase()} for ${petName(pet)}`);
  $("#generatePattern").click();
}
async function finishPendingProduct(design) {
  const { categoryName } = state.pendingProduct;
  state.pendingProduct = null;
  if (design.status !== "succeeded") return;
  try {
    const category = (await loadCatalog()).find((item) => item.name === categoryName && item.categoryId);
    if (!category) return toast(`${categoryName} isn't available from Arcade right now`);
    state.shopDesignId = design.id;
    state.shopView = category.audience;
    await makeArcadeProduct(design.id, category.categoryId);
    location.hash = `#/shop?view=${category.audience}`;
    toast(`Arcade is making the ${categoryName.toLowerCase().replace(/s$/, "")}`);
  } catch (error) {
    toast(error.message);
  }
}
async function generateMeshyImage(btn) {
  const pet = activePet(),
    sheet = state.designMode === "sheet";
  const body = {
    petKey: pet.id,
    petName: petName(pet),
    petType: pet.type,
    style: $(".style.active")?.dataset.style || "storybook",
    colors: selectedColors(),
  };
  if (sheet) {
    const source = readyCharacters(pet).find((c) => c.id === state.sheetSourceId);
    if (!source) return setArcadeStatus("Draw a character first, then make a sticker sheet from it.", "warn");
    Object.assign(body, {
      kind: "sticker_sheet",
      sourceCharacterId: source.id,
      theme: $("#sheetTheme").value.trim(),
      prompt: $("#sheetNotes").value.trim(),
    });
  } else {
    const photo = storedPhoto(pet),
      usePhoto = Boolean(photo && $("#usePhotoReference").checked);
    Object.assign(body, { kind: "character", prompt: $("#patternPrompt").value.trim(), photoId: usePhoto ? photo.id : undefined });
  }
  btn.disabled = true;
  btn.innerHTML = "Sending to Meshy… <span>✦</span>";
  setArcadeStatus(sheet ? "Starting the sticker sheet…" : body.photoId ? "Sharing the reference photo and starting the character…" : "Starting the character…");
  try {
    const { character } = await api("/api/characters", { method: "POST", body });
    pet.characters = [character, ...(pet.characters || [])];
    renderStickerPack();
    await pollCharacter(pet, character.id);
  } catch (error) {
    if (error.status === 401)
      setArcadeStatus(`<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to draw with Meshy.`, "error");
    else if (error.code === "MESHY_NOT_CONFIGURED") setArcadeStatus("Meshy isn't connected on this site yet.", "warn");
    else if (error.status === 429 && error.payload?.characterId) {
      setArcadeStatus("Meshy is still drawing the last one — waiting for it.");
      await pollCharacter(pet, error.payload.characterId);
    } else setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = generateLabel();
  }
}
async function pollCharacter(pet, characterId) {
  if (polling.has(characterId)) return;
  polling.add(characterId);
  const started = Date.now();
  try {
    while (Date.now() - started < 5 * 60 * 1000) {
      const seconds = Math.round((Date.now() - started) / 1000);
      if (pet === activePet() && MESHY_MODES.includes(state.designMode))
        setArcadeStatus(`<span class="arcade-spinner"></span>Meshy is drawing · ${seconds}s`);
      await sleep(4000);
      let character;
      try {
        ({ character } = await api(`/api/characters/${encodeURIComponent(characterId)}`));
      } catch (error) {
        if (error.status >= 500 || error.status === 429) continue;
        throw error;
      }
      pet.characters = (pet.characters || []).map((c) => (c.id === character.id ? character : c));
      if (character.status === "running") continue;
      if (pet === activePet()) {
        renderStickerPack();
        if (state.route === "home") renderCubby();
        if (character.status === "succeeded") {
          if (MESHY_MODES.includes(state.designMode)) showSticker(character);
          setArcadeStatus(`${escapeHtml(character.name)} is ready in the gallery below.`, "ok");
          toast(`${character.name} is ready`);
        } else setArcadeStatus(escapeHtml(character.error || "Meshy couldn't draw this."), "error");
      }
      return;
    }
  } catch (error) {
    if (pet === activePet()) setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    polling.delete(characterId);
  }
}

// Embroidery lettering: drawn in the browser by public/lettering.js, so it's instant and free.
state.lettering = { font: "rounded", stitch: "running", thread: "#c0395a", motif: "paw", result: null };
const letterings = (pet) => (pet.characters || []).filter((c) => c.kind === "lettering");
function letteringOptions() {
  return {
    text: $("#letterText").value.trim() || petName(activePet()),
    subline: $("#letterSubline").value.trim(),
    font: state.lettering.font,
    stitch: state.lettering.stitch,
    thread: state.lettering.thread,
    motif: state.lettering.motif,
  };
}
// The exported image drops the sewing animation so every stitch is visible.
const stillSvg = (svg) => svg.replace('class="lettering-svg"', "");
let letteringRender = 0;
async function renderLettering() {
  const ticket = ++letteringRender;
  const result = await window.Lettering.render(letteringOptions());
  if (ticket !== letteringRender) return;
  state.lettering.result = result;
  const hoop = $("#letteringHoop");
  hoop.innerHTML = result.svg;
  // Sew in over at most ~1.6s, however many stitches there are.
  hoop.querySelector("svg").style.setProperty("--step", `${Math.min(14, 1600 / Math.max(result.stitches, 1))}ms`);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stillSvg(result.svg))}`;
  $$("#letteringMockups img").forEach((img) => (img.src = src));
}
let letteringTimer = null;
const queueLettering = () => {
  clearTimeout(letteringTimer);
  letteringTimer = setTimeout(renderLettering, 220);
};
[
  ["#letterFonts", "font"],
  ["#letterStitches", "stitch"],
  ["#letterThreads", "thread"],
  ["#letterMotifs", "motif"],
].forEach(([group, key]) =>
  $$(`${group} button`).forEach((btn) =>
    btn.addEventListener("click", () => {
      $$(`${group} button`).forEach((b) => b.classList.toggle("active", b === btn));
      state.lettering[key] = btn.dataset[key];
      renderLettering();
    }),
  ),
);
$("#letterText").addEventListener("input", queueLettering);
$("#letterSubline").addEventListener("input", queueLettering);
async function letteringPng() {
  if (!state.lettering.result) await renderLettering();
  const { svg, width, height } = state.lettering.result;
  return window.Lettering.toPng(svg, width, height);
}
$("#downloadLettering").addEventListener("click", async () => {
  const blob = await letteringPng();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${petName(activePet()).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-lettering.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
async function saveLettering(btn) {
  const pet = activePet(),
    options = letteringOptions();
  btn.disabled = true;
  btn.innerHTML = "Saving… <span>✦</span>";
  try {
    const form = new FormData();
    form.append("file", new File([await letteringPng()], "lettering.png", { type: "image/png" }));
    form.append("petKey", pet.id);
    form.append("petName", petName(pet));
    form.append("text", options.text);
    form.append("stitch", options.stitch);
    form.append("fontLabel", $("#letterFonts button.active")?.textContent || "");
    const response = await fetch("/api/lettering", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setArcadeStatus(`<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to save lettering. You can still download it.`, "error");
      return;
    }
    if (!response.ok) throw new Error(payload.error || "Could not save the lettering");
    pet.characters = [payload.character, ...(pet.characters || [])];
    renderStickerPack();
    setArcadeStatus(`${escapeHtml(payload.character.name)} is saved in the gallery below.`, "ok");
    toast("Lettering saved");
  } catch (error) {
    setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = generateLabel();
  }
}

// 3D twin: show Meshy's GLB with <model-viewer>, loaded only when a model exists.
let modelViewerLoading = null;
function loadModelViewer() {
  modelViewerLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return modelViewerLoading;
}
function showTwinModel(pet) {
  const ready = pet.twinJob?.status === "ready" && pet.twinJob.modelUrl;
  const slot = $("#twinModel");
  $(".twin-card").classList.toggle("has-3d-model", Boolean(ready));
  slot.hidden = !ready;
  if (!ready) {
    slot.innerHTML = "";
    delete slot.dataset.src;
    return;
  }
  if (slot.dataset.src !== pet.twinJob.modelUrl) {
    slot.dataset.src = pet.twinJob.modelUrl;
    slot.innerHTML = `<model-viewer src="${escapeHtml(pet.twinJob.modelUrl)}" alt="3D model of ${escapeHtml(petName(pet))}" camera-controls auto-rotate shadow-intensity="1" touch-action="pan-y"></model-viewer>`;
  }
  loadModelViewer().catch(() => {
    slot.innerHTML = '<p class="twin-model-error">The 3D viewer couldn\'t load. Check your connection and refresh.</p>';
  });
  $("#pipelineState").hidden = false;
  $("#pipelineDetail").textContent = pet.twinJob.demo
    ? "Demo model · made earlier with Meshy from this same photo · drag to rotate."
    : "3D model ready · drag to rotate. Saved privately to your account.";
}
// A twin is drawn as a cute character first (styling), then built in 3D.
const TWIN_IN_PROGRESS = ["styling", "starting_3d", "submitted", "saving"];
function showTwinProgress(pet, job) {
  const name = petName(pet);
  const [status, detail] = {
    styling: [`Drawing ${name}'s look · ${job.progress}%`, `Step 1 of 2 · Meshy is drawing ${name} as a cute character, without the harness or leash.`],
    starting_3d: ["Starting the 3D build…", "Step 2 of 2 · Sending the character to Meshy's 3D builder."],
    submitted: [`Building 3D model · ${job.progress}%`, `Step 2 of 2 · Meshy is building the 3D model · ${job.progress}% done.`],
    saving: ["Saving 3D model…", "Meshy finished. Copying the model into your private storage…"],
  }[job.status];
  $("#twinStatus").textContent = status;
  $("#pipelineDetail").textContent = detail;
}
async function pollTwin(pet, jobId) {
  if (polling.has(jobId)) return;
  polling.add(jobId);
  const started = Date.now();
  try {
    while (Date.now() - started < 15 * 60 * 1000) {
      await sleep(5000);
      let job;
      try {
        ({ job } = await api(`/api/twin-jobs/${encodeURIComponent(jobId)}`));
      } catch (error) {
        if (error.status >= 500 || error.status === 429) continue;
        throw error;
      }
      pet.twinJob = job;
      if (TWIN_IN_PROGRESS.includes(job.status)) {
        if (pet === activePet()) showTwinProgress(pet, job);
        continue;
      }
      if (pet === activePet()) {
        if (job.status === "failed") $("#twinError").textContent = job.error || "Meshy couldn't build the 3D model.";
        renderTwinCard();
        if (job.status === "ready") toast(`${petName(pet)}'s 3D twin is ready`);
      }
      return;
    }
  } catch (error) {
    if (pet === activePet()) $("#twinError").textContent = error.message;
  } finally {
    polling.delete(jobId);
  }
}
async function loadPetMedia() {
  const pet = activePet();
  showSticker(null);
  renderTwinCard();
  renderStickerPack();
  try {
    const [{ characters }, { job }] = await Promise.all([
      api(`/api/characters?petKey=${encodeURIComponent(pet.id)}`),
      api(`/api/twin-jobs?petKey=${encodeURIComponent(pet.id)}`),
    ]);
    pet.characters = characters;
    if (job) {
      pet.twinJob = job;
      if (job.status === "ready" || TWIN_IN_PROGRESS.includes(job.status)) pet.twinReady = true;
    }
    if (pet !== activePet()) return;
    renderStickerPack();
    renderPatternReference();
    renderTwinCard();
    if (state.route === "home") renderCubby();
    characters.filter((c) => c.status === "running").forEach((c) => pollCharacter(pet, c.id));
    if (TWIN_IN_PROGRESS.includes(job?.status)) {
      showTwinProgress(pet, job);
      pollTwin(pet, job.id);
    }
  } catch {
    // Signed out or offline: stickers and the 3D twin stay hidden.
  }
}

// ---- 06 Cubby: every product for the pet, shelved by use case ----
const SHELVES = [
  ["sleep", "Sleeping"],
  ["dine", "Mealtimes"],
  ["out", "Heading out"],
  ["home", "Around the house"],
  ["keepsake", "Keepsakes for you"],
];
// Pieces Arcade can't make yet; kept visible but labelled as concepts.
const CONCEPT_ITEMS = [
  ["cloud-bed", "sleep"],
  ["portrait-bowl", "dine"],
  ["everyday-harness", "out"],
  ["water-bottle", "out"],
  ["market-tote", "keepsake"],
];

async function loadCatalog() {
  if (arcade.catalog) return arcade.catalog;
  const { items, configured } = await api("/api/arcade/catalog");
  arcade.configured = configured;
  arcade.catalog = items;
  return items;
}
function refreshProductViews() {
  if (state.route === "shop") renderArcadeShop();
  if (state.route === "home") renderCubby();
}
function cubbyRow({ name, image, tint, tag, button }) {
  return `<div class="cubby-row-item">
    <span class="cubby-thumb" style="--tint:${tint || "#fff4e6"}">${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}</span>
    <span class="cubby-row-copy"><b>${escapeHtml(name)}</b>${tag ? `<small>${escapeHtml(tag)}</small>` : ""}${button}</span>
  </div>`;
}
const readyProducts = (design) =>
  design ? (arcade.products[design.id] || []).filter((p) => p.status === "succeeded") : [];
async function renderCubby() {
  const pet = activePet(),
    note = $("#cubbyNote");
  $$(".pet-name-copy").forEach((el) => (el.textContent = petName(pet)));
  renderCubbyPet(pet);
  if (arcade.signedIn === null) await loadArcadeDesigns();
  let catalog = [];
  try {
    catalog = await loadCatalog();
  } catch {
    catalog = [];
  }
  const design = arcade.signedIn && arcade.configured ? shopDesign() : null;
  if (design && !arcade.products[design.id]) {
    try {
      arcade.products[design.id] = (await api(`/api/arcade-products?designId=${encodeURIComponent(design.id)}`)).products;
      arcade.products[design.id].filter((p) => p.status === "running").forEach((p) => pollArcadeProduct(design.id, p.id));
    } catch {
      arcade.products[design.id] = [];
    }
  }
  if (arcade.signedIn === false)
    note.innerHTML = `<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to fill these shelves with ${escapeHtml(petName(pet))}'s designs.`;
  else if (!arcade.configured) note.textContent = "Arcade isn't connected on this site yet, so these shelves show what we'd make.";
  else if (!design) note.innerHTML = `<a href="#/designs">Create a design</a> to fill the shelves with their pattern.`;
  else note.innerHTML = `Shelved in <b>${escapeHtml(design.name)}</b>. Make any piece, then order everything that’s ready in one checkout.`;

  // Printable sticker sheets first, then lettering and the characters they come from.
  const keepsakes = [...stickerSheets(pet), ...letterings(pet), ...petCharacters(pet)].filter((c) => c.status === "succeeded").slice(0, 5);
  $("#cubbyShelves").innerHTML = SHELVES.map(([id, label]) => {
    const rows = [
      ...catalog
        .filter((item) => item.useCase === id)
        .map((item) => {
          const action = arcadeAction(item, design);
          return cubbyRow({
            name: action.product?.title || item.name,
            image: action.product?.imageUrl || item.imageUrl,
            tag: action.product?.unitPrice ? formatPrice(action.product.unitPrice) : "Made by Arcade",
            button: arcadeButton(action, item, design),
          });
        }),
      ...(id === "keepsake"
        ? keepsakes.map((asset) =>
            cubbyRow({
              name: asset.name,
              image: asset.imageUrl,
              tint: "#fff8ee",
              tag: { sticker_sheet: "Sticker sheet · Meshy", lettering: "Embroidery lettering" }[asset.kind] || "Character · Meshy",
              button: `<a class="arcade-btn soft" href="${escapeHtml(asset.imageUrl)}?download=1">Download</a>`,
            }),
          )
        : []),
      ...CONCEPT_ITEMS.filter(([, useCase]) => useCase === id).map(([slug]) => {
        const product = productBySlug(slug);
        return cubbyRow({
          name: product.name,
          tint: product.tint,
          tag: `Concept · ${money(product.price)}`,
          button: `<a class="arcade-btn soft" href="#/product/${slug}">Details</a>`,
        });
      }),
    ];
    return `<section class="cubby-shelf" aria-label="${label}"><header><h3>${label}</h3><small>${rows.length} piece${rows.length === 1 ? "" : "s"}</small></header><div class="cubby-row">${rows.join("")}</div></section>`;
  }).join("");

  const ready = readyProducts(design);
  const btn = $("#orderCubby");
  btn.disabled = !ready.length;
  btn.innerHTML = `${ready.length ? `Order what’s ready (${ready.length})` : "Order what’s ready"} <span>→</span>`;
}
$("#orderCubby").addEventListener("click", () => {
  const ready = readyProducts(shopDesign());
  ready.forEach((product) => addArcadeToBag(product));
  if (ready.length) openBag({ confirming: true });
});
function renderCubbyPet(pet) {
  const slot = $("#cubbyModel"),
    ready = pet.twinJob?.status === "ready" && pet.twinJob.modelUrl,
    photo = pet.photos[0];
  $(".cubby-pet").classList.toggle("has-3d-model", Boolean(ready));
  $(".cubby-pet").classList.toggle("has-photo", Boolean(photo) && !ready);
  $("#cubbyPhoto").hidden = !photo || Boolean(ready);
  if (photo && !ready) $("#cubbyPhoto").src = photo.url;
  slot.hidden = !ready;
  if (!ready) {
    slot.innerHTML = "";
    delete slot.dataset.src;
    return;
  }
  if (slot.dataset.src !== pet.twinJob.modelUrl) {
    slot.dataset.src = pet.twinJob.modelUrl;
    slot.innerHTML = `<model-viewer src="${escapeHtml(pet.twinJob.modelUrl)}" alt="3D model of ${escapeHtml(petName(pet))}" camera-controls auto-rotate shadow-intensity="1" touch-action="pan-y"></model-viewer>`;
  }
  loadModelViewer().catch(() => {
    slot.hidden = true;
  });
}

bag.load();
renderBag();
renderHome();
syncPetUI();
renderRoute();
loadArcadeDesigns();
loadPetMedia();
