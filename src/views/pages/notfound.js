// ============================================================
// 404
// ============================================================
export function notFoundPage() {
  const body = `
<div class="container">
  <div class="empty" style="padding:90px 20px">
    <div class="big">🕹️</div>
    <h2 class="silver-text" style="font-size:26px">Halaman Tidak Ditemukan</h2>
    <p class="mt-8">Halaman yang kamu cari tidak tersedia atau sudah dipindahkan.</p>
    <div class="hero-cta" style="justify-content:center">
      <a class="btn btn-primary" href="/">Kembali ke Home</a>
      <a class="btn btn-ghost" href="/game">Lihat Semua Game</a>
    </div>
  </div>
</div>`;
  return { title: '404 — Tidak Ditemukan', body };
}
