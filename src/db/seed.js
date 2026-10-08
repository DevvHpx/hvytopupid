// ============================================================
// Seed the catalog. Idempotent: safe to run repeatedly.
//   node src/db/seed.js          -> seed if empty
//   node src/db/seed.js --reset  -> wipe catalog tables & reseed
// ============================================================
import { db, migrate } from './index.js';

migrate();

if (process.argv.includes('--reset')) {
  db.exec(`
    DELETE FROM order_events; DELETE FROM orders;
    DELETE FROM products; DELETE FROM games; DELETE FROM categories;
    DELETE FROM payment_methods; DELETE FROM promos; DELETE FROM faqs;
  `);
}

const already = db.prepare('SELECT COUNT(*) AS n FROM games').get().n;
if (already > 0 && !process.argv.includes('--reset')) {
  console.log(`Catalog already seeded (${already} games). Use --reset to rebuild.`);
  process.exit(0);
}

// ---------- Categories ----------
const categories = [
  ['MOBA', 'moba', '⚔️', 1],
  ['Battle Royale', 'battle-royale', '🎯', 2],
  ['RPG & Open World', 'rpg', '🗺️', 3],
  ['Shooter / FPS', 'fps', '🔫', 4],
  ['Sandbox & Casual', 'sandbox', '🧩', 5],
  ['Voucher Digital', 'voucher', '🎟️', 6],
];
const insCat = db.prepare('INSERT INTO categories (name,slug,icon,sort_order) VALUES (?,?,?,?)');
const catId = {};
for (const c of categories) catId[c[1]] = insCat.run(...c).lastInsertRowid;

// ---------- Games ----------
// [name, slug, publisher, category, id_fields, instructions, validation, popular, sort]
const F = {
  uid: (label = 'User ID', hint = 'Buka menu Profil di dalam game untuk melihat User ID.') => ({
    key: 'user_id', label, type: 'number', required: true,
    placeholder: 'Contoh: 123456789', hint,
  }),
  zone: () => ({
    key: 'zone_id', label: 'Zone ID', type: 'number', required: true,
    placeholder: 'Contoh: 1234', hint: 'Zone ID tampil di samping User ID pada halaman profil.',
  }),
  server: (opts) => ({
    key: 'server', label: 'Server', type: 'select', required: true,
    options: opts, hint: 'Pilih server tempat karakter kamu bermain.',
  }),
  username: (label = 'Username', ph = 'Contoh: PlayerName123') => ({
    key: 'username', label, type: 'text', required: true, placeholder: ph,
    hint: 'Masukkan username akun kamu dengan benar.',
  }),
};

const games = [
  ['Mobile Legends: Bang Bang', 'mobile-legends', 'Moonton', 'moba',
    [F.uid('User ID'), F.zone()],
    'Masukkan User ID dan Zone ID akun Mobile Legends kamu. Pastikan keduanya benar sebelum melanjutkan.', 'unavailable', 1, 1],
  ['Free Fire', 'free-fire', 'Garena', 'battle-royale',
    [F.uid('Player ID')],
    'Masukkan Player ID Free Fire kamu. Player ID dapat dilihat di halaman profil in-game.', 'unavailable', 1, 2],
  ['PUBG Mobile', 'pubg-mobile', 'Level Infinite', 'battle-royale',
    [F.uid('Character ID')],
    'Masukkan Character ID PUBG Mobile kamu (bukan nama karakter).', 'unavailable', 1, 3],
  ['Honor of Kings', 'honor-of-kings', 'Level Infinite', 'moba',
    [F.uid('User ID')],
    'Masukkan User ID Honor of Kings kamu. Top up diproses otomatis ke akun.', 'unavailable', 1, 4],
  ['Genshin Impact', 'genshin-impact', 'HoYoverse', 'rpg',
    [F.uid('UID'), F.server(['Asia', 'America', 'Europe', 'TW/HK/MO'])],
    'Masukkan UID dan pilih server Genshin Impact kamu dengan tepat.', 'unavailable', 1, 5],
  ['Roblox', 'roblox', 'Roblox Corporation', 'sandbox',
    [F.username('Username Roblox')],
    'Masukkan username Roblox kamu. Robux akan dikirim langsung ke akun.', 'unavailable', 1, 6],
  ['VALORANT', 'valorant', 'Riot Games', 'fps',
    [{ key: 'riot_id', label: 'Riot ID', type: 'text', required: true, placeholder: 'Contoh: Player#TAG', hint: 'Gunakan format Nama#Tag dari akun Riot kamu.' }],
    'Masukkan Riot ID lengkap beserta tag (contoh: Nama#1234).', 'unavailable', 1, 7],
  ['Call of Duty: Mobile', 'cod-mobile', 'Activision', 'fps',
    [F.uid('Open ID')],
    'Masukkan Open ID Call of Duty Mobile kamu.', 'unavailable', 0, 8],
  ['Arena of Valor', 'arena-of-valor', 'Garena', 'moba',
    [F.uid('User ID')],
    'Masukkan User ID Arena of Valor kamu.', 'unavailable', 0, 9],
  ['League of Legends: Wild Rift', 'wild-rift', 'Riot Games', 'moba',
    [{ key: 'riot_id', label: 'Riot ID', type: 'text', required: true, placeholder: 'Contoh: Player#TAG', hint: 'Format Nama#Tag.' }],
    'Masukkan Riot ID Wild Rift kamu.', 'unavailable', 0, 10],
  ['Clash of Clans', 'clash-of-clans', 'Supercell', 'sandbox',
    [{ key: 'player_tag', label: 'Player Tag', type: 'text', required: true, placeholder: 'Contoh: #ABC123XY', hint: 'Player Tag diawali tanda # (contoh #ABC123XY).' }],
    'Masukkan Player Tag Clash of Clans kamu, sertakan tanda #.', 'unavailable', 0, 11],
  ['Point Blank', 'point-blank', 'Zepetto', 'fps',
    [F.uid('User ID')],
    'Masukkan User ID Point Blank kamu.', 'unavailable', 0, 12],
  ['Growtopia', 'growtopia', 'Ubisoft', 'sandbox',
    [{ key: 'growid', label: 'GrowID', type: 'text', required: true, placeholder: 'Contoh: GrowName', hint: 'Masukkan GrowID (bukan nama world).' }],
    'Masukkan GrowID akun Growtopia kamu.', 'unavailable', 0, 13],
  ['Higgs Domino', 'higgs-domino', 'Higgs Games', 'sandbox',
    [F.uid('User ID')],
    'Masukkan User ID Higgs Domino kamu.', 'unavailable', 0, 14],
  ['Steam Wallet', 'steam-wallet', 'Valve', 'voucher',
    [{ key: 'account', label: 'Steam ID / Email', type: 'text', required: true, placeholder: 'Contoh: namakamu@email.com', hint: 'Kode voucher akan dikirim ke kontak yang kamu isi.' }],
    'Isi Steam ID atau email penerima. Kode voucher dikirim setelah pembayaran berhasil.', 'unavailable', 0, 15],
  ['Google Play', 'google-play', 'Google', 'voucher',
    [{ key: 'account', label: 'Email Google Play', type: 'text', required: true, placeholder: 'Contoh: namakamu@email.com', hint: 'Kode voucher akan dikirim ke email ini.' }],
    'Isi email akun Google Play penerima voucher.', 'unavailable', 0, 16],
];

const insGame = db.prepare(`INSERT INTO games
  (name,slug,publisher,category_id,logo,banner,id_fields,instructions,validation,popular,sort_order)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

const gameId = {};
for (const g of games) {
  const [name, slug, publisher, cat, fields, instr, val, pop, sort] = g;
  const r = insGame.run(
    name, slug, publisher, catId[cat],
    `/img/games/${slug}.svg`, `/img/banners/${slug}.svg`,
    JSON.stringify(fields), instr, val, pop, sort
  );
  gameId[slug] = r.lastInsertRowid;
}

// ---------- Products ----------
// price in IDR. cost = supplier cost (for margin reporting).
const P = (slug, rows) => rows.map((r) => [slug, ...r]);
const products = [
  ...P('mobile-legends', [
    ['5 Diamonds', '5 💎', 1500, 'Populer'],
    ['12 Diamonds', '12 💎', 3500, ''],
    ['19 Diamonds', '19 💎', 5500, ''],
    ['36 Diamonds', '36 💎', 10000, 'Populer'],
    ['74 Diamonds', '74 💎', 20000, ''],
    ['172 Diamonds', '172 💎', 45000, 'Best Value'],
    ['355 Diamonds', '355 💎', 90000, ''],
    ['720 Diamonds', '720 💎', 180000, ''],
    ['Twilight Pass', 'Bundle', 149000, ''],
  ]),
  ...P('free-fire', [
    ['5 Diamonds', '5 💎', 1000, ''],
    ['12 Diamonds', '12 💎', 2000, ''],
    ['50 Diamonds', '50 💎', 7500, 'Populer'],
    ['70 Diamonds', '70 💎', 10000, ''],
    ['140 Diamonds', '140 💎', 20000, ''],
    ['355 Diamonds', '355 💎', 50000, 'Best Value'],
    ['720 Diamonds', '720 💎', 100000, ''],
    ['Weekly Membership', 'Bundle', 28000, ''],
  ]),
  ...P('pubg-mobile', [
    ['60 UC', '60 UC', 15000, ''],
    ['325 UC', '325 UC', 75000, 'Populer'],
    ['660 UC', '660 UC', 150000, ''],
    ['1800 UC', '1800 UC', 400000, 'Best Value'],
    ['3850 UC', '3850 UC', 800000, ''],
    ['Royal Pass', 'Bundle', 149000, ''],
  ]),
  ...P('honor-of-kings', [
    ['16 Tokens', '16', 5000, ''],
    ['80 Tokens', '80', 25000, 'Populer'],
    ['240 Tokens', '240', 70000, ''],
    ['400 Tokens', '400', 115000, ''],
    ['800 Tokens', '800', 225000, 'Best Value'],
  ]),
  ...P('genshin-impact', [
    ['60 Genesis Crystals', '60', 16000, ''],
    ['300 + 30 Crystals', '330', 79000, 'Populer'],
    ['980 + 110 Crystals', '1090', 249000, ''],
    ['1980 + 260 Crystals', '2240', 479000, 'Best Value'],
    ['Blessing of the Welkin Moon', 'Bundle', 79000, ''],
  ]),
  ...P('roblox', [
    ['80 Robux', '80 R$', 15000, ''],
    ['400 Robux', '400 R$', 68000, 'Populer'],
    ['800 Robux', '800 R$', 135000, ''],
    ['1700 Robux', '1700 R$', 270000, 'Best Value'],
    ['4500 Robux', '4500 R$', 690000, ''],
  ]),
  ...P('valorant', [
    ['125 VP', '125', 15000, ''],
    ['420 VP', '420', 50000, 'Populer'],
    ['700 VP', '700', 80000, ''],
    ['1375 VP', '1375', 150000, ''],
    ['2400 VP', '2400', 260000, 'Best Value'],
  ]),
  ...P('cod-mobile', [
    ['80 CP', '80 CP', 15000, ''],
    ['420 CP', '420 CP', 75000, 'Populer'],
    ['880 CP', '880 CP', 150000, ''],
    ['2400 CP', '2400 CP', 400000, 'Best Value'],
  ]),
  ...P('arena-of-valor', [
    ['50 Vouchers', '50', 10000, ''],
    ['150 Vouchers', '150', 28000, 'Populer'],
    ['350 Vouchers', '350', 65000, ''],
    ['700 Vouchers', '700', 128000, 'Best Value'],
  ]),
  ...P('wild-rift', [
    ['125 Wild Cores', '125', 15000, ''],
    ['420 Wild Cores', '420', 50000, 'Populer'],
    ['1375 Wild Cores', '1375', 150000, ''],
    ['2400 Wild Cores', '2400', 260000, 'Best Value'],
  ]),
  ...P('clash-of-clans', [
    ['80 Gems', '80', 15000, ''],
    ['500 Gems', '500', 75000, 'Populer'],
    ['1200 Gems', '1200', 170000, ''],
    ['2500 Gems', '2500', 340000, 'Best Value'],
    ['Gold Pass', 'Bundle', 79000, ''],
  ]),
  ...P('point-blank', [
    ['1.200 PB Cash', '1200', 15000, ''],
    ['6.000 PB Cash', '6000', 70000, 'Populer'],
    ['12.000 PB Cash', '12000', 135000, ''],
    ['24.000 PB Cash', '24000', 260000, 'Best Value'],
  ]),
  ...P('growtopia', [
    ['100 Gems', '100', 12000, ''],
    ['500 Gems', '500', 55000, 'Populer'],
    ['1.000 Gems', '1000', 105000, ''],
    ['2.500 Gems', '2500', 250000, 'Best Value'],
  ]),
  ...P('higgs-domino', [
    ['100M Koin', '100M', 15000, ''],
    ['500M Koin', '500M', 70000, 'Populer'],
    ['1B Koin', '1B', 135000, ''],
    ['2B Koin', '2B', 260000, 'Best Value'],
  ]),
  ...P('steam-wallet', [
    ['Steam Wallet Rp 12.000', '12K', 15000, ''],
    ['Steam Wallet Rp 45.000', '45K', 50000, 'Populer'],
    ['Steam Wallet Rp 90.000', '90K', 97000, ''],
    ['Steam Wallet Rp 250.000', '250K', 260000, 'Best Value'],
    ['Steam Wallet Rp 500.000', '500K', 515000, ''],
  ]),
  ...P('google-play', [
    ['Google Play Rp 20.000', '20K', 23000, ''],
    ['Google Play Rp 50.000', '50K', 54000, 'Populer'],
    ['Google Play Rp 100.000', '100K', 105000, ''],
    ['Google Play Rp 300.000', '300K', 310000, 'Best Value'],
  ]),
];

const insProd = db.prepare(`INSERT INTO products
  (game_id,name,denomination,price,cost,supplier,supplier_sku,badge,status,sort_order)
  VALUES (?,?,?,?,?,?,?,?, 'active', ?)`);
let pcount = 0;
for (const [slug, name, denom, price, badge] of products) {
  const gid = gameId[slug];
  if (!gid) continue;
  const cost = Math.round((price * 0.88) / 100) * 100;
  insProd.run(gid, name, denom, price, cost, 'manual', `${slug}:${denom}`, badge, pcount++);
}

// ---------- Payment methods ----------
// [name, code, type, fee_percent, fee_fixed, config_status, sort]
const payments = [
  ['QRIS (Semua Bank & E-Wallet)', 'qris', 'qris', 0.7, 0, 'not_configured', 1],
  ['GoPay', 'gopay', 'ewallet', 2, 0, 'not_configured', 2],
  ['OVO', 'ovo', 'ewallet', 2, 0, 'not_configured', 3],
  ['DANA', 'dana', 'ewallet', 2, 0, 'not_configured', 4],
  ['ShopeePay', 'shopeepay', 'ewallet', 2, 0, 'not_configured', 5],
  ['LinkAja', 'linkaja', 'ewallet', 2, 0, 'not_configured', 6],
  ['BCA Virtual Account', 'bca-va', 'bank', 0, 4000, 'not_configured', 7],
  ['BNI Virtual Account', 'bni-va', 'bank', 0, 4000, 'not_configured', 8],
  ['BRI Virtual Account', 'bri-va', 'bank', 0, 4000, 'not_configured', 9],
  ['Mandiri Virtual Account', 'mandiri-va', 'bank', 0, 4000, 'not_configured', 10],
  ['Alfamart', 'alfamart', 'retail', 0, 5000, 'not_configured', 11],
  ['Indomaret', 'indomaret', 'retail', 0, 5000, 'not_configured', 12],
  ['Sandbox (Mode Uji)', 'sandbox', 'sandbox', 0, 0, 'configured', 99],
];
const insPay = db.prepare(`INSERT INTO payment_methods
  (name,code,type,fee_percent,fee_fixed,config_status,sort_order) VALUES (?,?,?,?,?,?,?)`);
for (const p of payments) insPay.run(...p);

// ---------- Promos ----------
const promos = [
  ['Diskon s/d 12% Semua Diamond', 'Berlaku untuk semua game MOBA & Battle Royale.', 'Potongan otomatis diterapkan pada produk bertanda promo. Tanpa kode.', '', 'DISKON', '/img/banners/mobile-legends.svg', '/game', 1],
  ['Cashback E-Wallet 20%', 'Bayar pakai GoPay / OVO / DANA, dapat cashback hingga Rp 10.000.', 'Cashback masuk ke saldo e-wallet maksimal 1x24 jam setelah transaksi sukses.', 'CASHBACK20', 'CASHBACK', '/img/banners/free-fire.svg', '/game', 2],
  ['Bonus Robux Spesial', 'Beli 800 Robux, dapat bonus 100 Robux.', 'Bonus otomatis ditambahkan ke akun Roblox kamu.', '', 'BONUS', '/img/banners/roblox.svg', '/game/roblox', 3],
  ['Top Up Pertama Bebas Admin', 'Pengguna baru tidak dikenakan biaya admin pada transaksi pertama.', 'Otomatis untuk transaksi pertama per akun.', 'NEWBIE', 'NEW', '/img/banners/genshin-impact.svg', '/game', 4],
];
const insPromo = db.prepare(`INSERT INTO promos
  (title,subtitle,description,code,badge,image,link,sort_order) VALUES (?,?,?,?,?,?,?,?)`);
for (const p of promos) insPromo.run(...p);

// ---------- FAQ ----------
const faqs = [
  ['Bagaimana cara top up di HEAVYY TOP UP ID?', 'Pilih game, masukkan User ID (dan Zone/Server bila diperlukan), pilih nominal, lalu pilih metode pembayaran dan selesaikan pembayaran. Pesanan diproses otomatis setelah pembayaran terkonfirmasi.'],
  ['Berapa lama pesanan diproses?', 'Sebagian besar pesanan diproses dalam hitungan detik hingga 5 menit setelah pembayaran berhasil. Jika terjadi antrean dari pihak penyedia, proses dapat memakan waktu hingga 30 menit.'],
  ['Apakah transaksi di sini aman?', 'Ya. Kami hanya meminta data yang diperlukan (User ID / Zone ID). Kami tidak pernah meminta password, OTP, atau data login akun game kamu.'],
  ['Metode pembayaran apa saja yang tersedia?', 'Tersedia QRIS, e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja), Virtual Account bank, serta gerai retail (Alfamart, Indomaret). Metode yang belum aktif akan ditandai "Belum dikonfigurasi".'],
  ['Bagaimana jika saya salah memasukkan User ID?', 'Segera hubungi Bantuan sebelum pesanan diproses. Jika pesanan sudah terkirim ke User ID yang salah, dana tidak dapat dikembalikan karena bersifat instan.'],
  ['Bagaimana cara mengecek status pesanan?', 'Buka menu "Cek Pesanan", masukkan Order ID (dan email/WhatsApp bila kamu mengisinya saat checkout). Status akan ditampilkan secara langsung.'],
  ['Apakah ada biaya admin?', 'Biaya admin berbeda-beda tergantung metode pembayaran dan ditampilkan secara transparan pada halaman checkout sebelum kamu membayar.'],
  ['Apakah saya bisa top up untuk akun orang lain?', 'Bisa. Cukup masukkan User ID akun tujuan dengan benar. Pastikan kamu sudah konfirmasi ke pemilik akun.'],
];
const insFaq = db.prepare('INSERT INTO faqs (question,answer,sort_order) VALUES (?,?,?)');
faqs.forEach((f, i) => insFaq.run(f[0], f[1], i));

// ---------- Settings ----------
const settings = [
  ['supplier_api_status', 'not_configured'],
  ['payment_gateway_status', 'not_configured'],
  ['id_validation_status', 'not_configured'],
  ['sandbox_enabled', 'true'],
  ['brand_name', 'HEAVYY TOP UP ID'],
  ['support_whatsapp', ''],
  ['support_email', ''],
];
const insSet = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
for (const s of settings) insSet.run(...s);

console.log(`Seeded: ${games.length} games, ${products.length} products, ${payments.length} payment methods, ${promos.length} promos, ${faqs.length} faqs.`);
