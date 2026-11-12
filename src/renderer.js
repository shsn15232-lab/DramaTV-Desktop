
const DATA_BASE =
  "https://raw.githubusercontent.com/shsn15232-lab/DramaTV-Data/main/";

const DB_NAME = "DramaTV_Catalog";
const DB_STORE = "repository_cache";

const state = {
  page: "home",
  indexes: {},
  items: [],
  homeMovies: [],
  homeSeries: [],
  loadedParts: 0,
  currentParts: [],
  visibleCount: 36,
  loading: false,
  search: "",
  playerUrl: null,
  requestId: 0
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

function setActivePage(type) {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === type
    );
  });
}

function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

/* DATABASE */

let databasePromise = null;

function openCatalogDB() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB غير مدعوم"));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("Catalog database upgrade blocked");
    };
  });

  return databasePromise;
}

async function readCatalogCache(url) {
  try {
    const db = await openCatalogDB();

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(url);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Cache read:", error);
    return null;
  }
}

async function saveCatalogCache(url, data) {
  try {
    const db = await openCatalogDB();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readwrite");

      transaction.objectStore(DB_STORE).put(data, url);

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("Cache save:", error);
  }
}

/* FETCH */

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      cache: "no-cache",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    await saveCatalogCache(url, data);

    return data;
  } catch (networkError) {
    console.warn("Network unavailable:", url, networkError);

    const cached = await readCatalogCache(url);

    if (cached !== null) {
      return cached;
    }

    throw networkError;
  }
}

/* INDEXES */

async function getIndex(type) {
  if (state.indexes[type]) {
    return state.indexes[type];
  }

  const file = type === "movies"
    ? "movies_index.json"
    : "series_index.json";

  const index = await fetchJson(DATA_BASE + file);

  if (!index || !Array.isArray(index.parts)) {
    throw new Error("فهرس المكتبة غير صالح");
  }

  if (index.parts.some(part => {
    return !part || typeof part.path !== "string" || !part.path;
  })) {
    throw new Error("مسارات أجزاء المكتبة غير صالحة");
  }

  state.indexes[type] = index;

  return index;
}

/* DATA HELPERS */

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.movies)) return data.movies;
  if (Array.isArray(data?.series)) return data.series;
  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function getName(item) {
  return String(
    item?.name ||
    item?.title ||
    item?.series_name ||
    "بدون عنوان"
  );
}

function getCover(item) {
  return String(
    item?.cover ||
    item?.poster ||
    item?.image ||
    item?.thumbnail ||
    ""
  );
}

function getDescription(item) {
  return String(
    item?.plot ||
    item?.description ||
    item?.overview ||
    ""
  );
}

function getItemKey(item, type) {
  const id = type === "movies"
    ? item.vod_id
    : item.series_id;

  return id != null
    ? type + ":" + id
    : type + ":" + getName(item) + ":" + getCover(item);
}

function uniqueItems(items, type) {
  const seen = new Set();

  return items.filter(item => {
    if (!item || typeof item !== "object") return false;

    const key = getItemKey(item, type);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function makeButton(text, className, action) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = text;
  button.className = className;
  button.addEventListener("click", action);

  return button;
}

/* CATALOG CARDS */

function createCard(item, type) {
  const card = document.createElement("article");
  card.className = "catalog-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", getName(item));

  const imageBox = document.createElement("div");
  imageBox.className = "catalog-poster";

  const cover = getCover(item);

  if (cover) {
    const image = document.createElement("img");

    image.src = cover;
    image.alt = getName(item);
    image.loading = "lazy";
    image.decoding = "async";
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

  const openDetails = () => showDetails(item, type);

  card.addEventListener("click", openDetails);

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  });

  return card;
}

/* OVERLAYS */

function createOverlay(id, panelClass) {
  const old = document.getElementById(id);

  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.className = id === "player-overlay"
    ? "player-overlay"
    : "details-overlay";

  const panel = document.createElement("div");
  panel.className = panelClass;

  overlay.appendChild(panel);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      if (id === "player-overlay") {
        closePlayer();
      } else {
        overlay.remove();
      }
    }
  });

  document.body.appendChild(overlay);

  return { overlay, panel };
}

function addDetailText(parent, text, className = "") {
  const element = document.createElement("p");

  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);

  return element;
}

/* DETAILS */

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
      makeButton(
        "اختيار ملف الفيلم وتشغيله",
        "primary-button",
        () => {
          overlay.remove();
          chooseLocalVideo(getName(item));
        }
      )
    );
  } else {
    renderSeasons(panel, item);
  }

  panel.appendChild(
    makeButton("إغلاق", "secondary-button", () => {
      overlay.remove();
    })
  );
}

/* SERIES SEASONS */

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

      const episodeInfo = document.createElement("div");

      const episodeName = document.createElement("strong");
      episodeName.textContent =
        episode.title ||
        ("الحلقة " + (episode.episode_num || index + 1));

      const episodeNumber = document.createElement("small");
      episodeNumber.textContent =
        "الحلقة " + (episode.episode_num || index + 1);

      episodeInfo.append(episodeName, episodeNumber);

      const playButton = makeButton(
        "اختيار ملف الحلقة",
        "primary-button",
        () => {
          chooseLocalVideo(
            getName(item) + " - " + episodeName.textContent
          );
        }
      );

      row.append(episodeInfo, playButton);
      list.appendChild(row);
    });

    if (!seasonEpisodes.length) {
      addDetailText(list, "لا توجد حلقات في هذا الموسم.");
    }

    seasonBox.appendChild(list);
    panel.appendChild(seasonBox);
  });
}

/* LOCAL VIDEO PLAYER */

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

  const { panel } =
    createOverlay("player-overlay", "player-panel");

  const top = document.createElement("div");
  top.className = "player-top";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const close = makeButton("×", "", () => {
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

/* SEARCH AND RENDER */

function getFilteredItems() {
  const query = normalizeText(state.search);

  if (!query) return state.items;

  return state.items.filter(item => {
    const name = normalizeText(getName(item));
    const genre = normalizeText(item.genre || "");
    const plot = normalizeText(getDescription(item));

    return (
      name.includes(query) ||
      genre.includes(query) ||
      plot.includes(query)
    );
  });
}

function renderItems() {
  grid.replaceChildren();

  const filtered = getFilteredItems();
  const visible = filtered.slice(0, state.visibleCount);

  visible.forEach(item => {
    grid.appendChild(createCard(item, state.page));
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");

    empty.className = "empty-message";
    empty.textContent = state.search.trim()
      ? "ما لقينا نتائج مطابقة ضمن البيانات المحمّلة."
      : "لا توجد عناصر للعرض حالياً.";

    grid.appendChild(empty);
  }

  loadMoreButton.hidden =
    state.search.trim().length > 0 ||
    state.loadedParts >= state.currentParts.length;

  setStatus(
    state.search.trim()
      ? "نتائج البحث ضمن البيانات المحمّلة: " +
        filtered.length.toLocaleString("ar")
      : "تم تحميل " +
        state.items.length.toLocaleString("ar") +
        " عنصر"
  );
}

/* LOAD LIBRARY PARTS */

async function loadNextPart() {
  if (state.loading) return;

  if (state.loadedParts >= state.currentParts.length) {
    loadMoreButton.hidden = true;
    setStatus("وصلت إلى نهاية المكتبة.");
    return;
  }

  state.loading = true;

  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "جارٍ التحميل...";

  const requestId = state.requestId;

  try {
    const part = state.currentParts[state.loadedParts];

    const data = await fetchJson(DATA_BASE + part.path);
    const items = normalizeItems(data);

    if (requestId !== state.requestId) return;

    const type = state.page;

    const combined = state.items.concat(items);

    state.items = uniqueItems(combined, type);
    state.loadedParts++;

    renderItems();

  } catch (error) {
    console.error("Part loading:", error);

    if (requestId === state.requestId) {
      setStatus(
        "تعذر تحميل هذا الجزء. تحقق من الإنترنت وحاول مجدداً."
      );
    }

  } finally {
    state.loading = false;

    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "تحميل المزيد";

    if (state.page === "home") {
      loadMoreButton.hidden = true;
    }
  }
}

/* HOME */

async function openHome() {
  state.requestId++;

  const requestId = state.requestId;

  state.page = "home";
  state.items = [];
  state.homeMovies = [];
  state.homeSeries = [];
  state.loadedParts = 0;
  state.currentParts = [];
  state.visibleCount = 36;
  state.search = "";
  state.loading = false;

  searchInput.value = "";

  grid.replaceChildren();

  welcome.hidden = false;
  loadMoreButton.hidden = true;

  setActivePage("home");

  titleBox.textContent = pages.home[0];
  descriptionBox.textContent = pages.home[1];

  setStatus("جارٍ تحميل مكتبة DramaTV...");

  try {
    const [movieIndex, seriesIndex] = await Promise.all([
      getIndex("movies"),
      getIndex("series")
    ]);

    const moviePart = movieIndex.parts[0];
    const seriesPart = seriesIndex.parts[0];

    if (!moviePart || !seriesPart) {
      throw new Error("أجزاء المكتبة غير متوفرة");
    }

    const [movieData, seriesData] = await Promise.all([
      fetchJson(DATA_BASE + moviePart.path),
      fetchJson(DATA_BASE + seriesPart.path)
    ]);

    if (requestId !== state.requestId) return;

    state.homeMovies = uniqueItems(
      normalizeItems(movieData),
      "movies"
    ).slice(0, 18);

    state.homeSeries = uniqueItems(
      normalizeItems(seriesData),
      "series"
    ).slice(0, 18);

    state.items = state.homeMovies.concat(state.homeSeries);

    const moviesTitle = document.createElement("div");
    moviesTitle.className = "catalog-heading";
    moviesTitle.textContent = "أحدث الأفلام";

    grid.appendChild(moviesTitle);

    state.homeMovies.forEach(item => {
      grid.appendChild(createCard(item, "movies"));
    });

    const seriesTitle = document.createElement("div");
    seriesTitle.className = "catalog-heading";
    seriesTitle.textContent = "المسلسلات";

    grid.appendChild(seriesTitle);

    state.homeSeries.forEach(item => {
      grid.appendChild(createCard(item, "series"));
    });

    setStatus(
      "المكتبة جاهزة — " +
      Number(movieIndex.total_movies || 0).toLocaleString("ar") +
      " فيلم و" +
      Number(seriesIndex.total_series || 0).toLocaleString("ar") +
      " مسلسل"
    );

  } catch (error) {
    console.error("Home loading:", error);

    if (requestId === state.requestId) {
      setStatus(
        "تعذر تحميل المكتبة. تحقق من اتصال الإنترنت أو توفر البيانات المحفوظة."
      );
    }
  }
}

/* OPEN MOVIES AND SERIES */

async function openCatalog(type) {
  if (!pages[type]) return;

  if (type === "home") {
    await openHome();
    return;
  }

  state.requestId++;

  state.page = type;
  state.items = [];
  state.loadedParts = 0;
  state.currentParts = [];
  state.visibleCount = 36;
  state.search = "";
  state.loading = false;

  const requestId = state.requestId;

  searchInput.value = "";
  grid.replaceChildren();

  welcome.hidden = true;

  setActivePage(type);

  titleBox.textContent = pages[type][0];
  descriptionBox.textContent = pages[type][1];

  setStatus("جارٍ الاتصال بمكتبة DramaTV...");
  loadMoreButton.hidden = true;

  try {
    const index = await getIndex(type);

    if (requestId !== state.requestId) return;

    state.currentParts = index.parts;

    if (!state.currentParts.length) {
      setStatus("لا توجد بيانات متاحة في هذه المكتبة.");
      return;
    }

    await loadNextPart();

  } catch (error) {
    console.error("Catalog loading:", error);

    if (requestId === state.requestId) {
      setStatus(
        "تعذر الاتصال بمكتبة البيانات. حاول مرة أخرى."
      );
    }
  }
}

/* NAVIGATION */

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    if (pages[page]) {
      openCatalog(page);
    }
  });
});

/* WINDOW CONTROLS */

document.querySelectorAll("[data-window-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.windowAction;

    if (!window.dramaWindow) {
      console.error("Window controls are unavailable");
      return;
    }

    if (action === "minimize") {
      window.dramaWindow.minimize();
    }

    if (action === "maximize") {
      window.dramaWindow.maximize();
    }

    if (action === "close") {
      window.dramaWindow.close();
    }
  });
});

/* SEARCH */

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  state.visibleCount = 100;

  if (state.page === "home") {
    const query = normalizeText(state.search);

    grid.replaceChildren();

    const movies = state.homeMovies.filter(item => {
      return (
        normalizeText(getName(item)).includes(query) ||
        normalizeText(item.genre || "").includes(query)
      );
    });

    const series = state.homeSeries.filter(item => {
      return (
        normalizeText(getName(item)).includes(query) ||
        normalizeText(item.genre || "").includes(query)
      );
    });

    if (!movies.length && !series.length) {
      const empty = document.createElement("div");
      empty.className = "empty-message";
      empty.textContent = query
        ? "ما لقينا نتائج مطابقة ضمن العناصر المعروضة."
        : "لا توجد عناصر للعرض حالياً.";

      grid.appendChild(empty);
      return;
    }

    if (movies.length) {
      const heading = document.createElement("div");
      heading.className = "catalog-heading";
      heading.textContent = "الأفلام";
      grid.appendChild(heading);

      movies.forEach(item => {
        grid.appendChild(createCard(item, "movies"));
      });
    }

    if (series.length) {
      const heading = document.createElement("div");
      heading.className = "catalog-heading";
      heading.textContent = "المسلسلات";
      grid.appendChild(heading);

      series.forEach(item => {
        grid.appendChild(createCard(item, "series"));
      });
    }

    return;
  }

  renderItems();
});

/* LOAD MORE */

loadMoreButton.addEventListener("click", async () => {
  if (state.loading) return;

  if (state.visibleCount < state.items.length) {
    state.visibleCount += 36;
    renderItems();
    return;
  }

  await loadNextPart();
});

/* KEYBOARD */

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closePlayer();

    const details =
      document.getElementById("details-overlay");

    if (details) {
      details.remove();
    }
  }
});

/* START */

openCatalog("home");
