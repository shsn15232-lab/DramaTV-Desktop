
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
  search: "",
  playerUrl: null
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

function makeButton(text, className, action) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = className;
  button.addEventListener("click", action);
  return button;
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

  card.addEventListener("click", () => showDetails(item, type));

  return card;
}

function createOverlay(id, panelClass) {
  const old = document.getElementById(id);
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.className = "details-overlay";

  const panel = document.createElement("div");
  panel.className = panelClass;

  overlay.appendChild(panel);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  return { overlay, panel };
}

function addDetailText(parent, text, className = "") {
  const element = document.createElement("p");
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function showDetails(item, type) {
  const { overlay, panel } =
    createOverlay("details-overlay", "details-panel");

  const category = document.createElement("span");
  category.className = "details-category";
  category.textContent = type === "movies" ? "فيلم" : "مسلسل";

  const heading = document.createElement("h2");
  heading.textContent = getName(item);

  const description = document.createElement("p");
  description.textContent =
    getDescription(item) || "لا يوجد وصف متاح حالياً.";

  panel.append(category, heading, description);

  if (item.genre) {
    addDetailText(panel, "النوع: " + item.genre);
  }

  if (item.rating && item.rating !== "0") {
    addDetailText(panel, "التقييم: " + item.rating);
  }

  if (item.releasedate) {
    addDetailText(panel, "تاريخ الإصدار: " + item.releasedate);
  }

  if (item.cast) {
    addDetailText(panel, "طاقم العمل: " + item.cast);
  }

  if (item.director) {
    addDetailText(panel, "المخرج: " + item.director);
  }

  if (type === "movies") {
    panel.appendChild(
      makeButton("اختيار ملف الفيلم وتشغيله", "primary-button", () => {
        overlay.remove();
        chooseLocalVideo(getName(item));
      })
    );
  } else {
    renderSeasons(panel, item);
  }

  panel.appendChild(
    makeButton("إغلاق", "secondary-button", () => overlay.remove())
  );
}

function renderSeasons(panel, item) {
  const episodes = item.episodes;

  const heading = document.createElement("h3");
  heading.textContent = "المواسم والحلقات";
  heading.style.marginTop = "24px";
  panel.appendChild(heading);

  if (!episodes || typeof episodes !== "object") {
    addDetailText(panel, "لا توجد حلقات متاحة حالياً.");
    return;
  }

  const seasonKeys = Object.keys(episodes).sort((a, b) => {
    return Number(a) - Number(b);
  });

  if (!seasonKeys.length) {
    addDetailText(panel, "لا توجد حلقات متاحة حالياً.");
    return;
  }

  seasonKeys.forEach(seasonKey => {
    const seasonBox = document.createElement("section");
    seasonBox.className = "episode-season";

    const seasonTitle = document.createElement("h3");
    seasonTitle.textContent = "الموسم " + seasonKey;
    seasonBox.appendChild(seasonTitle);

    const list = document.createElement("div");
    list.className = "episode-list";

    const seasonEpisodes = Array.isArray(episodes[seasonKey])
      ? episodes[seasonKey]
      : [];

    seasonEpisodes.forEach((episode, index) => {
      const row = document.createElement("div");
      row.className = "episode-row";

      const episodeName = document.createElement("span");
      episodeName.textContent =
        episode.title ||
        ("الحلقة " + (episode.episode_num || index + 1));

      const playButton = makeButton(
        "اختيار ملف الحلقة",
        "primary-button",
        () => {
          chooseLocalVideo(
            getName(item) + " - " + episodeName.textContent
          );
        }
      );

      row.append(episodeName, playButton);
      list.appendChild(row);
    });

    seasonBox.appendChild(list);
    panel.appendChild(seasonBox);
  });
}

function chooseLocalVideo(title) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*,.mkv,.mp4,.avi,.mov,.webm";

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    openPlayer(url, title + " — " + file.name);
  });

  input.click();
}

function openPlayer(url, title) {
  closePlayer();

  state.playerUrl = url;

  const { overlay, panel } =
    createOverlay("player-overlay", "player-panel");

  const top = document.createElement("div");
  top.className = "player-top";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const close = makeButton("إغلاق", "secondary-button", () => {
    closePlayer();
  });

  top.append(heading, close);

  const video = document.createElement("video");
  video.className = "drama-video";
  video.controls = true;
  video.autoplay = true;
  video.preload = "metadata";
  video.src = url;

  video.addEventListener("error", () => {
    setStatus("تعذر تشغيل الملف. قد يكون الترميز غير مدعوم.");
  });

  panel.append(top, video);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closePlayer();
  });
}

function closePlayer() {
  const overlay = document.getElementById("player-overlay");

  if (overlay) {
    const video = overlay.querySelector("video");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    overlay.remove();
  }

  if (state.playerUrl) {
    URL.revokeObjectURL(state.playerUrl);
    state.playerUrl = null;
  }
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

  setStatus(query
    ? "نتائج البحث: " + filtered.length.toLocaleString("ar")
    : "تم تحميل " + state.items.length.toLocaleString("ar") + " عنصر"
  );
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
    const data = await fetchJson(DATA_BASE + part.path);
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
  state.currentParts = [];
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

      const [movieData, seriesData] = await Promise.all([
        fetchJson(DATA_BASE + movieIndex.parts[0].path),
        fetchJson(DATA_BASE + seriesIndex.parts[0].path)
      ]);

      const movies = normalizeItems(movieData).slice(0, 18);
      const series = normalizeItems(seriesData).slice(0, 18);

      grid.replaceChildren();

      const moviesTitle = document.createElement("div");
      moviesTitle.className = "catalog-heading";
      moviesTitle.textContent = "أحدث الأفلام";

      grid.appendChild(moviesTitle);
      movies.forEach(item => {
        grid.appendChild(createCard(item, "movies"));
      });

      const seriesTitle = document.createElement("div");
      seriesTitle.className = "catalog-heading";
      seriesTitle.textContent = "المسلسلات";

      grid.appendChild(seriesTitle);
      series.forEach(item => {
        grid.appendChild(createCard(item, "series"));
      });

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

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closePlayer();
    const details = document.getElementById("details-overlay");
    if (details) details.remove();
  }
});

openCatalog("home");
