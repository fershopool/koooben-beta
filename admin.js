const adminScreens = [...document.querySelectorAll("[data-admin-screen]")];
const adminTabs = [...document.querySelectorAll("[data-admin-go]")];
let qrStream = null;
let qrFrame = null;
let qrDetector = null;
let qrScanMode = null;
let qrCanvasContext = null;
let qrScanBusy = false;
let pendingScanToken = "";

function activateTab(button, focus = false) {
  adminTabs.forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
  });
  adminScreens.forEach((screen) => {
    const active = screen.dataset.adminScreen === button.dataset.adminGo;
    screen.classList.toggle("active", active);
    screen.hidden = !active;
  });
  if (button.dataset.adminGo !== "qr") stopQrScanner();
  if (focus) button.focus();
}

const demoByBranch = {
  "UPIICSA Sociales": { visits: "48", points: "5,760", redemptions: "7" },
  "UPIICSA Graduados": { visits: "31", points: "3,720", redemptions: "4" }
};

function renderBranch(name) {
  const values = demoByBranch[name];
  document.querySelector("#metricVisits").textContent = values.visits;
  document.querySelector("#metricPoints").textContent = values.points;
  document.querySelector("#metricRedemptions").textContent = values.redemptions;
}

function stopQrScanner() {
  if (qrFrame) cancelAnimationFrame(qrFrame);
  qrFrame = null;
  if (qrStream) qrStream.getTracks().forEach((track) => track.stop());
  qrStream = null;
  qrDetector = null;
  qrScanMode = null;
  qrScanBusy = false;
  const video = document.querySelector("#qrVideo");
  document.querySelector("#qrScannerPreview")?.classList.remove("is-live");
  if (video) {
    video.srcObject = null;
    video.classList.add("hidden");
  }
  const button = document.querySelector("#startQrButton");
  if (button) button.textContent = "Solicitar permiso y activar cámara";
}

async function lookupBackendQr(code) {
  const raw = String(code || "").trim();
  const result = document.querySelector("#scanResult");
  const confirmation = document.querySelector("#scanConfirmation");
  if (!raw) {
    pendingScanToken = "";
    result.classList.add("hidden");
    confirmation.classList.add("hidden");
    document.querySelector("#scanMessage").textContent = "Captura un folio o enlace de verificación.";
    return;
  }
  if (!koobenApiUrl) {
    document.querySelector("#scanMessage").textContent = "Configura KOOOBEN_CONFIG.koobenApiUrl.";
    return;
  }

  const submitButton = document.querySelector("#scanForm button[type=submit]");
  submitButton.disabled = true;
  document.querySelector("#scanMessage").textContent = "Consultando el QR…";
  try {
    const response = await fetch(koobenApiUrl + "/api/admin/kooben/scan", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: raw })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "No se pudo consultar el QR.");

    pendingScanToken = raw;
    document.querySelector("#scanInitial").textContent = String(body.nombre || "Cliente").charAt(0).toUpperCase();
    document.querySelector("#scanName").textContent = body.nombre || "Cliente";
    document.querySelector("#scanDetails").textContent = `${body.celular} · ${body.codigoTlatolli}`;
    document.querySelector("#scanPoints").textContent = "Pendiente";
    document.querySelector("#scanOpenLink").classList.add("hidden");
    document.querySelector("#scanQr").classList.add("hidden");
    document.querySelector("#scanQr").removeAttribute("src");
    result.classList.remove("hidden");
    confirmation.classList.remove("hidden");
    document.querySelector("#manualQrCode").value = raw;
    document.querySelector("#scanMessage").textContent = "Cliente encontrado. Confirma el escaneo para generar un nuevo QR.";
  } catch (error) {
    pendingScanToken = "";
    result.classList.add("hidden");
    confirmation.classList.add("hidden");
    document.querySelector("#scanMessage").textContent = error.message || "No se pudo consultar el QR.";
  } finally {
    submitButton.disabled = false;
  }
}

async function confirmBackendScan() {
  if (!pendingScanToken) return;
  if (!window.confirm("¿Confirmar el escaneo? El QR actual quedará inválido y se generará uno nuevo.")) return;

  const token = pendingScanToken;
  const button = document.querySelector("#confirmScanButton");
  let confirmed = false;
  button.disabled = true;
  document.querySelector("#scanMessage").textContent = "Confirmando escaneo…";
  try {
    const response = await fetch(koobenApiUrl + "/api/admin/kooben/scan/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "No se pudo confirmar el escaneo.");

    const qr = document.querySelector("#scanQr");
    qr.src = body.qrDataUrl;
    qr.classList.remove("hidden");
    const openLink = document.querySelector("#scanOpenLink");
    openLink.href = body.verificationUrl;
    openLink.classList.remove("hidden");
    document.querySelector("#scanPoints").textContent = "Confirmado";
    document.querySelector("#scanMessage").textContent = "Escaneo confirmado. El QR anterior ya no es válido.";
    confirmed = true;
  } catch (error) {
    document.querySelector("#scanMessage").textContent = error.message || "No se pudo confirmar el escaneo.";
  } finally {
    if (confirmed) {
      pendingScanToken = "";
      document.querySelector("#manualQrCode").value = "";
      document.querySelector("#scanConfirmation").classList.add("hidden");
    }
    button.disabled = false;
  }
}

function scheduleQrFrame() {
  if (qrStream) qrFrame = requestAnimationFrame(scanQrFrame);
}

async function scanQrFrame() {
  if (!qrStream || qrScanBusy) {
    scheduleQrFrame();
    return;
  }
  const video = document.querySelector("#qrVideo");
  if (!video || video.readyState < 2 || !video.videoWidth) {
    scheduleQrFrame();
    return;
  }
  qrScanBusy = true;
  try {
    let rawValue = "";
    if (qrScanMode === "native") {
      const results = await qrDetector.detect(video);
      rawValue = results[0]?.rawValue || "";
    } else if (qrScanMode === "jsqr") {
      const canvas = document.querySelector("#qrCanvas");
      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      qrCanvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
      rawValue = window.jsQR(qrCanvasContext.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" })?.data || "";
    }
    if (rawValue) {
      stopQrScanner();
      await lookupBackendQr(rawValue);
      document.querySelector("#qrCameraStatus").textContent = "Código leído. Puedes escanear otro folio cuando quieras.";
      return;
    }
  } catch {}
  qrScanBusy = false;
  scheduleQrFrame();
}

async function startQrScanner() {
  const status = document.querySelector("#qrCameraStatus");
  const button = document.querySelector("#startQrButton");
  if (qrStream) {
    stopQrScanner();
    status.textContent = "Cámara detenida.";
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = "La cámara requiere HTTPS o localhost. Usa el folio manual mientras tanto.";
    return;
  }
  const canvas = document.querySelector("#qrCanvas");
  qrCanvasContext = canvas.getContext("2d", { willReadFrequently: true });
  if (window.BarcodeDetector) {
    try {
      const formats = window.BarcodeDetector.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats() : ["qr_code"];
      if (formats.includes("qr_code")) {
        qrDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
        qrScanMode = "native";
      }
    } catch {}
  }
  if (!qrScanMode && typeof window.jsQR === "function") qrScanMode = "jsqr";
  if (!qrScanMode) {
    status.textContent = "Este navegador no tiene lector QR disponible. Usa el folio manual.";
    return;
  }
  button.disabled = true;
  status.textContent = "Solicitando permiso para usar la cámara…";
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const video = document.querySelector("#qrVideo");
    video.srcObject = qrStream;
    video.classList.remove("hidden");
    document.querySelector("#qrScannerPreview")?.classList.add("is-live");
    status.textContent = "Apunta la cámara al QR del pase.";
    button.textContent = "Detener cámara";
    await video.play().catch(() => {});
    qrFrame = requestAnimationFrame(scanQrFrame);
  } catch (error) {
    stopQrScanner();
    const message = error?.name === "NotAllowedError" ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador." : error?.name === "NotFoundError" ? "No se encontró una cámara disponible en este dispositivo." : "No se pudo activar la cámara; usa el folio manual.";
    status.textContent = message;
  } finally {
    button.disabled = false;
  }
}

adminTabs.forEach((button, index) => {
  button.addEventListener("click", () => activateTab(button));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? adminTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + adminTabs.length) % adminTabs.length;
    activateTab(adminTabs[next], true);
  });
});

const adminBranch = document.querySelector("#adminBranch");
try {
  const savedBranch = JSON.parse(localStorage.getItem("koooben.branch"));
  if (demoByBranch[savedBranch]) adminBranch.value = savedBranch;
} catch {}
renderBranch(adminBranch.value);
adminBranch.addEventListener("change", (event) => renderBranch(event.target.value));

const koobenConfig = window.KOOOBEN_CONFIG || {};
const koobenApiUrl = String(koobenConfig.koobenApiUrl || "").replace(/\/$/, "");
let adminAuthenticated = false;

function setAuthMessage(message, error = false) {
  const element = document.querySelector("#adminAuthMessage");
  element.textContent = message;
  element.classList.toggle("danger", error);
}

function setCreateMessage(message, error = false) {
  const element = document.querySelector("#createUserMessage");
  element.textContent = message;
  element.classList.toggle("danger", error);
}

function setAuthState(authenticated) {
  adminAuthenticated = authenticated;
  document.querySelector("#adminLoginForm").classList.toggle("hidden", authenticated);
  document.querySelector("#adminLogoutButton").classList.toggle("hidden", !authenticated);
  document.querySelector("#registerUserForm button[type=submit]").disabled = !authenticated;
  if (authenticated) setAuthMessage("Sesión activa.");
}

async function checkAdminSession() {
  if (!koobenApiUrl) {
    setAuthMessage("Configura KOOOBEN_CONFIG.koobenApiUrl.", true);
    return;
  }
  try {
    const response = await fetch(koobenApiUrl + "/api/admin/kooben/clients", {
      credentials: "include",
      cache: "no-store"
    });
    setAuthState(response.ok);
  } catch {
    setAuthMessage("No se pudo conectar con el backend.", true);
  }
}

document.querySelector("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!koobenApiUrl) {
    setAuthMessage("Configura KOOOBEN_CONFIG.koobenApiUrl.", true);
    return;
  }
  const email = document.querySelector("#adminEmail").value.trim();
  const password = document.querySelector("#adminPassword").value;
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  setAuthMessage("Verificando acceso...");
  try {
    const response = await fetch(koobenApiUrl + "/api/admin/kooben/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "No se pudo iniciar sesión.");
    document.querySelector("#adminPassword").value = "";
    setAuthState(true);
  } catch (error) {
    setAuthState(false);
    setAuthMessage(error.message || "No se pudo iniciar sesión.", true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#adminLogoutButton").addEventListener("click", async () => {
  await fetch(koobenApiUrl + "/api/admin/kooben/logout", {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
  setAuthState(false);
  setAuthMessage("Sesión cerrada.");
});

function showClientQr(client) {
  document.querySelector("#createdUserInitial").textContent = client.name.charAt(0).toUpperCase();
  document.querySelector("#createdUserName").textContent = client.name;
  document.querySelector("#createdUserDetails").textContent = client.phone + " · " + client.codigoTlatolli;
  document.querySelector("#createdUserFolio").textContent = client.codigoTlatolli;
  document.querySelector("#createdTlatolliLink").href = client.verificationUrl;
  const qr = document.querySelector("#createdTlatolliQr");
  qr.src = client.qrDataUrl;
  qr.classList.remove("hidden");
  document.querySelector("#createUserResult").classList.remove("hidden");
}

document.querySelector("#registerUserForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!adminAuthenticated) {
    setCreateMessage("Inicia sesión como administrador.", true);
    return;
  }
  const name = document.querySelector("#newUserName").value.trim();
  const country = document.querySelector("#newUserCountry").value;
  const phoneDigits = document.querySelector("#newUserPhone").value.replace(/\D/g, "");
  if (!name || !/^\d{10}$/.test(phoneDigits)) {
    setCreateMessage("Escribe un celular mexicano de 10 dígitos.", true);
    return;
  }
  const phone = country + phoneDigits;

  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setCreateMessage("Guardando cliente y enlazando identificador...");
  try {
    const response = await fetch(koobenApiUrl + "/api/admin/kooben/clients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: name, celular: phone })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "No se pudo crear el cliente.");
    const client = {
      clientId: body.clientId,
      tlatolliId: body.tlatolliId,
      name,
      phone: body.celular,
      codigoTlatolli: body.codigoTlatolli,
      verificationUrl: body.verificationUrl,
      qrDataUrl: body.qrDataUrl
    };
    showClientQr(client);
    setCreateMessage("Cliente creado. Identificador y QR enlazados.");
  form.reset();
  } catch (error) {
    setCreateMessage(error.message || "No se pudo crear el cliente.", true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#registerUserForm button[type=submit]").disabled = true;
checkAdminSession();

document.querySelector("#startQrButton").addEventListener("click", startQrScanner);
document.querySelector("#confirmScanButton").addEventListener("click", confirmBackendScan);
document.querySelector("#scanForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  stopQrScanner();
  await lookupBackendQr(document.querySelector("#manualQrCode").value);
});
