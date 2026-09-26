# TOKENIZE TOKYO ロゴ候補 NOTES

レンダリング: `node render.js [filter]`（Playwright は tokenize-tokyo の node_modules から絶対パスで読み込み）。
各 HTML は `?bg=dark` で背景 #0b0c0f（02/04 は #000）。2000×700、deviceScaleFactor 1、透過 PNG は omitBackground。

## 01 cyberpunk-edgerunners（本命）
- フォント: **Cyberway Riders**（Chequered Ink、dafont からDL成功 → `fonts/CyberwayRiders.otf`）/ Barlow Condensed 900 italic / Share Tech Mono（Google Fonts, OFL）
- ライセンス注意: Cyberway Riders は **非商用ライセンス（FSLA Non-Commercial）**。ハッカソン提出は非商用扱いで通る可能性が高いが、商用化・トークン発行時のブランド利用には商用ライセンス購入が必要。本採用するならアウトライン化ではなく購入 or 自作トレースを推奨。
- 代替DL: "Cyberpunk Is Not Dead"（`fonts/CIND.otf`, 作者表記「自由に使ってよい」）も取得したが、角ばったテック書体でブラシ感がないため不採用。
- パレット: #FCEE0A（本体）/ #00F0FF（シアン影・HUD）/ #FF003C（グリッチ1本）
- 手法: シアン影は text-shadow（-0.045em, +0.05em, blur 0）。グリッチは mark を JS で複製し clip-path の横帯＋translateX。黄色の帯は本体側を mask で穴あけして「ずれ」に見せている。
- 妥協: 2077 公式ロゴほど文字同士が有機的に絡まない（フォント依存）。190px 幅ではグリッチでやや潰れる → 小サイズ用はグリッチ無し版を別途作るべき。

## 02 evangelion
- フォント: Shippori Mincho B1 800 / Playfair Display 900（Google Fonts, OFL）
- パレット: #FFFFFF / #000000（dark 版）
- 妥協: エヴァ本家の「マティス EB」ではなく代替明朝。欧文は Playfair で、和文明朝の欧文より癖が強い。透過版は白文字なので白背景では見えない。

## 03 akira
- フォント: Anton / Noto Sans JP 700・900（Google Fonts, OFL）
- パレット: #E0201B
- 手法: SVG feTurbulence ノイズを mask にしてグレイン。カプセル2個をモチーフに。
- 妥協: AKIRA ロゴは太いゴシックの横長字形。Anton は縦長なので、トラッキングを広げて寄せたが本家ほどの「重さ・幅」は出ていない。

## 04 lain-terminal
- フォント: VT323 / Share Tech Mono（Google Fonts, OFL）
- パレット: #39FF14（蛍光グリーン）、#FFFFFF（URL強調）、dark 版背景 #000
- 手法: スキャンラインは repeating-linear-gradient を mask に（透過PNGでも効く）。背景に擬似乱数ヘックスダンプ（放射状マスクでフェード）。カーソルは CSS アニメ（PNG は点灯フレーム）。

## 05 tokusatsu-dela
- フォント: Dela Gothic One（Google Fonts, OFL）
- パレット: #E62E2E / #FFD400 / #FFFFFF / #000000
- 手法: -webkit-text-stroke（黒フチ）＋ text-shadow 積層で押し出し立体。集中線は repeating-conic-gradient。
- 妥協: 本物の戦隊ロゴのような文字ごとの手描きデフォルメやメタリックグラデは無し。

## 06 yakuza-brush
- フォント: Yuji Boku（東京）/ Yuji Syuku（タグ）/ Oswald 600 / Shippori Mincho B1 800（印の「証」）（全て Google Fonts, OFL）
- パレット: #111111（透過版の墨）/ #F4F1EA（dark 版の墨）/ #C1272D（印）/ #D4AF37（金）
- 妥協: 本家の荒い筆致（かすれ）はフォントのみでは弱い。墨ハネは円だけの簡易表現。

## 07 citypop-80s
- フォント: Audiowide（italic は合成斜体＋skewX）/ Monoton / M PLUS Rounded 1c 300（Google Fonts, OFL）
- パレット: #FF71CE / #7A5CFF / #01CDFE / 太陽上端 #FFD36E / 影 #2A1450
- 妥協: クローム感はグラデで表現した簡易版（反射ハイライト線なし）。Monoton の「TOKYO」は小さいサイズで判読性が落ちる。
