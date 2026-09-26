const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
};

const validScreens = ["inicio", "menu", "paquetes", "promociones", "lanzamientos", "horno", "consentidos", "verificar"];
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
  document.querySelector("#availableBranch").textContent = branch;
  const option = document.querySelector(`input[name="branch"][value="${CSS.escape(branch)}"]`);
  if (option) option.checked = true;

  const rappiUrl = branchConfig().rappiUrl;
  document.querySelectorAll("[data-rappi-link]").forEach((link) => {
    if (rappiUrl) { link.href = rappiUrl; link.classList.remove("disabled"); link.removeAttribute("aria-disabled"); }
    else { link.removeAttribute("href"); link.classList.add("disabled"); link.setAttribute("aria-disabled", "true"); }
  });
  const rappi = document.querySelector("#rappiLink");
  if (rappiUrl) rappi.textContent = "Pedir en Rappi ↗";
  renderAvailableNow();
  renderStream();
}

function renderAvailableNow() {
  const list = document.querySelector("#availableList");
  if (!list) return;
  list.innerHTML = (branchConfig().availableNow || []).map((item) => `<span class="available-pill"><i></i>${item}</span>`).join("");
}

function setMenuCategory(category) {
  document.querySelectorAll("[data-menu-category]").forEach((button) => {
    const active = button.dataset.menuCategory === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-menu-panel]").forEach((panel) => {
    const active = panel.dataset.menuPanel === category;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function youtubeVideoId(url) {
  const value = String(url || "");
  return value.match(/[?&]v=([^&]+)/)?.[1] || value.match(/embed\/([^?&]+)/)?.[1] || "";
}

function youtubeEmbedUrl(url) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : url;
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
  iframe.src = youtubeEmbedUrl(streamUrl);
  iframe.title = `Transmisión en vivo de Kóoben · ${branch}`;
  iframe.loading = "lazy";
  iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  frame.append(iframe);
  sourceLink.href = youtubeVideoId(streamUrl) ? `https://www.youtube.com/watch?v=${youtubeVideoId(streamUrl)}` : streamUrl;
  sourceLink.classList.remove("hidden");
}

const verificationCopy = {
  valid: { label: "Válido", title: "Identificador auténtico", message: "El identificador está vigente." },
  revoked: { label: "Revocado", title: "Identificador revocado", message: "Este identificador fue revocado y ya no es válido." },
  expired: { label: "Expirado", title: "Identificador expirado", message: "La fecha de vigencia de este identificador terminó." },
  not_found: { label: "No encontrado", title: "Identificador no encontrado", message: "Revisa que el enlace o token estén completos." },
  connection_error: { label: "Error de conexión", title: "No se pudo verificar", message: "No pudimos conectar con el servicio. Intenta nuevamente en unos minutos." }
};

const verificationForm = document.querySelector("#verificationForm");
const verificationInput = document.querySelector("#verificationToken");
const verificationSubmit = document.querySelector("#verificationSubmit");
const verificationStatus = document.querySelector("#verificationStatus");
const verificationResult = document.querySelector("#verificationResult");

function verificationApiUrl() {
  return (window.KOOOBEN_CONFIG?.tlatolliApiUrl || "").replace(/\/$/, "");
}

function formatVerificationDate(value) {
  if (!value) return "No indicada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

function appendVerificationDetail(list, label, value) {
  const item = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value || "No indicada";
  item.append(term, description);
  list.append(item);
}

function renderVerificationResult(status, tlatolli) {
  const copy = verificationCopy[status] || verificationCopy.connection_error;
  const resultClass = status === "connection_error" ? "connection-error" : status;
  verificationResult.className = `verification-result ${resultClass}`;
  verificationResult.replaceChildren();

  const mark = document.createElement("span");
  mark.className = "verification-result-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = status === "valid" ? "✓" : "!";

  const label = document.createElement("p");
  label.className = "verification-result-label";
  label.textContent = copy.label;

  const title = document.createElement("h2");
  title.textContent = copy.title;

  const message = document.createElement("p");
  message.className = "verification-result-message";
  message.textContent = copy.message;

  verificationResult.append(mark, label, title, message);

  if (tlatolli) {
    const details = document.createElement("dl");
    details.className = "verification-details";
    appendVerificationDetail(details, "Código", tlatolli.codigoTlatolli);
    appendVerificationDetail(details, "Nombre", tlatolli.nombrePublico);
    appendVerificationDetail(details, "Tipo", tlatolli.tipo);
    appendVerificationDetail(details, "Emisión", formatVerificationDate(tlatolli.fechaEmision));
    appendVerificationDetail(details, "Expiración", formatVerificationDate(tlatolli.fechaExpiracion));
    verificationResult.append(details);
  }

  const disclaimer = document.createElement("p");
  disclaimer.className = "verification-disclaimer";
  disclaimer.textContent = "La información mostrada es pública y corresponde al estado actual del identificador.";
  verificationResult.append(disclaimer);
}

verificationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = verificationInput.value.trim();
  if (!token) {
    verificationStatus.textContent = "Escribe un token para iniciar la consulta.";
    verificationInput.focus();
    return;
  }

  const apiUrl = verificationApiUrl();
  if (!apiUrl) {
    renderVerificationResult("connection_error");
    verificationStatus.textContent = "Error de conexión: servicio no configurado.";
    return;
  }

  verificationSubmit.disabled = true;
  verificationSubmit.setAttribute("aria-busy", "true");
  verificationResult.classList.add("hidden");
  verificationStatus.textContent = "Consultando el estado del identificador…";

  try {
    const response = await fetch(`${apiUrl}/api/public/verificar/${encodeURIComponent(token)}`, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    const status = ["valid", "revoked", "expired", "not_found"].includes(payload?.status)
      ? payload.status
      : response.status === 404 ? "not_found" : null;
    if (!status) throw new Error("Verification request failed");
    renderVerificationResult(status, payload.tlatolli);
    verificationStatus.textContent = `Consulta completada: ${verificationCopy[status].label}.`;
  } catch {
    renderVerificationResult("connection_error");
    verificationStatus.textContent = "Error de conexión. Intenta nuevamente en unos minutos.";
  } finally {
    verificationResult.classList.remove("hidden");
    verificationSubmit.disabled = false;
    verificationSubmit.removeAttribute("aria-busy");
  }
});

navButtons.forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.go)));
document.querySelectorAll("[data-menu-category]").forEach((button) => button.addEventListener("click", () => {
  setMenuCategory(button.dataset.menuCategory);
  showScreen("menu");
}));
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

function ensureMemberId(profile) {
  if (profile.memberId) return profile.memberId;
  const memberId = `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  profile.memberId = memberId;
  storage.set("koooben.profile", profile);
  return memberId;
}

function renderMember() {
  const profile = storage.get("koooben.profile", null);
  loggedOut.classList.toggle("hidden", Boolean(profile));
  loggedIn.classList.toggle("hidden", !profile);
  if (!profile) return;
  ensureMemberId(profile);
  document.querySelector("#memberName").textContent = profile.name;
  document.querySelector("#profileName").value = profile.name;
  document.querySelector("#profileEmail").value = profile.email || "";
  updateWalletState();
}

function walletEndpoint(name) {
  return (window.KOOOBEN_CONFIG?.[name] || "").replace(/\/$/, "");
}

function walletProfile() {
  const profile = storage.get("koooben.profile", null);
  return profile ? { ...profile, memberId: ensureMemberId(profile) } : null;
}

function updateWalletState() {
  const profile = walletProfile();
  const googleButton = document.querySelector("#googleWalletButton");
  const appleButton = document.querySelector("#appleWalletButton");
  const walletMessage = document.querySelector("#walletMessage");
  if (!googleButton || !appleButton || !walletMessage || !profile) return;
  const googleReady = Boolean(walletEndpoint("googleWalletApiUrl"));
  const appleReady = Boolean(walletEndpoint("appleWalletApiUrl") || walletEndpoint("walletApiUrl"));
  googleButton.disabled = false;
  appleButton.disabled = false;
  walletMessage.textContent = googleReady || appleReady ? "Selecciona una wallet para guardar tu pase." : "Los enlaces de Google Wallet y Apple Wallet están pendientes de configuración.";
}

async function downloadAppleWalletPass() {
  const profile = walletProfile();
  const walletMessage = document.querySelector("#walletMessage");
  const walletButton = document.querySelector("#appleWalletButton");
  const apiUrl = walletEndpoint("appleWalletApiUrl") || walletEndpoint("walletApiUrl");
  if (!profile || !apiUrl) {
    walletMessage.textContent = "El enlace de Apple Wallet aún no está configurado.";
    return;
  }
  walletButton.disabled = true;
  walletMessage.textContent = "Preparando tu pase de Apple Wallet…";
  try {
    const query = new URLSearchParams({ name: profile.name, email: profile.email || "", memberId: profile.memberId });
    const response = await fetch(`${apiUrl}/api/wallet/pass?${query}`);
    if (!response.ok) throw new Error("No se pudo generar el pase de Apple Wallet");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "kooben-consentidos.pkpass";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    walletMessage.textContent = "Pase listo. Ábrelo desde tu iPhone para agregarlo a Apple Wallet.";
  } catch (error) {
    walletMessage.textContent = error.message || "No se pudo crear el pase de Apple Wallet.";
  } finally {
    walletButton.disabled = false;
  }
}

async function addGoogleWalletPass() {
  const profile = walletProfile();
  const walletMessage = document.querySelector("#walletMessage");
  const walletButton = document.querySelector("#googleWalletButton");
  const apiUrl = walletEndpoint("googleWalletApiUrl");
  if (!profile || !apiUrl) {
    walletMessage.textContent = "El enlace de Google Wallet aún no está configurado.";
    return;
  }
  walletButton.disabled = true;
  walletMessage.textContent = "Preparando tu pase de Google Wallet…";
  try {
    const response = await fetch(`${apiUrl}/wallet/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: profile.memberId, name: profile.name, email: profile.email || "demo@kooben.local", points: 120, plan: "Consentido Kóoben", status: "Activo" })
    });
    const payload = await response.json();
    if (!response.ok || !payload.saveUrl) throw new Error(payload.error || "No se pudo generar el pase de Google Wallet");
    window.open(payload.saveUrl, "_blank", "noopener,noreferrer");
    walletMessage.textContent = "Pase listo. Se abrió la ventana para guardarlo en Google Wallet.";
  } catch (error) {
    walletMessage.textContent = error.message || "No se pudo crear el pase de Google Wallet.";
  } finally {
    walletButton.disabled = false;
  }
}

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#loginName").value.trim();
  if (!name) return;
  storage.set("koooben.profile", { name, email: "", memberId: `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` });
  renderMember();
});

document.querySelector("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#profileName").value.trim();
  const email = document.querySelector("#profileEmail").value.trim();
  if (!name) return;
  const profile = storage.get("koooben.profile", {});
  storage.set("koooben.profile", { ...profile, name, email });
  document.querySelector("#saveMessage").textContent = "Guardado en este dispositivo.";
  renderMember();
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  localStorage.removeItem("koooben.profile");
  document.querySelector("#loginForm").reset();
  renderMember();
});

document.querySelector("#googleWalletButton").addEventListener("click", addGoogleWalletPass);
document.querySelector("#appleWalletButton").addEventListener("click", downloadAppleWalletPass);

document.querySelector("#newsletterForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#newsletterName").value.trim();
  if (!name) return;
  storage.set("koooben.newsletter", { name, email: document.querySelector("#newsletterEmail").value.trim() });
  document.querySelector("#newsletterMessage").textContent = "Listo: te avisaremos de las próximas novedades.";
  event.currentTarget.reset();
});

updateBranchUI();
setMenuCategory("especialidades");
renderMember();
updateWalletState();
if (!validScreens.includes(location.hash.slice(1))) history.replaceState(null, "", "#inicio");
showScreen(location.hash.slice(1), false, false);
addEventListener("hashchange", () => showScreen(location.hash.slice(1), false));
