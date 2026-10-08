// ============================================================
// Prisma seed — mirrors the HEAVYY TOP UP ID catalogue.
// Idempotent: upserts by unique slug/code so it can be re-run.
//   npm run seed
// ============================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------- helpers for id-field schemas ----------
const F = {
  uid: (label = 'User ID', hint = 'Buka menu Profil di dalam game untuk melihat User ID.') => ({
    key: 'user_id', label, type: 'number', required: true, placeholder: 'Contoh: 123456789', hint,
  }),
  zone: () => ({
    key: 'zone_id', label: 'Zone ID', type: 'number', required: true, placeholder: 'Contoh: 1234',
    hint: 'Zone ID tampil di samping User ID pada halaman profil.',
  }),
  server: (options: string[]) => ({
    key: 'server', label: 'Server', type: 'select', required: true, options,
    hint: 'Pilih server tempat karakter kamu bermain.',
  }),
  username: (label = 'Username', ph = 'Contoh: PlayerName123') => ({
    key: 'username', label, type: 'text', required: true, placeholder: ph,
    hint: 'Masukkan username akun kamu dengan benar.',
  }),
};

const categories = [
  { name: 'MOBA', slug: 'moba', emoji: '⚔️', sort: 1 },
  { name: 'Battle Royale', slug: 'battle-royale', emoji: '🎯', sort: 2 },
  { name: 'RPG & Open World', slug: 'rpg', emoji: '🗺️', sort: 3 },
  { name: 'Shooter / FPS', slug: 'fps', emoji: '🔫', sort: 4 },
  { name: 'Sandbox & Casual', slug: 'sandbox', emoji: '🧩', sort: 5 },
  { name: 'Voucher Digital', slug: 'voucher', emoji: '🎟️', sort: 6 },
];

interface GameSeed {
  name: string; slug: string; publisher: string; category: string;
  idFields: unknown[]; instructions: string; popular: boolean; sort: number;
}
const games: GameSeed[] = [
  { name: 'Mobile Legends: Bang Bang', slug: 'mobile-legends', publisher: 'Moonton', category: 'moba',
    idFields: [F.uid('User ID'), F.zone()], instructions: 'Masukkan User ID dan Zone ID akun Mobile Legends kamu.', popular: true, sort: 1 },
  { name: 'Free Fire', slug: 'free-fire', publisher: 'Garena', category: 'battle-royale',
    idFields: [F.uid('Player ID')], instructions: 'Masukkan Player ID Free Fire kamu.', popular: true, sort: 2 },
  { name: 'PUBG Mobile', slug: 'pubg-mobile', publisher: 'Level Infinite', category: 'battle-royale',
    idFields: [F.uid('Character ID')], instructions: 'Masukkan Character ID PUBG Mobile kamu.', popular: true, sort: 3 },
  { name: 'Honor of Kings', slug: 'honor-of-kings', publisher: 'Level Infinite', category: 'moba',
    idFields: [F.uid('User ID')], instructions: 'Masukkan User ID Honor of Kings kamu.', popular: true, sort: 4 },
  { name: 'Genshin Impact', slug: 'genshin-impact', publisher: 'HoYoverse', category: 'rpg',
    idFields: [F.uid('UID'), F.server(['Asia', 'America', 'Europe', 'TW/HK/MO'])], instructions: 'Masukkan UID dan pilih server Genshin Impact kamu.', popular: true, sort: 5 },
  { name: 'Roblox', slug: 'roblox', publisher: 'Roblox Corporation', category: 'sandbox',
    idFields: [F.username('Username Roblox')], instructions: 'Masukkan username Roblox kamu.', popular: true, sort: 6 },
  { name: 'VALORANT', slug: 'valorant', publisher: 'Riot Games', category: 'fps',
    idFields: [{ key: 'riot_id', label: 'Riot ID', type: 'text', required: true, placeholder: 'Contoh: Player#TAG', hint: 'Gunakan format Nama#Tag.' }],
    instructions: 'Masukkan Riot ID lengkap beserta tag.', popular: true, sort: 7 },
  { name: 'Call of Duty: Mobile', slug: 'cod-mobile', publisher: 'Activision', category: 'fps',
    idFields: [F.uid('Open ID')], instructions: 'Masukkan Open ID Call of Duty Mobile kamu.', popular: false, sort: 8 },
  { name: 'Arena of Valor', slug: 'arena-of-valor', publisher: 'Garena', category: 'moba',
    idFields: [F.uid('User ID')], instructions: 'Masukkan User ID Arena of Valor kamu.', popular: false, sort: 9 },
  { name: 'League of Legends: Wild Rift', slug: 'wild-rift', publisher: 'Riot Games', category: 'moba',
    idFields: [{ key: 'riot_id', label: 'Riot ID', type: 'text', required: true, placeholder: 'Contoh: Player#TAG', hint: 'Format Nama#Tag.' }],
    instructions: 'Masukkan Riot ID Wild Rift kamu.', popular: false, sort: 10 },
  { name: 'Clash of Clans', slug: 'clash-of-clans', publisher: 'Supercell', category: 'sandbox',
    idFields: [{ key: 'player_tag', label: 'Player Tag', type: 'text', required: true, placeholder: 'Contoh: #ABC123XY', hint: 'Player Tag diawali tanda #.' }],
    instructions: 'Masukkan Player Tag Clash of Clans kamu.', popular: false, sort: 11 },
  { name: 'Point Blank', slug: 'point-blank', publisher: 'Zepetto', category: 'fps',
    idFields: [F.uid('User ID')], instructions: 'Masukkan User ID Point Blank kamu.', popular: false, sort: 12 },
  { name: 'Growtopia', slug: 'growtopia', publisher: 'Ubisoft', category: 'sandbox',
    idFields: [{ key: 'growid', label: 'GrowID', type: 'text', required: true, placeholder: 'Contoh: GrowName', hint: 'Masukkan GrowID (bukan nama world).' }],
    instructions: 'Masukkan GrowID akun Growtopia kamu.', popular: false, sort: 13 },
  { name: 'Higgs Domino', slug: 'higgs-domino', publisher: 'Higgs Games', category: 'sandbox',
    idFields: [F.uid('User ID')], instructions: 'Masukkan User ID Higgs Domino kamu.', popular: false, sort: 14 },
  { name: 'Steam Wallet', slug: 'steam-wallet', publisher: 'Valve', category: 'voucher',
    idFields: [{ key: 'account', label: 'Steam ID / Email', type: 'text', required: true, placeholder: 'Contoh: namakamu@email.com', hint: 'Kode voucher dikirim ke kontak yang kamu isi.' }],
    instructions: 'Isi Steam ID atau email penerima.', popular: false, sort: 15 },
  { name: 'Google Play', slug: 'google-play', publisher: 'Google', category: 'voucher',
    idFields: [{ key: 'account', label: 'Email Google Play', type: 'text', required: true, placeholder: 'Contoh: namakamu@email.com', hint: 'Kode voucher dikirim ke email ini.' }],
    instructions: 'Isi email akun Google Play penerima voucher.', popular: false, sort: 16 },
];

// [name, denom, price, badge]
const productsByGame: Record<string, [string, string, number, string][]> = {
  'mobile-legends': [['5 Diamonds', '5 💎', 1500, 'Populer'], ['12 Diamonds', '12 💎', 3500, ''], ['19 Diamonds', '19 💎', 5500, ''], ['36 Diamonds', '36 💎', 10000, 'Populer'], ['74 Diamonds', '74 💎', 20000, ''], ['172 Diamonds', '172 💎', 45000, 'Best Value'], ['355 Diamonds', '355 💎', 90000, ''], ['720 Diamonds', '720 💎', 180000, ''], ['Twilight Pass', 'Bundle', 149000, '']],
  'free-fire': [['5 Diamonds', '5 💎', 1000, ''], ['12 Diamonds', '12 💎', 2000, ''], ['50 Diamonds', '50 💎', 7500, 'Populer'], ['70 Diamonds', '70 💎', 10000, ''], ['140 Diamonds', '140 💎', 20000, ''], ['355 Diamonds', '355 💎', 50000, 'Best Value'], ['720 Diamonds', '720 💎', 100000, ''], ['Weekly Membership', 'Bundle', 28000, '']],
  'pubg-mobile': [['60 UC', '60 UC', 15000, ''], ['325 UC', '325 UC', 75000, 'Populer'], ['660 UC', '660 UC', 150000, ''], ['1800 UC', '1800 UC', 400000, 'Best Value'], ['3850 UC', '3850 UC', 800000, ''], ['Royal Pass', 'Bundle', 149000, '']],
  'honor-of-kings': [['16 Tokens', '16', 5000, ''], ['80 Tokens', '80', 25000, 'Populer'], ['240 Tokens', '240', 70000, ''], ['400 Tokens', '400', 115000, ''], ['800 Tokens', '800', 225000, 'Best Value']],
  'genshin-impact': [['60 Genesis Crystals', '60', 16000, ''], ['300 + 30 Crystals', '330', 79000, 'Populer'], ['980 + 110 Crystals', '1090', 249000, ''], ['1980 + 260 Crystals', '2240', 479000, 'Best Value'], ['Blessing of the Welkin Moon', 'Bundle', 79000, '']],
  'roblox': [['80 Robux', '80 R$', 15000, ''], ['400 Robux', '400 R$', 68000, 'Populer'], ['800 Robux', '800 R$', 135000, ''], ['1700 Robux', '1700 R$', 270000, 'Best Value'], ['4500 Robux', '4500 R$', 690000, '']],
  'valorant': [['125 VP', '125', 15000, ''], ['420 VP', '420', 50000, 'Populer'], ['700 VP', '700', 80000, ''], ['1375 VP', '1375', 150000, ''], ['2400 VP', '2400', 260000, 'Best Value']],
  'cod-mobile': [['80 CP', '80 CP', 15000, ''], ['420 CP', '420 CP', 75000, 'Populer'], ['880 CP', '880 CP', 150000, ''], ['2400 CP', '2400 CP', 400000, 'Best Value']],
  'arena-of-valor': [['50 Vouchers', '50', 10000, ''], ['150 Vouchers', '150', 28000, 'Populer'], ['350 Vouchers', '350', 65000, ''], ['700 Vouchers', '700', 128000, 'Best Value']],
  'wild-rift': [['125 Wild Cores', '125', 15000, ''], ['420 Wild Cores', '420', 50000, 'Populer'], ['1375 Wild Cores', '1375', 150000, ''], ['2400 Wild Cores', '2400', 260000, 'Best Value']],
  'clash-of-clans': [['80 Gems', '80', 15000, ''], ['500 Gems', '500', 75000, 'Populer'], ['1200 Gems', '1200', 170000, ''], ['2500 Gems', '2500', 340000, 'Best Value'], ['Gold Pass', 'Bundle', 79000, '']],
  'point-blank': [['1.200 PB Cash', '1200', 15000, ''], ['6.000 PB Cash', '6000', 70000, 'Populer'], ['12.000 PB Cash', '12000', 135000, ''], ['24.000 PB Cash', '24000', 260000, 'Best Value']],
  'growtopia': [['100 Gems', '100', 12000, ''], ['500 Gems', '500', 55000, 'Populer'], ['1.000 Gems', '1000', 105000, ''], ['2.500 Gems', '2500', 250000, 'Best Value']],
  'higgs-domino': [['100M Koin', '100M', 15000, ''], ['500M Koin', '500M', 70000, 'Populer'], ['1B Koin', '1B', 135000, ''], ['2B Koin', '2B', 260000, 'Best Value']],
  'steam-wallet': [['Steam Wallet Rp 12.000', '12K', 15000, ''], ['Steam Wallet Rp 45.000', '45K', 50000, 'Populer'], ['Steam Wallet Rp 90.000', '90K', 97000, ''], ['Steam Wallet Rp 250.000', '250K', 260000, 'Best Value'], ['Steam Wallet Rp 500.000', '500K', 515000, '']],
  'google-play': [['Google Play Rp 20.000', '20K', 23000, ''], ['Google Play Rp 50.000', '50K', 54000, 'Populer'], ['Google Play Rp 100.000', '100K', 105000, ''], ['Google Play Rp 300.000', '300K', 310000, 'Best Value']],
};

const paymentMethods = [
  { name: 'QRIS (Semua Bank & E-Wallet)', code: 'qris', type: 'qris', feePercent: 0.7, feeFixed: 0, configStatus: 'not_configured', sort: 1 },
  { name: 'GoPay', code: 'gopay', type: 'ewallet', feePercent: 2, feeFixed: 0, configStatus: 'not_configured', sort: 2 },
  { name: 'OVO', code: 'ovo', type: 'ewallet', feePercent: 2, feeFixed: 0, configStatus: 'not_configured', sort: 3 },
  { name: 'DANA', code: 'dana', type: 'ewallet', feePercent: 2, feeFixed: 0, configStatus: 'not_configured', sort: 4 },
  { name: 'ShopeePay', code: 'shopeepay', type: 'ewallet', feePercent: 2, feeFixed: 0, configStatus: 'not_configured', sort: 5 },
  { name: 'LinkAja', code: 'linkaja', type: 'ewallet', feePercent: 2, feeFixed: 0, configStatus: 'not_configured', sort: 6 },
  { name: 'BCA Virtual Account', code: 'bca-va', type: 'bank', feePercent: 0, feeFixed: 4000, configStatus: 'not_configured', sort: 7 },
  { name: 'BNI Virtual Account', code: 'bni-va', type: 'bank', feePercent: 0, feeFixed: 4000, configStatus: 'not_configured', sort: 8 },
  { name: 'BRI Virtual Account', code: 'bri-va', type: 'bank', feePercent: 0, feeFixed: 4000, configStatus: 'not_configured', sort: 9 },
  { name: 'Mandiri Virtual Account', code: 'mandiri-va', type: 'bank', feePercent: 0, feeFixed: 4000, configStatus: 'not_configured', sort: 10 },
  { name: 'Alfamart', code: 'alfamart', type: 'retail', feePercent: 0, feeFixed: 5000, configStatus: 'not_configured', sort: 11 },
  { name: 'Indomaret', code: 'indomaret', type: 'retail', feePercent: 0, feeFixed: 5000, configStatus: 'not_configured', sort: 12 },
  { name: 'Sandbox (Mode Uji)', code: 'sandbox', type: 'sandbox', feePercent: 0, feeFixed: 0, configStatus: 'configured', sort: 99 },
];

const settings = [
  { key: 'brand_name', value: 'HEAVYY TOP UP ID' },
  { key: 'support_whatsapp', value: '' },
  { key: 'support_email', value: '' },
  { key: 'supplier_default', value: process.env.SUPPLIER_DEFAULT ?? 'digiflazz' },
];

async function main() {
  const supplier = process.env.SUPPLIER_DEFAULT ?? 'digiflazz';

  // ---------- categories ----------
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  const catMap = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

  // ---------- games + products ----------
  for (const g of games) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name, publisher: g.publisher, categoryId: catMap.get(g.category) ?? null,
        logoUrl: `/img/games/${g.slug}.png`, bannerUrl: `/img/banners/${g.slug}.png`,
        idFields: g.idFields as object, popular: g.popular, status: 'active',
      },
      create: {
        name: g.name, slug: g.slug, publisher: g.publisher, categoryId: catMap.get(g.category) ?? null,
        logoUrl: `/img/games/${g.slug}.png`, bannerUrl: `/img/banners/${g.slug}.png`,
        idFields: g.idFields as object, popular: g.popular, status: 'active',
      },
    });

    const rows = productsByGame[g.slug] ?? [];
    let sort = 0;
    for (const [name, denom, price, badge] of rows) {
      const sku = `${g.slug}:${denom}`;
      const cost = Math.round((price * 0.88) / 100) * 100;
      await prisma.product.upsert({
        where: { gameId_sku: { gameId: game.id, sku } },
        update: { name, price, cost, badge: badge || null, status: 'active', sort: sort++ },
        create: {
          gameId: game.id, sku, name, price, cost, adminFee: 0,
          supplier, supplierSku: sku, badge: badge || null, status: 'active', sort: sort++,
        },
      });
    }
  }

  // ---------- payment methods ----------
  for (const m of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { code: m.code }, update: m, create: m });
  }

  // ---------- settings ----------
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  // ---------- admin user ----------
  const email = (process.env.ADMIN_EMAIL ?? 'admin@heavyy.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { name: 'Administrator', role: 'admin', status: 'active' },
    create: { email, name: 'Administrator', passwordHash, role: 'admin', status: 'active' },
  });

  const counts = {
    categories: await prisma.category.count(),
    games: await prisma.game.count(),
    products: await prisma.product.count(),
    paymentMethods: await prisma.paymentMethod.count(),
  };
  // eslint-disable-next-line no-console
  console.log('Seed complete:', counts);
  if (!process.env.ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.warn(`⚠  Admin default created: ${email} / ${password} — CHANGE THIS IMMEDIATELY in production.`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
