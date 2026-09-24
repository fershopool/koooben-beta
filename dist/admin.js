const adminScreens = [...document.querySelectorAll("[data-admin-screen]")];
const adminTabs = [...document.querySelectorAll("[data-admin-go]")];

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
  if (focus) button.focus();
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

const demoByBranch = {
  "UPIICSA Sociales": { visits: "48", points: "5,760", redemptions: "7" },
  "UPIICSA Graduados": { visits: "31", points: "3,720", redemptions: "4" }
};
const adminBranch = document.querySelector("#adminBranch");

function renderBranch(name) {
  const values = demoByBranch[name];
  document.querySelector("#metricVisits").textContent = values.visits;
  document.querySelector("#metricPoints").textContent = values.points;
  document.querySelector("#metricRedemptions").textContent = values.redemptions;
}

try {
  const savedBranch = JSON.parse(localStorage.getItem("koooben.branch"));
  if (demoByBranch[savedBranch]) adminBranch.value = savedBranch;
} catch {}
renderBranch(adminBranch.value);
adminBranch.addEventListener("change", (event) => renderBranch(event.target.value));

document.querySelector("#scanDemoForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#scanName").value.trim();
  if (!name) return;
  document.querySelector("#scanResultName").textContent = name;
  document.querySelector("#scanInitial").textContent = name.charAt(0).toUpperCase();
  document.querySelector("#scanResult").classList.remove("hidden");
});
