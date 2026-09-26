# 最新デモシナリオ — Concept → Map → Tokenize → Funding

4分の提案。現行の公開デモ画面で「都市の未利用空間を発見し、権利を定義し、資金募集へつなぐ」一本の流れを見せる。人間による4分通しのリハーサルは別途必要。

## 覚えてもらう一文

> We don't tokenize buildings. We tokenize what a city can do.

建物の所有権を売るのではなく、空間が提供できる利用権・収益権を市場へ出す。

## 4分の構成

| 時間 | 画面と操作 | 伝えること / English narration |
| --- | --- | --- |
| 0:00–0:25 | 東京の3Dマップを背景にコンセプト紹介 | 「都市には、使われていない屋根や空間がある。足りないのは資産ではなく、それを活用する人と資金をつなぐ市場です。」 / “Tokyo already has the spaces. We connect their unused capacity with people and capital.” |
| 0:25–1:00 | Explore → Filters。Rooftopで対象を絞り、必要ならParkingやVacant Homeも短く見せる。最後は屋根に戻す | 「一覧を探すのではなく、都市そのものを検索します。」 / “Search the city itself. Find the space and see what it can provide.” 該当する複数空間のハイライトを見せ、単一物件への自動移動とは区別する。 |
| 1:00–2:25 | 選んだデモ用屋根からTokenize。Solar Revenue Shareの条件を定義し、資産・権利の模擬承認を経てLaunch crowdfunding | 「この屋根の事業から実際に入金された収益を受け取る権利を作ります。初期提供では審査済み法人だけが登録できます。ここでは審査を模擬しています。」 / “Define the space, the period and the right. Our initial launch is for pre-approved companies; these reviews are simulated.” |
| 2:25–3:30 | View campaign → Markets / Funding。募集口数、単価、募集総額、進捗を説明。Investor Bへ切り替え、権利を確認して購入し、Fundingへ戻って進捗を見る | 「登録した権利が、そのまま資金募集になります。参加者が何を受け取るのか、いくら集まったのかが見えます。」 / “The verified right becomes an issuer offer. Participants can review what they receive and see funding progress.” |
| 3:30–4:00 | Portfolioで購入した持分を短く見せ、Exploreへ戻して締める | 「保有した権利は将来の取引や組成の基礎になります。まず、未利用空間と資金をつなぐところから。」 / “A space becomes a right, and that right can be funded and held. Put dormant urban capacity back to work.” |

## 準備

- 公開版は **SIMULATED DEMO**。ブラウザ内のシミュレーションであり、クリックごとに実チェーンへ送信するデモではないことを最初に短く伝える。
- 別の新しいブラウザプロファイルで準備する。利用中のデモデータをResetしない。
- 地図タイルを事前に読み込む。Demo roleはOwner Aから開始し、初期提供での承認済み法人の担当者役として説明する。実際に法人承認済みと主張しない。
- 屋根候補を1つ決めておく。**Map tools → Opportunity Lens**のデモ候補を選択すると位置を引き継いだ登録モーダルが開く。候補点は架空の機会データで、所有権や設置適性を確認した実在案件ではない。
- 候補クリックが難しい場合は、**Tokenize → Choose on map**で同じデモ用位置を選ぶ。既存の承認済み資産と同じ座標の別アセットを新規登録しない。
- 例：名称 **Tokyo Demo Solar Roof**、Revenue Share **100口**、単価 **1,000 mJPY**、今回の募集 **100口**。期間・条件は下書きで用意し、開始と終了が有効な値であることを確認する。mJPYは無価値のテスト通貨。
- 登録、承認、発行、出品、購入は本編中に行う。準備済みの下書きや模擬審査を隠さない。

## Tokenizeの正確な操作

1. Owner Aで **Continue to rights**。**Revenue Share**、供給100口、**Primary price (mJPY): 1000** を設定。
2. **Review & publish → Register demo asset → Submit for verification**。
3. **Switch to Demo verifier → Demo verify asset**。
4. **Switch to Owner A → Issue right**。
5. **Switch to Demo verifier → Demo verify right**。
6. **Switch to Owner A → Units to offer: 100 → Launch crowdfunding → View campaign**。

資産の承認と、その資産から発行する権利の承認を別々に見せる。説明は「模擬審査です」の一文で済ませ、フォームの技術項目は読み上げない。

## Fundingの正確な操作と見せる数字

1. **Show → Revenue shares**で候補を絞り、作った案件で **100 offered / 1,000 mJPY per unit / 100,000 mJPY full subscription** を示す。
2. **Demo role → Investor B**。
3. 対象カードの **Review rights & participate**。地図上の詳細で権利条件を読み、確認チェックを入れる。
4. **Purchase quantity: 20 → Acquire right**。
5. **Markets → Funding → Show: Revenue shares**へ戻り、対象カードの **20,000 mJPY raised / 20% / 1 supporting wallets** を確認する。カード順は固定しないため案件名で探す。
6. **Portfolio**でその収益権を20口保有していることを示す。

現在のFundingは固定価格の一次販売。購入代金は売り手に直接渡り、資金預託・募集期限・目標未達時の自動返金はない。「完成済みのエスクロー型クラウドファンディング」とは説明しない。20%の購入でActivatedにはならない。

## 本編から外し、質問が出たら見せる機能

- **Activated:** Demo verifier → Tokenize → Working onで対象を選ぶ → 必要ならManage rightで対象のRevenue Shareを選ぶ → Activate project。現地稼働の証拠確認は模擬で、資金募集とは別工程。
- **稼働前後の比較:** Explore → Filters → Active。稼働済みの模擬サンプル4件（屋根2件・空き家1件・倉庫1件）が表示される。開始時点で稼働している設定で、資金調達実績や収益入金は意味しない。Nihonbashi / Kandaは従来どおり未稼働のデモに使える。
- **ENS階層:** NamespacesでCity → District → Asset → Space → Rightを開き、空間単位の委譲という実装方針を示す。名前・委譲はプレビューで、ENSで実発行済みとは説明しない。
- **Revenue:** Activeの収益権へテスト通貨をdepositし、保有者がPortfolioでclaimする。入金前の利回りは作らない。
- **Basket:** 複数の収益権を持つ運用者がComposeで束ね、預託した裏付けに対してバスケット持分を発行する。購入者はまとめて保有・譲渡・償還できる。
- **二次市場:** 保有者による再販売。新規の事業資金調達とは別の代金フロー。
- **Fractional / Rental:** 別のmock市場。実際の共同所有契約や賃貸借を成立させない。
- **Curvegrid:** この公開UIは模擬。別のCurvegrid Testnet実行記録とMultiBaasのindex/queryを実証する場合は、その実トランザクションの記録を開く。模擬取引のhashをExplorer証拠として使わない。

## 短縮時の判断

時間が足りなければ別アセット種別の紹介と最後のPortfolioを省く。資産・権利の承認、Fundingの参加条件、購入による進捗変化は残す。途中で問題が起きた場合は事前準備した案件を「準備済みの例」と明示して紹介し、成功を装わない。

現行の登録・募集・購入・進捗更新は `tests/markets.spec.ts`、承認フローは `tests/onboarding.spec.ts` がカバーする。`tests/pitch-demo.spec.ts` は[以前の競合検出・稼働中心シナリオ](PITCH_DEMO.md)を実行するもので、この新しい4分台本を計測するテストではない。
