# ロゴ制作メモ（2026-09-26）

## 決定事項
- 文字: TOKENIZE TOKYO（2段構成。上段 TOKENIZE 筆文字、下段 TOKYO 太字イタリック）
- 本命: Cyberpunk: Edgerunners 風（黄 #FCEE0A ＋ シアン #00F0FF のグリッチずれ）
- 納品: SVG ＋ 透過 PNG（横2000px）。`public/brand/` に置く
- 別案: サブカル路線（エヴァ / AKIRA / Lain 端末 / 特撮 / 龍が如く筆 / 80s シティポップ）を PNG で並べて比較

## 現状
- 既存 `public/brand/cyberpunk-brush.png` は黒い切り抜き残りあり → 置き換え予定
- 参照箇所: `src/components/Dashboard.tsx` の2箇所（サイドバー、トップバー）
- 候補の生成はサブエージェントに委譲中（scratchpad/logos/）

## 注意
- 筆文字系の無料フォントは「個人利用フリー」が多い。商用化前にライセンス確認

## ラウンド1の結果（2026-09-26 夕方）
- 7案＋Lain 黄色/アンバー版を `docs/brand-candidates/` に生成。ギャラリー: https://claude.ai/artifact/YQ433gzUnLuAcBDGRiBYoL
- natsuki の評価: 「どれもちょっとずつダサい」。原因は「色・エフェクトが派手」「要素が多い・ごちゃごちゃ」
- 決定: Cyberpunk 案を引き算で磨く方向に絞る（他の路線は保留）

## ラウンド2の方針
- 1案 = 1アイデア。グリッチ帯・赤・HUD線・テック文字・®は全部削る
- 10: 筆文字 TOKENIZE ＋ シアンの硬いずれ1つだけ / 11: 黄一色 / 12: TOKYO を主役に反転 / 13: サイドバー用 190px 版
- 文字間は手でカーニング（K–E、I–Z の隙間）

## 生成の再実行
- `docs/brand-candidates/src/` で `node render.cjs <番号>`（プロジェクトが ESM なので .cjs）

## ラウンド2の結果（2026-09-26 夜）
- 10 ずれ1つ / 11 一色 / 12 TOKYO主役 / 13 サイドバー190px を生成し、ギャラリー先頭に追加（Version 3）
- 私の推奨: 10 を本採用、13 をサイドバー、12 は OG 画像・表紙向け
- 生成元: docs/brand-candidates/src/10〜13-*.html。render.cjs は「small」を含む名前で 190×66 も追加描画
- natsuki の採用判断待ち。採用後: SVG パス化 ＋ 透過 PNG を public/brand/ に納品、Dashboard.tsx 2箇所の参照差し替え、旧 cyberpunk-brush.png 削除

## サイドバーロゴの要望（2026-09-26 夜、保留中）
- natsuki: サイドバーにロゴを置いてよい。閉じたら消すか簡略化する
- コード側の事実: city-view では `.city-view .sidebar` が 72px 幅で `.brand` を display:none、`.city-sidebar-expanded` で 208px 幅（src/app/city-view.css）。ロゴ画像は `.brand-cyberpunk`（cyberpunk.css）と `.city-brand img`（topbar）
- 案: 展開時は 13（190px 版）、折りたたみ時（72px）は筆文字「T」＋シアンずれの単独マーク。未着手
