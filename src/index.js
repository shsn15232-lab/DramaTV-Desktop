
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:;">
  <title>DramaTV</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

  <div class="app">

    <header class="titlebar">
      <div class="brand">
        <span class="brand-icon">D</span>
        <span>Drama<span class="red">TV</span></span>
      </div>

      <div class="window-controls">
        <button onclick="window.dramaWindow.minimize()">−</button>
        <button onclick="window.dramaWindow.maximize()">□</button>
        <button class="close" onclick="window.dramaWindow.close()">×</button>
      </div>
    </header>

    <aside class="sidebar">
      <div class="sidebar-brand">DRAMATV</div>

      <nav>
        <button class="nav-item active" data-page="home">⌂ <span>الرئيسية</span></button>
        <button class="nav-item" data-page="movies">▣ <span>الأفلام</span></button>
        <button class="nav-item" data-page="series">▤ <span>المسلسلات</span></button>
        <button class="nav-item" data-page="channels">◉ <span>القنوات</span></button>
        <button class="nav-item" data-page="search">⌕ <span>البحث</span></button>
      </nav>

      <div class="sidebar-footer">عالمك للترفيه</div>
    </aside>

    <main class="content">

      <section class="welcome">
        <div class="welcome-text">
          <span class="eyebrow">WELCOME TO DRAMATV</span>
          <h1>عالمك للترفيه</h1>
          <p>كل ما تحب مشاهدته، في مكان واحد.</p>
          <button class="primary-button" data-page="movies">اكتشف الأفلام</button>
        </div>
        <div class="hero-logo">D<span>TV</span></div>
      </section>

      <section class="section">
        <h2 id="page-title">الرئيسية</h2>
        <p id="page-description">مرحباً بك في تجربة DramaTV Desktop.</p>

        <div class="empty-state">
          <div class="empty-icon">D</div>
          <h3>قريباً على DramaTV</h3>
          <p>نعمل على تجهيز مكتبتك الترفيهية.</p>
        </div>
      </section>

    </main>

  </div>

  <script src="renderer.js"></script>
</body>
</html>
