
const pages = {
  home: {
    title: "الرئيسية",
    description: "مرحباً بك في تجربة DramaTV Desktop."
  },
  movies: {
    title: "الأفلام",
    description: "اكتشف مكتبة الأفلام المتنوعة."
  },
  series: {
    title: "المسلسلات",
    description: "تابع أحدث المسلسلات العربية والعالمية."
  },
  channels: {
    title: "القنوات",
    description: "قنواتك المفضلة في مكان واحد."
  },
  search: {
    title: "البحث",
    description: "ابحث عن الأفلام والمسلسلات التي تحبها."
  }
};

function openPage(pageName) {
  const page = pages[pageName];

  if (!page) return;

  document.getElementById("page-title").textContent = page.title;
  document.getElementById("page-description").textContent =
    page.description;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    openPage(button.dataset.page);
  });
});

openPage("home");
