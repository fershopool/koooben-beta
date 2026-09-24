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
