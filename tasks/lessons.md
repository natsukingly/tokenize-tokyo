
## 2026-09-27 提出動画（proof version）で受けた修正
- ナレーションに数字や関数名を入れすぎない。数字は画面のフッターに出し、声は「何が起きたか」だけ言う（natsuki: 「操作の内容具体的すぎ」「もっと短くしていい」）。
- 屋上（rooftop）を主語にしすぎない。空き家・駐車場・倉庫・広告面など資産の広がりを冒頭と本編で必ず入れる。
- 既存の映像クリップを流用する前に、スライドやデモ画面が現行版か確認する（古い intro クリップを使って指摘された）。
- ダッシュボードは Curvegrid の Digital Asset Dashboard 賞の対象。KPI だけでなく「Follow the deposited money」「What needs attention?」まで見せる。
- ffmpeg（Homebrew 版）に libass / drawtext は無い。字幕は Playwright で PNG を描き、動画をカット区間ごとに分割して 1 枚ずつ overlay → concat が確実。多入力 overlay チェーンや -loop 1 入力の多重はデッドロックする。
- 録音は複数ファイルで受け取り、whisper（small で十分）の単語タイムスタンプでセクション対応と字幕タイミングを決める。倍速は失格条件なので絶対にしない。
