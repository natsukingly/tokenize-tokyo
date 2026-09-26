import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./', import.meta.url));
const destination = '/Users/yamaguchinatsuki/Desktop/Tokenize Tokyo - Submission Media';
await mkdir(destination, { recursive:true });
const items = [
  ['logo-512.png', 'logo-512.png', 'Logo', '512 × 512 · サイトと同じリングのマーク'],
  ['cover-1920x1080.png', 'cover-1920x1080.png', 'Cover image', '1920 × 1080 · 16:9'],
  ['06-rooftop-map.png', 'screenshot-01-rooftop-map.png', '01 · 屋根の権利を地図で探す', 'Explore tokenized urban spaces and inspect a rooftop’s revenue rights and ENS identity.'],
  ['02-dashboard-overview.png', 'screenshot-02-dashboard.png', '02 · ダッシュボードで把握する', 'Monitor deposited revenue, asset composition, and primary, secondary, and basket trading volume.'],
  ['05-rooftop-rights.png', 'screenshot-03-rights-purchase.png', '03 · 権利と購入条件を確認する', 'Review scope, duration, transfer policy, supply, price, and payment options before buying a rooftop revenue right.'],
  ['04-ens-permissions.png', 'screenshot-04-ens-permissions.png', '04 · ENSで役割を委任する', 'An ENSv2 rooftop namespace separates owner, operator, and energy-reporter permissions on Sepolia.'],
];
const files = [];
for (const [from, name, title, caption] of items) {
  const bytes = await readFile(path.join(source, from));
  const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20);
  if (name.startsWith('logo') ? width!==512 || height!==512 : width*9!==height*16) throw new Error(`Unexpected dimensions: ${name}`);
  await copyFile(path.join(source,from), path.join(destination,name));
  files.push({name,title,caption,width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const cards=files.map(file=>`<article class="${file.name.startsWith('logo')?'logo':''}"><a href="${file.name}"><img src="${file.name}" alt="${file.title}"></a><div><h2>${file.title}</h2><p>${file.caption}</p><a class="download" href="${file.name}" download>${file.name} ↗</a><small>${file.width} × ${file.height} · ${(file.bytes/1024/1024).toFixed(2)} MB</small></div></article>`).join('\n');
await writeFile(path.join(destination,'index.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tokenize Tokyo — 提出画像</title><style>*{box-sizing:border-box}body{margin:0;background:#101214;color:#f1f2f3;font:16px/1.7 system-ui,sans-serif}main{max-width:1300px;margin:auto;padding:44px 32px 80px}h1{font-size:34px;line-height:1.3;margin:0 0 14px}header{margin-bottom:32px}header p{color:#afb4bb;margin:8px 0}.tag{color:#ede431;font-size:12px;letter-spacing:2px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{overflow:hidden;background:#1a1d20;border:1px solid #3c4147;border-radius:12px}article img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#0b0c0e}article.logo img{height:330px;width:100%;object-fit:contain}article>div{padding:20px 24px}h2{font-size:20px;margin:0 0 8px}article p{font-size:14px;color:#b8bdc5;margin:0 0 12px}a{color:#ede431;text-decoration:none}a:hover{text-decoration:underline}small{display:block;color:#9da4ad;margin-top:10px}@media(max-width:750px){.grid{grid-template-columns:1fr}main{padding:24px 18px}h1{font-size:28px}}</style><main><header><div class="tag">ETHGLOBAL · SUBMISSION MEDIA</div><h1>Tokenize Tokyo 提出画像</h1><p>Logo・Cover image にそれぞれ1枚、Screenshots に番号順で4枚をアップロードしてください。</p><p>スクリーンショットは公開サイトの実画面です。Sepoliaのテスト資産とmJPYを表示しています。購入画面は購入前の状態です。</p></header><div class="grid">${cards}</div></main></html>`);
await writeFile(path.join(destination,'README.md'),`# Tokenize Tokyo — 提出画像\n\n## アップロード先\n\n| フォームの欄 | ファイル | サイズ |\n| --- | --- | --- |\n${files.map(f=>`| ${f.name.startsWith('logo')?'Logo':f.name.startsWith('cover')?'Cover image':'Screenshots'} | ${f.name} | ${f.width} × ${f.height} |`).join('\n')}\n\nScreenshotsは番号順に4枚。最低3枚の条件を満たしています。index.html で画像を一覧できます。\n\n## 英語の説明文\n\n${files.slice(2).map(f=>`### ${f.name}\n\n${f.caption}`).join('\n\n')}\n\n## 撮影元\n\n- 公開デモ: https://tokenize-tokyo.vercel.app/\n- ENS: https://tokenize-tokyo.vercel.app/ens\n- 撮影日: 2026-09-27 JST\n- 公開Sepolia版の実画面。架空のテスト資産、テスト通貨mJPY、検証のシミュレーションという表示を保持。\n- ウォレット未接続・購入前の画面。撮影による取引の送信はなし。\n- ロゴは既存 docs/brand/mark-monow.svg のPNG書き出し。カバーは同じブランドのタイポグラフィに 06-rooftop-map.png の地図を合成したもの。\n- 地図の OpenFreeMap / OpenMapTiles / OpenStreetMap 帰属表示を保持。\n- 数値は撮影時点の状態で、公開サイトの更新により変化します。\n`);
await writeFile(path.join(destination,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),source:'https://tokenize-tokyo.vercel.app',screenshots:'Unmodified browser captures of the public Sepolia application',files},null,2));
console.log(JSON.stringify({destination,files:files.map(({name,width,height,bytes})=>({name,width,height,bytes}))},null,2));
