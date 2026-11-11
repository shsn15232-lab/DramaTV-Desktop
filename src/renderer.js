
const DATA_BASE =
  "https://raw.githubusercontent.com/shsn15232-lab/DramaTV-Data/main/";

const state = {
  page: "home",
  indexes: {},
  items: [],
  loadedParts: 0,
  currentParts: [],
  visibleCount: 36,
  loading: false,
  search: ""
};

const pages = {
  home: ["الرئيسية", "اكتشف مكتبة DramaTV"],
  movies: ["الأفلام", "مكتبة الأفلام"],
  series: ["المسلسلات", "مكتبة المسلسلات"]
};

const grid = document.getElementById("catalog-grid");
const statusBox = document.getElementById("status");
const titleBox = document.getElementById("page-title");
const descriptionBox = document.getElementById("page-description");
const searchInput = document.getElementById("search-input");
const loadMoreButton = document.getElementById("load-more");
const welcome = document.getElementById("welcome");

function setStatus(message) {
  statusBox.textContent = message;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("فشل تحميل البيانات: " + response.status);
  }

  return response.json();
}

async function getIndex(type) {
  if (state.indexes[type]) return state.indexes[type];

  const file = type === "movies"
    ? "movies_index.json"
    : "series_index.json";

  const index = await fetchJson(DATA_BASE + file);
  state.indexes[type] = index;

  return index;
}

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.movies)) return data.movies;
  if (Array.isArray(data.series)) return data.series;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function getName(item) {
  return item.name || item.title || item.series_name || "بدون عنوان";
}

function getCover(item) {
  return item.cover || item.poster || item.image || item.thumbnail || "";
}

function getDescription(item) {
  return item.plot || item.description || item.overview || "";
}

function createCard(item, type) {
  const card = document.createElement("article");
  card.className = "catalog-card";

  const imageBox = document.createElement("div");
  imageBox.className = "catalog-poster";

  const cover = getCover(item);

  if (cover) {
    const image = document.createElement("img");
    image.src = cover;
    image.alt = getName(item);
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    image.onerror = () => {
      image.remove();
      imageBox.classList.add("poster-fallback");
      imageBox.textContent = "DramaTV";
    };

    imageBox.appendChild(image);
  } else {
    imageBox.classList.add("poster-fallback");
    imageBox.textContent = "DramaTV";
  }

  const info = document.createElement("div");
  info.className = "catalog-info";

  const name = document.createElement("h3");
  name.textContent = getName(item);

  const meta = document.createElement("p");

  const genre = item.genre || item.category || "";
  const rating = item.rating && item.rating !== "0"
    ? " ★ " + item.rating
    : "";

  meta.textContent = String(genre) + rating;

  info.append(name, meta);
  card.append(imageBox, info);

  card.addEventListener("click", () => {
    showDetails(item, type);
  });

  return card;
}

function showDetails(item, type) {
  const old = document.getElementById("details-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "details-overlay";
  overlay.className = "details-overlay";

  const panel = document.createElement("div");
  panel.className = "details-panel";

  const heading = document.createElement("h2");
  heading.textContent = getName(item);

  const description = document.createElement("p");
  description.textContent =
    getDescription(item) || "لا يوجد وصف متاح حالياً.";

  const category = document.createElement("span");
  category.textContent = type === "movies" ? "فيلم" : "مسلسل";
  category.className = "details-category";

  const close = document.createElement("button");
  close.textContent = "إغلاق";
  close.className = "primary-button";
  close.addEventListener("click", () => overlay.remove());

  panel.append(category, heading, description, close);
  overlay.appendChild(panel);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

function renderItems() {
  grid.replaceChildren();

  const query = state.search.trim().toLowerCase();

  let filtered = state.items;

  if (query) {
    filtered = filtered.filter(item =>
      getName(item).toLowerCase().includes(query) ||
      String(item.genre || "").toLowerCase().includes(query)
    );
  }

  const visible = filtered.slice(0, state.visibleCount);

  visible.forEach(item => {
    grid.appendChild(createCard(item, state.page));
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = query
      ? "ما لقينا نتائج مطابقة."
      : "لا توجد عناصر للعرض حالياً.";

    grid.appendChild(empty);
  }

  loadMoreButton.hidden =
    query.length > 0 ||
    (state.visibleCount >= state.items.length &&
     state.loadedParts >= state.currentParts.length);

  if (!query) {
    setStatus(
      "تم تحميل " + state.items.length.toLocaleString("ar") + " عنصر"
    );
  } else {
    setStatus(
      "نتائج البحث: " + filtered.length.toLocaleString("ar")
    );
  }
}

async function loadNextPart() {
  if (state.loading) return;

  if (state.loadedParts >= state.currentParts.length) {
    setStatus("وصلت إلى نهاية المكتبة.");
    return;
  }

  state.loading = true;
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "جارٍ التحميل...";

  try {
    const part = state.currentParts[state.loadedParts];
    const url = DATA_BASE + part.path;
    const data = await fetchJson(url);
    const items = normalizeItems(data);

    state.items.push(...items);
    state.loadedParts++;

    renderItems();
  } catch (error) {
    console.error(error);
    setStatus("تعذر تحميل هذا الجزء. تحقق من الإنترنت وحاول مجدداً.");
  } finally {
    state.loading = false;
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "تحميل المزيد";
  }
}

async function openCatalog(type) {
  state.page = type;
  state.items = [];
  state.loadedParts = 0;
  state.visibleCount = 36;
  state.search = "";
  searchInput.value = "";

  grid.replaceChildren();
  welcome.hidden = type !== "home";

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === type
    );
  });

  titleBox.textContent = pages[type][0];
  descriptionBox.textContent = pages[type][1];

  setStatus("جارٍ الاتصال بمكتبة DramaTV...");
  loadMoreButton.hidden = true;

  try {
    if (type === "home") {
      const movieIndex = await getIndex("movies");
      const seriesIndex = await getIndex("series");

      const moviePart = movieIndex.parts[0];
      const seriesPart = seriesIndex.parts[0];

      const [movieData, seriesData] = await Promise.all([
        fetchJson(DATA_BASE + moviePart.path),
        fetchJson(DATA_BASE + seriesPart.path)
      ]);

      state.items = [
        ...normalizeItems(movieData).slice(0, 18),
        ...normalizeItems(seriesData).slice(0, 18)
      ];

      state.page = "movies";
      renderHomeCards();
      state.page = "home";

      setStatus(
        "المكتبة جاهزة — " +
        movieIndex.total_movies.toLocaleString("ar") +
        " فيلم و" +
        seriesIndex.total_series.toLocaleString("ar") +
        " مسلسل"
      );

      return;
    }

    const index = await getIndex(type);

    state.currentParts = index.parts;

    await loadNextPart();

  } catch (error) {
    console.error(error);
    setStatus("تعذر الاتصال بمكتبة البيانات. حاول مرة أخرى.");
  }
}

function renderHomeCards() {
  grid.replaceChildren();

  const moviesTitle = document.createElement("div");
  moviesTitle.className = "catalog-heading";
  moviesTitle.textContent = "أحدث الأفلام";

  const seriesTitle = document.createElement("div");
  seriesTitle.className = "catalog-heading";
  seriesTitle.textContent = "المسلسلات";

  const movieItems = state.items.slice(0, 18);
  const seriesItems = state.items.slice(18, 36);

  grid.appendChild(moviesTitle);

  movieItems.forEach(item => {
    grid.appendChild(createCard(item, "movies"));
  });

  grid.appendChild(seriesTitle);

  seriesItems.forEach(item => {
    grid.appendChild(createCard(item, "series"));
  });
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    if (pages[page]) openCatalog(page);
  });
});

document.querySelectorAll("[data-window-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.windowAction;

    if (action === "minimize") window.dramaWindow.minimize();
    if (action === "maximize") window.dramaWindow.maximize();
    if (action === "close") window.dramaWindow.close();
  });
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  state.visibleCount = 100;
  renderItems();
});

loadMoreButton.addEventListener("click", async () => {
  if (state.visibleCount < state.items.length) {
    state.visibleCount += 36;
    renderItems();
  } else {
    await loadNextPart();
  }
});

openCatalog("home");
