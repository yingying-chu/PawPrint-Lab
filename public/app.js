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
  cubby: "home",
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
    renderArcadeShop();
  }
  if (route === "designs") updateReferenceOption();
  if (route === "home") renderCubby();
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
    pet = activePet(),
    remote = pet.arcadeDesigns || [],
    local = pet.designs || [];
  const remoteButtons = remote.map(
    (d) =>
      `<button type="button" class="arcade-design ${d.id === state.activeDesignId ? "active" : ""} ${d.status}" data-design-id="${escapeHtml(d.id)}">${d.thumbnailUrl ? `<img src="${escapeHtml(d.thumbnailUrl)}" alt="">` : `<span>${d.status === "failed" ? "!" : "✦"}</span>`}${escapeHtml(d.name)}${d.status === "running" ? " · generating" : d.status === "failed" ? " · failed" : ""}</button>`,
  );
  const localButtons = local.map(
    (d, i) =>
      `<button type="button" data-design-index="${i}"><span>✦</span>${escapeHtml(d.name)}</button>`,
  );
  wrap.innerHTML =
    remoteButtons.concat(localButtons).join("") ||
    '<span class="empty-design">No saved designs yet</span>';
  $$("[data-design-id]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const design = remote.find((d) => d.id === btn.dataset.designId);
      showArcadeDesign(design);
      toast(
        design.status === "failed"
          ? design.error || `${design.name} failed`
          : `${design.name} loaded`,
      );
    }),
  );
  $$("[data-design-index]", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const design = local[Number(btn.dataset.designIndex)];
      showArcadeDesign(null);
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
  document.body.dataset.petType = (pet.type || "Other").toLowerCase();
  $("#petType").value = pet.type;
  $$(".name-copy").forEach((x) => (x.textContent = name.toUpperCase()));
  $$(".chat-pet-name, .pet-name-copy").forEach((x) => (x.textContent = name));
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
const DEMO_PHOTO_URL = "assets/whispurr-demo.jpg";
// Made earlier by Meshy image-to-3D from the demo photo, then simplified for the web.
const DEMO_TWIN_URL = "assets/whispurr-twin.glb";
$("#useDemoPhoto").addEventListener("click", async () => {
  const pet = activePet();
  if (pet.photos.some((photo) => photo.demo)) return toast("The demo photo is already attached");
  const demo = {
    name: "whispurr-demo.jpg",
    url: DEMO_PHOTO_URL,
    size: 0,
    demo: true,
    status: "saving",
  };
  pet.photos.push(demo);
  addPhotoCard(demo);
  updatePhotoStatus();
  // Saved like a real upload so the demo can drive the Meshy twin and stickers.
  try {
    const blob = await fetch(DEMO_PHOTO_URL).then((r) => r.blob());
    demo.size = blob.size;
    await savePrivatePhoto(new File([blob], demo.name, { type: blob.type || "image/jpeg" }), demo, pet);
  } catch {
    demo.status = "local-only";
  }
  updatePhotoStatus();
  toast("Demo photo added — measurements are still needed for fit");
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
    ? "Good demo photo · a side view adds shape"
    : count >= 2
      ? "Good capture set"
      : "Usable first photo";
  $("#qualityChecks").innerHTML =
    `<li class="${resolutionPass ? "pass" : "warn"}">${resolutionPass ? "✓" : "!"} File resolution ${resolutionPass ? "looks sufficient" : "may be too low"}</li><li class="${photo.demo ? "warn" : "review"}">${photo.demo ? "• Full body, face and paws are visible" : "• Confirm the full body and paws are visible"}</li><li class="${confirmed ? "pass" : "warn"}">${confirmed ? "✓ Measurements confirmed for scale" : "! No verified scale yet — enter and confirm measurements"}</li>`;
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
  if (savedPhoto?.demo) {
    // The demo photo already has a Meshy model, so demos don't spend credits.
    pet.twinJob = { id: "demo", status: "ready", progress: 100, modelUrl: DEMO_TWIN_URL, demo: true };
    jobStatus = "demo";
  } else if (savedPhoto) {
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
  if (jobStatus === "submitted") {
    $("#pipelineDetail").textContent =
      "Meshy is building the 3D model. This usually takes a few minutes.";
    pollTwin(pet, pet.twinJob.id);
  } else if (jobStatus === "demo") {
    showTwinModel(pet);
  }
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
      : jobStatus === "demo"
        ? `${petName(pet)}'s 3D twin is ready`
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
    // Toggle only the style classes so the Arcade pattern layer survives.
    ["cutout", "minimal"].forEach((style) =>
      canvas.classList.toggle(style, btn.dataset.style === style),
    );
  }),
);
$$(".palette button[data-color]").forEach((btn) =>
  btn.addEventListener("click", () => {
    btn.classList.toggle("selected");
    btn.setAttribute("aria-pressed", String(btn.classList.contains("selected")));
    if (btn.classList.contains("selected"))
      document.documentElement.style.setProperty("--clay", btn.dataset.color);
    const count = selectedColors().length;
    toast(count ? `${count} color${count > 1 ? "s" : ""} in this design` : "Arcade will choose the colors");
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
  $("#generatePattern").innerHTML = "Generate with Arcade <span>✦</span>";
  showArcadeDesign(null);
  setArcadeStatus("");
  $("#patternPrompt").value =
    `A fresh design inspired by ${petName(activePet())}, playful shapes and warm colors.`;
  $$(".style").forEach((x, i) => x.classList.toggle("active", i === 0));
  toast("New design canvas ready");
});
async function saveLocalPreviewDesign(btn, reason) {
  btn.disabled = true;
  for (const message of [
    "Drawing portrait mark…",
    "Setting name treatment…",
    "Tiling the repeat pattern…",
  ]) {
    btn.innerHTML = `${message} <span>✦</span>`;
    await sleep(430);
  }
  state.brandReady = true;
  const designs = activePet().designs || (activePet().designs = []),
    design = {
      name: `Preview ${designs.length + 1}`,
      prompt: $("#patternPrompt").value,
    };
  designs.push(design);
  showArcadeDesign(null);
  $("#portraitCanvas").classList.add("brand-ready");
  $("#brandKitResult").classList.add("ready");
  $("#applyBrand").disabled = false;
  btn.disabled = false;
  btn.innerHTML = "Generate with Arcade <span>✦</span>";
  renderSavedDesigns();
  setArcadeStatus(`Preview only · ${reason}`, "warn");
  toast(`${design.name} saved as a preview for ${petName(activePet())}`);
}
$("#generatePattern").addEventListener("click", async (e) => {
  const pet = activePet(),
    btn = e.currentTarget;
  if (state.designMode === "sticker") return generateSticker(btn);
  if (!pet.twinReady) {
    toast("Create the pet twin first so the design keeps their likeness");
    location.hash = "#/studio";
    return;
  }
  const prompt = $("#patternPrompt").value.trim();
  if (!prompt) {
    setArcadeStatus("Describe the design you want first.", "error");
    return;
  }
  if (arcade.signedIn === false)
    return saveLocalPreviewDesign(btn, `<a href="${SIGN_IN_URL}">sign in</a> to generate with Arcade.`);
  if (arcade.configured === false)
    return saveLocalPreviewDesign(btn, "Arcade is not connected on this site yet.");
  const photo = storedPhoto(pet),
    usePhoto = Boolean(photo && $("#usePhotoReference").checked);
  btn.disabled = true;
  btn.innerHTML = `Sending to Arcade… <span>✦</span>`;
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
    state.activeDesignId = design.id;
    renderSavedDesigns();
    await pollArcadeDesign(pet, design.id);
  } catch (error) {
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
    } else {
      setArcadeStatus(escapeHtml(error.message), "error");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = generateLabel();
  }
});
$("#applyBrand").addEventListener("click", () => {
  $$(".branded-surface").forEach((x) => x.classList.add("brand-applied"));
  state.shopDesignId = activeArcadeDesign()?.status === "succeeded" ? state.activeDesignId : null;
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
$("#bagButton").addEventListener("click", () =>
  toast(
    state.bag
      ? `${state.bag} customized piece${state.bag > 1 ? "s" : ""} saved`
      : "Customize a piece to start your bag",
  ),
);
// ---- Arcade: real pattern generation, products, and checkout ----
const arcade = { signedIn: null, configured: null, catalog: null, products: {} };
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
  $("#arcadeReference").hidden = !photo;
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
  // The brand-kit chips describe the local preview; Arcade returns a pattern only.
  $("#brandKitResult").classList.remove("ready");
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
  const grids = $$(".arcade-shop .arcade-grid");
  if (arcade.signedIn === null) await loadArcadeDesigns();
  if (arcade.signedIn === false) {
    grids.forEach((g) => (g.innerHTML = ""));
    return setShopNote(`<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to make real products with Arcade.`);
  }
  if (arcade.configured === false) {
    grids.forEach((g) => (g.innerHTML = ""));
    return setShopNote("Arcade isn't connected on this site yet, so these pieces are concepts only.");
  }
  const design = shopDesign();
  if (!design) {
    grids.forEach((g) => (g.innerHTML = ""));
    return setShopNote(`<a href="#/designs">Generate a design</a> to see real products in ${escapeHtml(petName(activePet()))}'s pattern.`);
  }
  setShopNote(`Using <b>${escapeHtml(design.name)}</b>. Each piece is made to order by an Arcade maker.`);
  try {
    if (!arcade.catalog) arcade.catalog = (await api("/api/arcade/catalog")).items;
    if (!arcade.products[design.id]) {
      const { products } = await api(`/api/arcade-products?designId=${encodeURIComponent(design.id)}`);
      arcade.products[design.id] = products;
      products.filter((p) => p.status === "running").forEach((p) => pollArcadeProduct(design.id, p.id));
    }
  } catch (error) {
    return setShopNote(escapeHtml(error.message));
  }
  grids.forEach((grid) => {
    const audience = grid.closest(".arcade-shop").dataset.audience;
    grid.innerHTML = arcade.catalog
      .filter((item) => item.audience === audience)
      .map((item) => arcadeCard(item, design))
      .join("");
  });
  $$("[data-make-category]").forEach((btn) =>
    btn.addEventListener("click", () => makeArcadeProduct(design.id, btn.dataset.makeCategory)),
  );
  $$("[data-checkout-product]").forEach((btn) =>
    btn.addEventListener("click", () => checkoutArcadeProduct(btn)),
  );
}
function arcadeCard(item, design) {
  const product = (arcade.products[design.id] || []).find((p) => p.categoryId === item.categoryId);
  const image = product?.imageUrl || item.imageUrl;
  let action = `<button class="customize-product" data-make-category="${escapeHtml(item.categoryId)}">Make with ${escapeHtml(design.name)}</button>`;
  if (product?.status === "running")
    action = `<button class="customize-product" disabled><span class="arcade-spinner"></span>Arcade is building it…</button>`;
  else if (product?.status === "succeeded")
    action = `<button class="customize-product arcade-checkout" data-checkout-product="${escapeHtml(product.id)}">Checkout · ${escapeHtml(formatPrice(product.unitPrice))}</button>`;
  else if (product?.status === "failed")
    action = `<button class="customize-product" data-make-category="${escapeHtml(item.categoryId)}">Try again</button>`;
  return `<article class="product arcade-product"><div class="product-art arcade-art">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product?.title || item.name)}">` : ""}<span class="maker-badge arcade-badge">${product?.status === "succeeded" ? "Ready to order" : "Made by Arcade"}</span></div><div class="product-info"><span><strong>${escapeHtml(product?.title || item.name)}</strong><small>${escapeHtml(product?.status === "failed" ? product.error || "Arcade couldn't build this" : product?.selectionLabel || item.note)}</small></span>${product?.unitPrice ? `<b>${escapeHtml(formatPrice(product.unitPrice))}</b>` : ""}</div>${action}</article>`;
}
async function makeArcadeProduct(designId, categoryId) {
  try {
    const { product } = await api("/api/arcade-products", { method: "POST", body: { designId, categoryId } });
    const list = (arcade.products[designId] || []).filter((p) => p.categoryId !== categoryId);
    arcade.products[designId] = [product, ...list];
    refreshProductViews();
    if (product.status === "running") pollArcadeProduct(designId, product.id);
  } catch (error) {
    toast(error.message);
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
function checkoutArcadeProduct(btn) {
  return openArcadeCheckout([btn.dataset.checkoutProduct], btn);
}
async function openArcadeCheckout(productIds, btn) {
  if (!productIds.length) return;
  const ok = window.confirm(
    `This opens Arcade's checkout in a new tab for ${productIds.length} piece${productIds.length > 1 ? "s" : ""}. Paying there places a real order that will be made and shipped. Continue?`,
  );
  if (!ok) return;
  // Open the tab synchronously so popup blockers allow it, then point it at Arcade.
  const tab = window.open("", "_blank");
  btn.disabled = true;
  try {
    const { checkoutUrl } = await api("/api/checkouts", { method: "POST", body: { productIds } });
    if (tab) {
      tab.opener = null;
      tab.location.href = checkoutUrl;
    } else location.href = checkoutUrl;
  } catch (error) {
    tab?.close();
    toast(error.message);
  } finally {
    btn.disabled = false;
  }
}

// ---- Meshy: character stickers (2D) and the 3D twin ----
state.designMode = "pattern";
state.patternCharacterId = null;
const generateLabel = () =>
  state.designMode === "sticker"
    ? "Generate sticker with Meshy <span>✦</span>"
    : "Generate with Arcade <span>✦</span>";
function setDesignMode(mode) {
  state.designMode = mode;
  $$("[data-design-mode]").forEach((btn) => {
    const active = btn.dataset.designMode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const sticker = mode === "sticker";
  $("#generatePattern").innerHTML = generateLabel();
  $$(".ref-provider").forEach((el) => (el.textContent = sticker ? "Meshy" : "Arcade"));
  $$(".ref-output").forEach((el) => (el.textContent = sticker ? "sticker" : "pattern"));
  $("#designNote").textContent = sticker
    ? "Meshy draws a transparent sticker in about a minute. Stickers collect in the pack below."
    : "Arcade generates the repeat pattern, usually in 1–2 minutes. Each saved design can be made into real Arcade products from the shop.";
  $("#applyBrand").hidden = sticker;
  $("#portraitCanvas").classList.toggle("sticker-mode", sticker);
  renderPatternReference();
  setArcadeStatus("");
}
$$("[data-design-mode]").forEach((btn) =>
  btn.addEventListener("click", () => setDesignMode(btn.dataset.designMode)),
);
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
function showSticker(character) {
  const img = $("#stickerPreview");
  img.hidden = !character?.imageUrl;
  if (character?.imageUrl) {
    img.src = character.imageUrl;
    img.alt = `${character.name}: sticker of ${petName(activePet())}`;
  }
  $("#portraitCanvas").classList.toggle("has-sticker", Boolean(character?.imageUrl));
}
function renderStickerPack() {
  const characters = activePet().characters || [];
  $("#stickerPack").classList.toggle("empty", !characters.length);
  $("#stickerGrid").innerHTML = characters
    .map((c) => {
      if (c.status === "running")
        return `<figure class="sticker-card pending"><div class="sticker-art"><span class="arcade-spinner"></span></div><figcaption><b>${escapeHtml(c.name)}</b><small>Meshy is drawing…</small></figcaption></figure>`;
      if (c.status === "failed")
        return `<figure class="sticker-card failed"><div class="sticker-art">!</div><figcaption><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.error || "Couldn't be drawn")}</small></figcaption></figure>`;
      return `<figure class="sticker-card"><div class="sticker-art"><img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}"></div><figcaption><b>${escapeHtml(c.name)}</b><span><a href="${escapeHtml(c.imageUrl)}?download=1">Download PNG</a><button type="button" data-use-sticker="${escapeHtml(c.id)}">Use in a pattern</button></span></figcaption></figure>`;
    })
    .join("");
  $$("[data-use-sticker]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.patternCharacterId = btn.dataset.useSticker;
      setDesignMode("pattern");
      $("#portraitCanvas").scrollIntoView({ behavior: "smooth", block: "start" });
      toast("The next Arcade pattern will be guided by this sticker");
    }),
  );
}
async function generateSticker(btn) {
  const pet = activePet(),
    photo = storedPhoto(pet),
    usePhoto = Boolean(photo && $("#usePhotoReference").checked);
  btn.disabled = true;
  btn.innerHTML = "Sending to Meshy… <span>✦</span>";
  setArcadeStatus(usePhoto ? "Sharing the reference photo and starting the sticker…" : "Starting the sticker…");
  try {
    const { character } = await api("/api/characters", {
      method: "POST",
      body: {
        petKey: pet.id,
        petName: petName(pet),
        petType: pet.type,
        prompt: $("#patternPrompt").value.trim(),
        style: $(".style.active")?.dataset.style || "storybook",
        colors: selectedColors(),
        photoId: usePhoto ? photo.id : undefined,
      },
    });
    pet.characters = [character, ...(pet.characters || [])];
    renderStickerPack();
    await pollCharacter(pet, character.id);
  } catch (error) {
    if (error.status === 401)
      setArcadeStatus(`<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to generate stickers.`, "error");
    else if (error.code === "MESHY_NOT_CONFIGURED")
      setArcadeStatus("Meshy isn't connected on this site yet.", "warn");
    else if (error.status === 429 && error.payload?.characterId) {
      setArcadeStatus("A sticker is still being drawn — waiting for it.");
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
      if (pet === activePet() && state.designMode === "sticker")
        setArcadeStatus(`<span class="arcade-spinner"></span>Meshy is drawing the sticker · ${seconds}s`);
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
          showSticker(character);
          setArcadeStatus(`${escapeHtml(character.name)} is ready in the sticker pack below.`, "ok");
          toast(`${character.name} is ready`);
        } else setArcadeStatus(escapeHtml(character.error || "Meshy couldn't draw this sticker."), "error");
      }
      return;
    }
  } catch (error) {
    if (pet === activePet()) setArcadeStatus(escapeHtml(error.message), "error");
  } finally {
    polling.delete(characterId);
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
  $("#twinStatus").textContent = pet.measurements.confirmed
    ? "3D twin · measurements confirmed"
    : "3D twin · photo estimate";
  $("#twinStatus").classList.remove("pending");
  $("#pipelineState").hidden = false;
  $("#pipelineDetail").textContent = pet.twinJob.demo
    ? "Demo model · made earlier with Meshy from this same photo · drag to rotate."
    : "3D model ready · drag to rotate. Saved privately to your account.";
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
      if (job.status === "submitted" || job.status === "saving") {
        if (pet === activePet()) {
          const saving = job.status === "saving";
          $("#twinStatus").textContent = saving ? "Saving 3D model…" : `Building 3D model · ${job.progress}%`;
          $("#pipelineDetail").textContent = saving
            ? "Meshy finished. Copying the model into your private storage…"
            : `Meshy is building the 3D model · ${job.progress}% done.`;
        }
        continue;
      }
      if (pet === activePet()) {
        if (job.status === "ready") {
          showTwinModel(pet);
          toast(`${petName(pet)}'s 3D twin is ready`);
        } else if (job.status === "failed") {
          $("#twinStatus").textContent = "3D model needs attention";
          $("#twinError").textContent = job.error || "Meshy couldn't build the 3D model.";
        }
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
  showTwinModel(pet);
  renderStickerPack();
  try {
    const [{ characters }, { job }] = await Promise.all([
      api(`/api/characters?petKey=${encodeURIComponent(pet.id)}`),
      api(`/api/twin-jobs?petKey=${encodeURIComponent(pet.id)}`),
    ]);
    pet.characters = characters;
    if (job) {
      pet.twinJob = job;
      if (["ready", "submitted", "saving"].includes(job.status)) pet.twinReady = true;
    }
    if (pet !== activePet()) return;
    renderStickerPack();
    renderPatternReference();
    showTwinModel(pet);
    characters.filter((c) => c.status === "running").forEach((c) => pollCharacter(pet, c.id));
    if (job?.status === "submitted" || job?.status === "saving") pollTwin(pet, job.id);
  } catch {
    // Signed out or offline: stickers and the 3D twin stay hidden.
  }
}

// ---- Cubby: every product for the pet, shelved by use case ----
const SHELVES = [
  { id: "sleep", label: "Sleep", blurb: "Naps and nights" },
  { id: "dine", label: "Mealtimes", blurb: "Bowls, mats and the table" },
  { id: "out", label: "Out & about", blurb: "Walks and visits" },
  { id: "home", label: "Around the house", blurb: "The spaces you share" },
  { id: "keepsake", label: "Keepsakes", blurb: "Little pieces of them, for you" },
];
// Pieces Arcade can't make yet; kept visible but labelled as concepts.
const CONCEPT_ITEMS = [
  { name: "The Cloud Bed", slug: "cloud-bed", useCase: "sleep" },
  { name: "Portrait Bowl", slug: "portrait-bowl", useCase: "dine" },
  { name: "Everyday Harness", slug: "everyday-harness", useCase: "out" },
  { name: "Everyday Water Bottle", slug: "water-bottle", useCase: "out" },
  { name: "Portrait Market Tote", slug: "market-tote", useCase: "keepsake" },
];
state.cubbyDeselected = new Set();

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
function cubbyTile({ image, title, note, chip, chipTone = "", action = "", art = "" }) {
  return `<article class="cubby-item"><div class="cubby-item-art ${art}">${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}<span class="cubby-chip ${chipTone}">${escapeHtml(chip)}</span></div><div class="cubby-item-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(note)}</small></div>${action}</article>`;
}
function arcadeTile(item, design, products) {
  const product = design && products.find((p) => p.categoryId === item.categoryId);
  const base = { title: item.name, note: item.note, image: item.imageUrl, art: `shelf-${item.useCase}` };
  if (!arcade.configured || !item.categoryId) return cubbyTile({ ...base, chip: "Arcade · not connected" });
  if (!design)
    return cubbyTile({ ...base, chip: "Needs a design", action: '<a class="cubby-action" href="#/designs">Create a design</a>' });
  if (!product)
    return cubbyTile({ ...base, chip: "Made by Arcade", action: `<button class="cubby-action" data-cubby-make="${escapeHtml(item.categoryId)}">Make with ${escapeHtml(design.name)}</button>` });
  if (product.status === "running")
    return cubbyTile({ ...base, chip: "Arcade is making it", action: '<button class="cubby-action" disabled><span class="arcade-spinner"></span>Building…</button>' });
  if (product.status === "failed")
    return cubbyTile({ ...base, note: product.error || "Arcade couldn't build this", chip: "Failed", chipTone: "error", action: `<button class="cubby-action" data-cubby-make="${escapeHtml(item.categoryId)}">Try again</button>` });
  const selected = !state.cubbyDeselected.has(product.id);
  return cubbyTile({
    ...base,
    image: product.imageUrl || item.imageUrl,
    title: product.title || item.name,
    note: product.selectionLabel || item.note,
    chip: product.unitPrice ? formatPrice(product.unitPrice) : "Ready",
    chipTone: "ready",
    action: `<label class="cubby-action cubby-pick"><input type="checkbox" data-cubby-pick="${escapeHtml(product.id)}" ${selected ? "checked" : ""}> Include in order</label>`,
  });
}
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
  let products = [];
  if (design) {
    try {
      if (!arcade.products[design.id]) {
        arcade.products[design.id] = (await api(`/api/arcade-products?designId=${encodeURIComponent(design.id)}`)).products;
        arcade.products[design.id].filter((p) => p.status === "running").forEach((p) => pollArcadeProduct(design.id, p.id));
      }
      products = arcade.products[design.id];
    } catch {
      products = [];
    }
  }
  if (arcade.signedIn === false)
    note.innerHTML = `<a href="${SIGN_IN_URL}">Sign in with ChatGPT</a> to fill these shelves with ${escapeHtml(petName(pet))}'s designs.`;
  else if (!arcade.configured)
    note.textContent = "Arcade isn't connected on this site yet, so these shelves show what we'd make.";
  else if (!design)
    note.innerHTML = `<a href="#/designs">Generate a pattern</a> to fill these shelves with ${escapeHtml(petName(pet))}'s look.`;
  else note.innerHTML = `Shelved in <b>${escapeHtml(design.name)}</b>. Make any piece, then order everything that's ready in one checkout.`;

  const stickers = (pet.characters || []).filter((c) => c.status === "succeeded").slice(0, 3);
  $("#cubbyShelves").innerHTML = SHELVES.map((shelf) => {
    const tiles = [
      ...catalog.filter((item) => item.useCase === shelf.id).map((item) => arcadeTile(item, design, products)),
      ...(shelf.id === "keepsake"
        ? stickers.map((s) =>
            cubbyTile({
              image: s.imageUrl,
              title: s.name,
              note: "Transparent PNG, ready to print",
              chip: "Sticker · Meshy",
              art: "sticker-tile",
              action: `<a class="cubby-action" href="${escapeHtml(s.imageUrl)}?download=1">Download</a>`,
            }),
          )
        : []),
      ...CONCEPT_ITEMS.filter((item) => item.useCase === shelf.id).map((item) =>
        cubbyTile({
          title: item.name,
          note: "Not orderable yet",
          chip: "Concept",
          chipTone: "concept",
          art: `shelf-${shelf.id}`,
          action: `<a class="cubby-action" href="product.html?product=${item.slug}&pet=${encodeURIComponent(petName(pet))}">Details</a>`,
        }),
      ),
    ];
    return `<section class="cubby-shelf" aria-labelledby="shelf-${shelf.id}"><header><h3 id="shelf-${shelf.id}">${shelf.label}</h3><span>${shelf.blurb}</span></header><div class="cubby-row">${tiles.join("")}</div></section>`;
  }).join("");

  $$("[data-cubby-make]").forEach((btn) =>
    btn.addEventListener("click", () => makeArcadeProduct(design.id, btn.dataset.cubbyMake)),
  );
  $$("[data-cubby-pick]").forEach((box) =>
    box.addEventListener("change", () => {
      if (box.checked) state.cubbyDeselected.delete(box.dataset.cubbyPick);
      else state.cubbyDeselected.add(box.dataset.cubbyPick);
      updateCubbyOrder(products);
    }),
  );
  updateCubbyOrder(products);
}
function cubbyOrderLines(products) {
  return products.filter((p) => p.status === "succeeded" && !state.cubbyDeselected.has(p.id));
}
function updateCubbyOrder(products) {
  const lines = cubbyOrderLines(products),
    btn = $("#orderCubby");
  btn.disabled = !lines.length;
  const currencies = new Set(lines.map((p) => p.unitPrice?.currency).filter(Boolean));
  const total =
    lines.length && currencies.size === 1 && lines.every((p) => p.unitPrice)
      ? ` · ${formatPrice({ currency: [...currencies][0], amount: String(lines.reduce((sum, p) => sum + Number(p.unitPrice.amount), 0)) })}`
      : "";
  btn.innerHTML = lines.length
    ? `Order ${lines.length} ready piece${lines.length > 1 ? "s" : ""}${escapeHtml(total)} <span>→</span>`
    : "Order what’s ready <span>→</span>";
  btn.dataset.productIds = lines.map((p) => p.id).join(",");
}
$("#orderCubby").addEventListener("click", (e) =>
  openArcadeCheckout(e.currentTarget.dataset.productIds.split(",").filter(Boolean), e.currentTarget),
);
function renderCubbyPet(pet) {
  const slot = $("#cubbyModel"),
    ready = pet.twinJob?.status === "ready" && pet.twinJob.modelUrl;
  $(".cubby-pet").classList.toggle("has-3d-model", Boolean(ready));
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

syncPetUI();
renderRoute();
loadArcadeDesigns();
loadPetMedia();
