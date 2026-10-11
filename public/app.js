const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const toast = (message) => {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
};
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
      id: "milo",
      name: "Milo",
      type: "Dog",
      photos: [],
      note: "",
      twinReady: false,
      designs: [],
      measurements: emptyMeasurements(),
    },
  ],
  activePetId: "milo",
  brandReady: false,
  bag: 0,
  shopView: "pet",
  route: "landing",
  measureUnit: "cm",
};
const activePet = () => state.pets.find((p) => p.id === state.activePetId);
const petName = (pet) => pet.name.trim() || "Your pet";
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const SIGN_IN_URL = `/signin-with-chatgpt?return_to=${encodeURIComponent("/index.html#/studio")}`;
const safeId = (name) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36).slice(-4)}`;
const routeAliases = {
  studio: "studio",
  pets: "studio",
  designs: "designs",
  brand: "designs",
  shop: "shop",
  collection: "shop",
  "for-you": "shop",
  home: "home",
  space: "home",
};
function currentRoute() {
  const key = location.hash.replace(/^#\/?/, "").split("?")[0];
  return routeAliases[key] || "landing";
}
function renderShopView() {
  const view = state.shopView;
  $$(".shop-context-tabs button").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.shopView === view),
  );
  $$("[data-shop-panel]").forEach(
    (panel) => (panel.hidden = panel.dataset.shopPanel !== view),
  );
}
function renderRoute() {
  const route = currentRoute();
  state.route = route;
  document.body.dataset.route = route;
  $$("[data-route]").forEach((el) => (el.hidden = el.dataset.route !== route));
  $$("[data-nav-route]").forEach((link) => {
    const selected = link.dataset.navRoute === route;
    link.classList.toggle("active", selected);
    link.setAttribute("aria-selected", String(selected));
    link.tabIndex = selected ? 0 : -1;
  });
  if (route === "shop") {
    const requested = new URLSearchParams(
      location.hash.split("?")[1] || "",
    ).get("view");
    if (["pet", "owner"].includes(requested)) state.shopView = requested;
    renderShopView();
  }
  $("#customizer").classList.remove("open");
  const first = $(`[data-route="${route}"]:not([hidden])`);
  if (first) {
    first.classList.add("app-route-enter");
    setTimeout(() => first.classList.remove("app-route-enter"), 320);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}
$(".workspace-tabs").addEventListener("keydown", (event) => {
  const tabs = $$("[data-nav-route]"),
    current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next = current;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (event.key === "ArrowLeft")
    next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
});
$$(".shop-context-tabs button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.shopView = btn.dataset.shopView;
    location.hash = `#/shop?view=${state.shopView}`;
    renderShopView();
  }),
);
window.addEventListener("hashchange", renderRoute);
function renderSavedDesigns() {
  const wrap = $("#savedDesigns"),
    designs = activePet().designs || [];
  wrap.innerHTML = designs.length
    ? designs
        .map(
          (d, i) =>
            `<button type="button" data-design-index="${i}"><span>✦</span>${escapeHtml(d.name)}</button>`,
        )
        .join("")
    : '<span class="empty-design">No saved designs yet</span>';
  $$("[data-design-index]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const design = designs[Number(btn.dataset.designIndex)];
      $("#patternPrompt").value = design.prompt;
      $("#portraitCanvas").classList.add("brand-ready");
      $("#brandKitResult").classList.add("ready");
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
  $("#petType").value = pet.type;
  $$(".name-copy").forEach((x) => (x.textContent = name.toUpperCase()));
  $$(".chat-pet-name").forEach((x) => (x.textContent = name));
  $("#portraitName").textContent = name.toUpperCase();
  $$(".bandana,.owner-mark").forEach((x) => (x.textContent = initial));
  $$(".scarf-shape").forEach((x) => (x.childNodes[0].nodeValue = initial));
  $$(".product-link").forEach((a) => {
    const url = new URL(a.href);
    url.searchParams.set("pet", name);
    if (a.closest(".owner-product")) url.searchParams.set("context", "owner");
    a.href = url.pathname + url.search;
  });
  $$(".unit-toggle button").forEach((x) =>
    x.classList.toggle("active", x.dataset.unit === state.measureUnit),
  );
  $$(".measurement-unit").forEach((x) => (x.textContent = state.measureUnit));
  $$(".measurement-input").forEach((input) => {
    const cm = pet.measurements[input.dataset.key];
    input.dataset.cm = cm;
    input.value =
      cm === ""
        ? ""
        : state.measureUnit === "cm"
          ? Number(Number(cm).toFixed(1))
          : Number((Number(cm) / 2.54).toFixed(1));
  });
  $("#confirmMeasurements").checked = Boolean(pet.measurements.confirmed);
  $("#photoTray").innerHTML = "";
  pet.photos.forEach(addPhotoCard);
  updatePhotoStatus();
  renderPetSwitcher();
  renderSavedDesigns();
  const readyCopy = pet.measurements.confirmed
    ? "Fit calibrated · measurements confirmed"
    : "Visual twin · photo estimate";
  $("#twinStatus").textContent = pet.twinReady
    ? readyCopy
    : "Waiting for photos";
  $("#twinStatus").classList.toggle("pending", !pet.twinReady);
  $("#pipelineState").hidden = !pet.twinReady;
}
function renderPetSwitcher() {
  const wrap = $("#petSwitcher");
  wrap.querySelectorAll(".pet-chip").forEach((x) => x.remove());
  state.pets.forEach((p) => {
    const b = document.createElement("button");
    b.className = `pet-chip ${p.id === state.activePetId ? "active" : ""}`;
    b.dataset.petId = p.id;
    b.innerHTML = `<span class="pet-avatar">${escapeHtml(petName(p)[0].toUpperCase())}</span><span><b>${escapeHtml(petName(p))}</b><small>${p.id === state.activePetId ? "Active profile" : p.type}</small></span>`;
    b.addEventListener("click", () => {
      state.activePetId = p.id;
      state.brandReady = false;
      syncPetUI();
      toast(`Now designing for ${petName(p)}`);
    });
    wrap.insertBefore(b, $("#addPet"));
  });
}
$("#addPet").addEventListener("click", () => {
  $("#petModal").hidden = false;
  setTimeout(() => $("#newPetName").focus(), 50);
});
$("#closePetModal").addEventListener(
  "click",
  () => ($("#petModal").hidden = true),
);
$("#petModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});
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
  syncPetUI();
  toast(`${name} has a new profile`);
});
$("#petName").addEventListener("input", (e) => {
  activePet().name = e.target.value;
  syncPetUI();
});
$("#petType").addEventListener(
  "change",
  (e) => (activePet().type = e.target.value),
);
$("#measureToggle").addEventListener("click", (e) => {
  const panel = $("#measurements");
  panel.classList.toggle("open");
  e.currentTarget.setAttribute(
    "aria-expanded",
    panel.classList.contains("open"),
  );
  e.currentTarget.textContent = panel.classList.contains("open")
    ? "− Hide measurements"
    : "＋ Add measurements for a more precise fit";
});
$$(".measurement-input").forEach((input) =>
  input.addEventListener("input", () => {
    const pet = activePet(),
      cm =
        input.value === ""
          ? ""
          : state.measureUnit === "cm"
            ? input.value
            : (Number(input.value) * 2.54).toFixed(2);
    input.dataset.cm = cm;
    pet.measurements[input.dataset.key] = cm;
    pet.measurements.confirmed = false;
    $("#confirmMeasurements").checked = false;
    updateCaptureAssessment();
  }),
);
$$(".unit-toggle button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.measureUnit = btn.dataset.unit;
    activePet().measurements.unit = state.measureUnit;
    $$(".unit-toggle button").forEach((x) =>
      x.classList.toggle("active", x === btn),
    );
    $$(".measurement-input").forEach((input) => {
      const cm = input.dataset.cm;
      input.value =
        cm === ""
          ? ""
          : state.measureUnit === "cm"
            ? Number(Number(cm).toFixed(1))
            : Number((Number(cm) / 2.54).toFixed(1));
    });
    $$(".measurement-unit").forEach(
      (label) => (label.textContent = state.measureUnit),
    );
    toast(
      `Measurements shown in ${state.measureUnit === "cm" ? "centimeters" : "inches"}`,
    );
  }),
);
$("#confirmMeasurements").addEventListener("change", (e) => {
  const complete = ["back", "chest", "neck"].every(
    (key) => Number(activePet().measurements[key]) > 0,
  );
  if (e.target.checked && !complete) {
    e.target.checked = false;
    toast("Enter back, chest, and neck before confirming");
    return;
  }
  activePet().measurements.confirmed = e.target.checked;
  updateCaptureAssessment();
});
$("#attachPhotos").addEventListener("click", () => $("#petPhotos").click());
const setStorageStatus = (message, tone = "") => {
  const el = $("#storageStatus");
  el.className = `storage-status ${tone}`.trim();
  el.innerHTML = `<span></span>${message}`;
};
async function savePrivatePhoto(file, photo, pet) {
  setStorageStatus(`Saving ${escapeHtml(file.name)} privately…`, "saving");
  const form = new FormData();
  form.append("file", file);
  form.append("petId", pet.id);
  form.append("petName", petName(pet));
  form.append("petType", pet.type);
  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: form,
    });
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
      // Removed from the tray while the upload was in flight.
      await deletePrivatePhoto(photo);
      return false;
    }
    const date = new Date(photo.deleteAfter).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    setStorageStatus(`Stored privately · automatic deletion on ${date}.`);
    return true;
  } catch (error) {
    photo.status = "local-only";
    setStorageStatus(
      `${escapeHtml(error.message)}. Preview remains on this device only.`,
      "error",
    );
    return false;
  }
}
async function deletePrivatePhoto(photo) {
  if (!photo.id) return;
  try {
    await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
      method: "DELETE",
    });
  } catch {}
}
$("#petPhotos").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, 8 - activePet().photos.length),
    pet = activePet();
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const data = await fileToData(file),
      photo = {
        name: file.name,
        url: data,
        size: file.size,
        demo: false,
        status: "saving",
      };
    pet.photos.push(photo);
    addPhotoCard(photo);
    updatePhotoStatus();
    await savePrivatePhoto(file, photo, pet);
  }
  e.target.value = "";
  if (files.length)
    toast(`${files.length} photo${files.length > 1 ? "s" : ""} attached`);
});
const fileToData = (file) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
$("#useDemoPhoto").addEventListener("click", () => {
  if (!activePet().photos.some((photo) => photo.demo)) {
    const demo = {
      name: "demo-pet-reference.jpg",
      url: "assets/demo-pet-reference.jpg",
      size: 1200000,
      demo: true,
      status: "demo",
    };
    activePet().photos.push(demo);
    addPhotoCard(demo);
  }
  setStorageStatus(
    "Demo reference stays in the app. Your own uploads are private and delete after 30 days.",
  );
  updatePhotoStatus();
  toast("Demo reference added — measurements are still needed for fit");
});
function addPhotoCard(photo) {
  const item = document.createElement("div");
  item.className = "photo-thumb";
  item.innerHTML = `<img alt="${photo.demo ? "Demo pet reference" : "Pet reference photo"}" src="${photo.url}"><button aria-label="Remove photo">×</button>`;
  item.querySelector("button").addEventListener("click", async () => {
    photo.removed = true;
    await deletePrivatePhoto(photo);
    activePet().photos = activePet().photos.filter((x) => x !== photo);
    item.remove();
    updatePhotoStatus();
    setStorageStatus(
      photo.id
        ? "Photo removed from private storage."
        : "Photo removed from this device.",
    );
  });
  $("#photoTray").append(item);
}
function updateCaptureAssessment() {
  const pet = activePet(),
    count = pet.photos.length,
    photo = pet.photos[0],
    complete = ["back", "chest", "neck"].every(
      (key) => Number(pet.measurements[key]) > 0,
    ),
    confirmed = complete && pet.measurements.confirmed;
  $("#visualReadiness").textContent = count
    ? "Ready for prototype"
    : "Needs a photo";
  $("#fitReadiness").textContent = confirmed
    ? "Measurement-calibrated"
    : complete
      ? "Confirm measurements"
      : "Photo estimate only";
  if (!count) {
    $("#captureGrade").textContent = "Waiting for a photo";
    $("#qualityChecks").innerHTML =
      "<li>Upload a photo to run the first checks.</li>";
    return;
  }
  const resolutionPass = photo.demo || Number(photo.size) >= 200000;
  $("#captureGrade").textContent = photo.demo
    ? "Usable demo · add a side view for shape"
    : count >= 2
      ? "Good capture set"
      : "Usable first photo";
  $("#qualityChecks").innerHTML =
    `<li class="${resolutionPass ? "pass" : "warn"}">${resolutionPass ? "✓" : "!"} File resolution ${resolutionPass ? "looks sufficient" : "may be too low"}</li><li class="${photo.demo ? "warn" : "review"}">${photo.demo ? "! This demo has excellent face detail but only a partial body view" : "• Confirm the full body and paws are visible"}</li><li class="${confirmed ? "pass" : "warn"}">${confirmed ? "✓ Measurements confirmed for scale" : "! No verified scale yet — enter and confirm measurements"}</li>`;
}
function updatePhotoStatus() {
  const count = activePet().photos.length;
  $("#chatStatus").textContent = count
    ? `${count} photo${count > 1 ? "s" : ""} attached · ${count === 1 ? "enough for a visual prototype" : count >= 3 ? "strong visual coverage" : "extra detail added"}`
    : "Upload one photo to start · extra angles are optional";
  updateCaptureAssessment();
}
$("#sendPhotoMessage").addEventListener("click", () => {
  const input = $("#photoMessage"),
    message = input.value.trim();
  if (!message && !activePet().photos.length) {
    $("#petPhotos").click();
    return;
  }
  if (message) {
    activePet().note = message;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.textContent = message;
    $("#photoChat").insertBefore(bubble, $(".shot-guide"));
    input.value = "";
  }
  const reply = document.createElement("div");
  reply.className = "chat-bubble assistant compact";
  reply.innerHTML = `<span class="chat-mark">P</span><p>${activePet().photos.length ? "Perfect—this is enough to start. Any extra angle is completely optional." : "Got it. Add one clear photo whenever you’re ready."}</p>`;
  $("#photoChat").append(reply);
  toast("Message added to pet profile");
});
$("#photoMessage").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#sendPhotoMessage").click();
});
$("#createTwin").addEventListener("click", async (e) => {
  const pet = activePet(),
    error = $("#twinError");
  error.textContent = "";
  if (!pet.photos.length) {
    error.textContent =
      "Add at least one photo so we have a likeness to work from.";
    $("#photoChat").classList.add("needs-photo");
    setTimeout(() => $("#photoChat").classList.remove("needs-photo"), 700);
    return;
  }
  const btn = e.currentTarget,
    status = $("#twinStatus"),
    savedPhoto = pet.photos.find((photo) => photo.id);
  btn.disabled = true;
  for (const message of [
    "Checking capture quality…",
    "Preparing visual-twin request…",
    "Building the fit profile…",
  ]) {
    status.textContent = message;
    await new Promise((r) => setTimeout(r, 420));
  }
  let jobStatus = "local_preview";
  if (savedPhoto) {
    try {
      const response = await fetch("/api/twin-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId: pet.id, photoId: savedPhoto.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Could not prepare the 3D job");
      pet.twinJob = payload.job;
      jobStatus = payload.job.status;
    } catch (jobError) {
      error.textContent = jobError.message;
      status.textContent = "3D job needs attention";
      btn.disabled = false;
      return;
    }
  }
  pet.twinReady = true;
  const calibrated = pet.measurements.confirmed;
  status.textContent = calibrated
    ? "Fit calibrated · measurements confirmed"
    : "Visual twin · photo estimate";
  status.classList.remove("pending");
  $("#petModel").animate(
    [
      { transform: "translateX(-50%) scale(.72)", opacity: 0.2 },
      { transform: "translateX(-50%) scale(1.14)", opacity: 1 },
      { transform: "translateX(-50%) scale(1.08)", opacity: 1 },
    ],
    { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
  btn.disabled = false;
  btn.innerHTML = "Prototype twin prepared <span>✓</span>";
  $("#pipelineState").hidden = false;
  if (jobStatus === "submitted")
    $("#pipelineDetail").textContent =
      "Meshy job submitted securely. The next backend step will poll for the GLB and save it to private storage.";
  else if (jobStatus === "waiting_for_provider_key")
    $("#pipelineDetail").textContent =
      "Private request saved · waiting for the Meshy API key before 3D generation starts.";
  else
    $("#pipelineDetail").textContent = calibrated
      ? "Local demo preview · upload your own photo to create a private Meshy job."
      : "Local demo preview · upload your own photo and confirm measurements for a size-aware job.";
  $("#twinNextActions").hidden = false;
  $$(".flow-progress span").forEach((x) => x.classList.add("active"));
  toast(
    jobStatus === "submitted"
      ? `${petName(pet)}'s 3D job was submitted`
      : `${petName(pet)}'s prototype twin is prepared`,
  );
});
$("#rotatePet").addEventListener("click", () =>
  $("#petModel").classList.toggle("flipped"),
);
$("#adjustFit").addEventListener("click", () => {
  $("#measurements").classList.add("open");
  $("#measureToggle").setAttribute("aria-expanded", "true");
  $("#measureToggle").textContent = "− Hide measurements";
  toast("Measurements opened");
});
$$(".style").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".style").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    const canvas = $("#portraitCanvas");
    canvas.className =
      "portrait-canvas " +
      (btn.dataset.style === "storybook" ? "" : btn.dataset.style);
  }),
);
$$(".palette button[data-color]").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.documentElement.style.setProperty("--clay", btn.dataset.color);
    toast("Design color updated");
  }),
);
$$(".brand-output-tabs span").forEach((tab, i) =>
  tab.addEventListener("click", () => {
    $$(".brand-output-tabs span").forEach((x) => x.classList.remove("active"));
    tab.classList.add("active");
    $("#portraitCanvas").dataset.view = ["mark", "wordmark", "pattern"][i];
    toast(`${tab.textContent} preview`);
  }),
);
$("#newDesign").addEventListener("click", () => {
  $("#portraitCanvas").className = "portrait-canvas";
  delete $("#portraitCanvas").dataset.view;
  $("#brandKitResult").classList.remove("ready");
  $("#applyBrand").disabled = true;
  $("#generatePattern").innerHTML = "Save this design <span>✦</span>";
  $("#patternPrompt").value =
    `A fresh design inspired by ${petName(activePet())}, playful shapes and warm colors.`;
  $$(".style").forEach((x, i) => x.classList.toggle("active", i === 0));
  toast("New design canvas ready");
});
$("#generatePattern").addEventListener("click", async (e) => {
  if (!activePet().twinReady) {
    toast("Create the pet twin first so the design keeps their likeness");
    location.hash = "#/studio";
    return;
  }
  const btn = e.currentTarget;
  btn.disabled = true;
  for (const message of [
    "Drawing portrait mark…",
    "Setting name treatment…",
    "Tiling the repeat pattern…",
  ]) {
    btn.innerHTML = `${message} <span>✦</span>`;
    await new Promise((r) => setTimeout(r, 430));
  }
  state.brandReady = true;
  const designs = activePet().designs || (activePet().designs = []),
    design = {
      name: `Design ${designs.length + 1}`,
      prompt: $("#patternPrompt").value,
    };
  designs.push(design);
  $("#portraitCanvas").classList.add("brand-ready");
  $("#brandKitResult").classList.add("ready");
  $("#applyBrand").disabled = false;
  btn.disabled = false;
  btn.innerHTML = "Design saved <span>✓</span>";
  renderSavedDesigns();
  toast(`${design.name} saved for ${petName(activePet())}`);
});
$("#applyBrand").addEventListener("click", () => {
  $$(".branded-surface").forEach((x) => x.classList.add("brand-applied"));
  location.hash = "#/shop";
  toast("Design applied to products for both of you");
});
$$(".filters button").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".filters button").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    $$(".collection .product").forEach((p) =>
      p.classList.toggle(
        "hidden",
        btn.dataset.filter !== "all" &&
          p.dataset.category !== btn.dataset.filter,
      ),
    );
  }),
);
let selectedProduct = null;
$$(".customize-product").forEach((btn) =>
  btn.addEventListener("click", () => {
    selectedProduct = btn.closest(".product");
    $("#customizerTitle").textContent = selectedProduct.dataset.product;
    const context = selectedProduct.classList.contains("owner-product")
      ? "&context=owner"
      : "";
    $("#pdpLink").href =
      `product.html?product=${selectedProduct.dataset.slug}&pet=${encodeURIComponent(petName(activePet()))}${context}`;
    $("#customizer").classList.add("open");
    $("#customizer").setAttribute("aria-hidden", "false");
  }),
);
$("#closeCustomizer").addEventListener("click", () => {
  $("#customizer").classList.remove("open");
  $("#customizer").setAttribute("aria-hidden", "true");
});
$$(".mini-palette button").forEach((btn) => {
  btn.style.background = btn.dataset.color;
  btn.addEventListener(
    "click",
    () => ($(".customizer-swatch").style.backgroundColor = btn.dataset.color),
  );
});
$("#saveCustomization").addEventListener("click", () => {
  if (!selectedProduct) return;
  selectedProduct.classList.add("customized");
  selectedProduct.querySelector(".customize-product").textContent =
    "Customized ✓";
  $("#customizer").classList.remove("open");
  state.bag++;
  $("#bagCount").textContent = state.bag;
  toast(
    `${selectedProduct.dataset.product} customized for ${petName(activePet())}`,
  );
});
$$(".owner-mode button").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".owner-mode button").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    $("#for-you").dataset.mode = btn.dataset.ownerMode;
    toast(`${btn.textContent} treatment applied to owner products`);
  }),
);
$$(".home-tabs button").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".home-tabs button").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    $("#roomScene").className = "room " + btn.dataset.room;
    $(".room-label b").textContent = {
      sleep: "Golden hour garden",
      walk: "Ready for the park",
      dine: "Sunday supper",
    }[btn.dataset.room];
  }),
);
$("#saveRoom").addEventListener("click", (e) => {
  e.currentTarget.innerHTML = "Room saved <span>♥</span>";
  toast(`Saved to ${petName(activePet())}'s home`);
});
$("#bagButton").addEventListener("click", () =>
  toast(
    state.bag
      ? `${state.bag} customized piece${state.bag > 1 ? "s" : ""} saved`
      : "Customize a piece to start your bag",
  ),
);
syncPetUI();
renderRoute();
