const adminScreens = [...document.querySelectorAll("[data-admin-screen]")];
const adminTabs = [...document.querySelectorAll("[data-admin-go]")];
let qrStream = null;
let qrFrame = null;
let qrDetector = null;

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
  const video = document.querySelector("#qrVideo");
  document.querySelector("#qrScannerPreview")?.classList.remove("is-live");
  if (video) {
    video.srcObject = null;
    video.classList.add("hidden");
  }
}

function readDemoQr(code) {
  const value = code.trim().toUpperCase();
  if (!value) return;
  const users = (() => { try { return JSON.parse(localStorage.getItem("koooben.adminUsers")) || []; } catch { return []; } })();
  const user = users.find((item) => item.id === value);
  const demo = user || { id: value, name: "Consentido demo", email: "demo@kooben.local", branch: adminBranch.value, points: 120 };
  document.querySelector("#scanInitial").textContent = demo.name.charAt(0).toUpperCase();
  document.querySelector("#scanName").textContent = demo.name;
  document.querySelector("#scanDetails").textContent = `${demo.points} puntos demo · ${demo.branch}`;
  document.querySelector("#scanPoints").textContent = demo.points;
  document.querySelector("#scanResult").classList.remove("hidden");
  document.querySelector("#scanMessage").textContent = user ? "Folio encontrado en los usuarios demo." : "Folio leído en modo demostración.";
  document.querySelector("#manualQrCode").value = value;
}

async function scanQrFrame() {
  if (!qrDetector || !qrStream) return;
  const video = document.querySelector("#qrVideo");
  try {
    const results = await qrDetector.detect(video);
    if (results[0]?.rawValue) {
      readDemoQr(results[0].rawValue);
      stopQrScanner();
      document.querySelector("#qrCameraStatus").textContent = "Código leído. Puedes escanear otro folio cuando quieras.";
      return;
    }
  } catch {}
  qrFrame = requestAnimationFrame(scanQrFrame);
}

async function startQrScanner() {
  const status = document.querySelector("#qrCameraStatus");
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = "La lectura automática no está disponible aquí; usa el folio manual.";
    return;
  }
  try {
    qrDetector = new BarcodeDetector({ formats: ["qr_code"] });
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const video = document.querySelector("#qrVideo");
    video.srcObject = qrStream;
    video.classList.remove("hidden");
    document.querySelector("#qrScannerPreview")?.classList.add("is-live");
    status.textContent = "Apunta la cámara al QR del pase.";
    qrFrame = requestAnimationFrame(scanQrFrame);
  } catch {
    stopQrScanner();
    status.textContent = "No se pudo activar la cámara; usa el folio manual.";
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

document.querySelector("#registerUserForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#newUserName").value.trim();
  const email = document.querySelector("#newUserEmail").value.trim();
  const branch = document.querySelector("#newUserBranch").value;
  if (!name || !email) return;
  const users = (() => { try { return JSON.parse(localStorage.getItem("koooben.adminUsers")) || []; } catch { return []; } })();
  const user = { id: `KOO-${String(users.length + 1).padStart(4, "0")}`, name, email, branch, points: 120, createdAt: new Date().toISOString() };
  users.push(user);
  localStorage.setItem("koooben.adminUsers", JSON.stringify(users));
  document.querySelector("#createdUserInitial").textContent = name.charAt(0).toUpperCase();
  document.querySelector("#createdUserName").textContent = name;
  document.querySelector("#createdUserDetails").textContent = `120 puntos demo · ${branch} · ${email}`;
  document.querySelector("#createdUserFolio").textContent = user.id;
  document.querySelector("#createUserResult").classList.remove("hidden");
  event.currentTarget.reset();
  document.querySelector("#newUserBranch").value = branch;
});

document.querySelector("#startQrButton").addEventListener("click", startQrScanner);
document.querySelector("#scanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  readDemoQr(document.querySelector("#manualQrCode").value);
});
