const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
};

const validScreens = ["inicio", "menu", "horno", "consentidos"];
const screens = [...document.querySelectorAll("[data-screen]")];
const navButtons = [...document.querySelectorAll("[data-go]")];
const branchDialog = document.querySelector("#branchDialog");
let branch = storage.get("koooben.branch", "UPIICSA Sociales");

function showScreen(name, updateHash = true, moveFocus = true) {
  const target = validScreens.includes(name) ? name : "inicio";
  const targetScreen = screens.find((screen) => screen.dataset.screen === target);
  screens.forEach((screen) => screen.classList.toggle("active", screen === targetScreen));
  document.querySelectorAll("[data-go]").forEach((button) => {
    const active = button.dataset.go === target;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (updateHash && location.hash !== `#${target}`) history.pushState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  if (moveFocus && targetScreen) {
    const heading = targetScreen.querySelector("h1");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
}

function branchConfig() {
  return window.KOOOBEN_CONFIG?.branches?.[branch] || {};
}

function updateBranchUI() {
  document.querySelector("#branchShort").textContent = branch;
  document.querySelector("#menuBranchCopy").textContent = branch;
  document.querySelector("#ovenBranchCopy").textContent = branch;
  const option = document.querySelector(`input[name="branch"][value="${CSS.escape(branch)}"]`);
  if (option) option.checked = true;

  const rappi = document.querySelector("#rappiLink");
  const rappiUrl = branchConfig().rappiUrl;
  if (rappiUrl) {
    rappi.href = rappiUrl;
    rappi.target = "_blank";
    rappi.rel = "noopener noreferrer";
    rappi.textContent = "Abrir Rappi ↗";
    rappi.classList.remove("disabled");
    rappi.removeAttribute("aria-disabled");
  } else {
    rappi.removeAttribute("href");
    rappi.textContent = "Rappi pendiente";
    rappi.classList.add("disabled");
    rappi.setAttribute("aria-disabled", "true");
  }
  renderStream();
}

function renderStream() {
  const frame = document.querySelector("#streamFrame");
  const sourceLink = document.querySelector("#streamSourceLink");
  const streamUrl = branchConfig().streamUrl;
  frame.innerHTML = "";
  sourceLink.classList.add("hidden");
  if (!streamUrl) {
    frame.innerHTML = '<div class="stream-empty"><span class="stream-icon">◉</span><strong>Sin transmisión configurada</strong><p>Cuando exista una URL oficial compatible, la vista en vivo aparecerá aquí.</p></div>';
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.src = streamUrl;
  iframe.title = `Transmisión en vivo de Kóoben · ${branch}`;
  iframe.loading = "lazy";
  iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  frame.append(iframe);
  sourceLink.href = streamUrl.replace("/embed/", "/watch?v=").split("?")[0] + "?v=" + (streamUrl.match(/embed\/([^?]+)/)?.[1] || "PC8nOb8cTNg");
  sourceLink.classList.remove("hidden");
}

navButtons.forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.go)));
document.querySelector("#branchButton").addEventListener("click", () => branchDialog.showModal());
document.querySelector("#saveBranch").addEventListener("click", () => {
  const selected = document.querySelector('input[name="branch"]:checked');
  if (!selected) return;
  branch = selected.value;
  storage.set("koooben.branch", branch);
  updateBranchUI();
});

const loggedOut = document.querySelector("#loggedOutPanel");
const loggedIn = document.querySelector("#loggedInPanel");

function renderMember() {
  const profile = storage.get("koooben.profile", null);
  loggedOut.classList.toggle("hidden", Boolean(profile));
  loggedIn.classList.toggle("hidden", !profile);
  if (!profile) return;
  document.querySelector("#memberName").textContent = profile.name;
  document.querySelector("#profileName").value = profile.name;
  document.querySelector("#profileEmail").value = profile.email || "";
}

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#loginName").value.trim();
  if (!name) return;
  storage.set("koooben.profile", { name, email: "" });
  renderMember();
});

document.querySelector("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#profileName").value.trim();
  const email = document.querySelector("#profileEmail").value.trim();
  if (!name) return;
  storage.set("koooben.profile", { name, email });
  document.querySelector("#saveMessage").textContent = "Guardado en este dispositivo.";
  renderMember();
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  localStorage.removeItem("koooben.profile");
  document.querySelector("#loginForm").reset();
  renderMember();
});

document.querySelector("#newsletterForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#newsletterName").value.trim();
  if (!name) return;
  storage.set("koooben.newsletter", { name, email: document.querySelector("#newsletterEmail").value.trim() });
  document.querySelector("#newsletterMessage").textContent = "Listo: te avisaremos de las próximas novedades.";
  event.currentTarget.reset();
});

updateBranchUI();
renderMember();
if (!validScreens.includes(location.hash.slice(1))) history.replaceState(null, "", "#inicio");
showScreen(location.hash.slice(1), false, false);
addEventListener("hashchange", () => showScreen(location.hash.slice(1), false));
