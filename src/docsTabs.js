/** Controla a troca de abas na página de ajuda (docs.html). */

const tabs = document.querySelectorAll(".docs-tab");
const panels = document.querySelectorAll(".docs-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    panels.forEach((p) => p.classList.remove("active"));

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});
