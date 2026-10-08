/* HEAVYY TOP UP ID — global UI behaviour (progressive enhancement) */
(function () {
  'use strict';

  // ---------- Toast ----------
  window.toast = function (msg, tone) {
    var wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (tone || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'opacity .25s, transform .25s';
      setTimeout(function () { el.remove(); }, 260);
    }, 2800);
  };

  // ---------- Mobile menu ----------
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ---------- Search overlay ----------
  var overlay = document.getElementById('searchOverlay');
  var openBtn = document.getElementById('openSearch');
  var closeBtn = document.getElementById('closeSearch');
  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var searchTimer = null;

  function openSearch() {
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (input) setTimeout(function () { input.focus(); }, 40);
  }
  function closeSearch() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });

  if (input && results) {
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(searchTimer);
      if (q.length < 1) { results.innerHTML = ''; return; }
      searchTimer = setTimeout(function () {
        fetch('/api/search?q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.games || !data.games.length) {
              results.innerHTML = '<div class="search-empty">Tidak ada game yang cocok.</div>';
              return;
            }
            results.innerHTML = data.games.map(function (g) {
              return '<a href="/game/' + g.slug + '"><img src="' + g.logo + '" alt="" width="40" height="40" loading="lazy">' +
                '<span><span style="font-weight:600;font-size:14px">' + g.name + '</span>' +
                '<span class="meta" style="display:block">' + (g.publisher || '') + '</span></span></a>';
            }).join('');
          })
          .catch(function () { results.innerHTML = '<div class="search-empty">Pencarian gagal. Coba lagi.</div>'; });
      }, 180);
    });
  }

  // ---------- Copy buttons ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () { window.toast('Disalin ke clipboard', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { window.toast('Gagal menyalin', 'err'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { window.toast('Gagal menyalin', 'err'); }
      ta.remove();
    }
  });
})();
