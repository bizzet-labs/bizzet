---
theme: default
title: bizzet ピッチ（3分）
info: |
  ETHGlobal Tokyo 2026 ピッチ動画アウトライン（3分/180秒）
class: text-center
highlighter: shiki
transition: fade
mdc: true
---

# bizzet
### ビジネスのための、ウォレット。

<div class="pt-8 opacity-70 text-sm">ETHGlobal Tokyo 2026</div>

<!--
全体で180秒。課題20s→解決策20s→デモ100s→技術的な工夫30s→結果としめ10s。
-->

---

# 課題
<TimeChip from="0:00" to="0:20" :seconds="20" />

<div class="mt-8 text-lg leading-relaxed">

- ウォレットは<b>個人向けばかり</b>で、ビジネスが暗号資産で売上を受け取り、管理する仕組みがない
- 決済代行を挟めば審査と手数料がかかり、個人向けウォレットには<b>「誰が出金できるか」という概念がない</b>

</div>

<!-- 画面：課題を一言で示すタイトルスライド（決済代行の図に×、個人ウォレットに×） -->

---

# 解決策
<TimeChip from="0:20" to="0:40" :seconds="20" />

<div class="mt-4 text-lg leading-relaxed">

**bizzet**：「ビジネスのための、ウォレット」

- 客の支払いは店舗のウォレットに直接入り、売上は本部のウォレットに集まる
- 本部・店舗のグループ、Owner・Approver・Viewer のロール、出金の2人承認、ENS での受取先の一元管理

</div>

<FlowDiagram />

---

# デモ①：客の支払い
<TimeChip from="0:40" to="1:20" :seconds="40" />

<div class="mt-8 text-lg leading-relaxed">

1. 値札の QR を読み、決済ページ（`/pay/[name]`）を開く <span class="opacity-50 text-sm">(P-02)</span>
2. 店舗の ENS の名前（例 `shibuya.bizzet.eth`）を Universal Resolver で解決し、受取先と受け取る通貨（JPYC / USDC）を表示 <span class="opacity-50 text-sm">(P-06)</span>
3. 客のウォレットから ERC-20 を送り、「処理中」→「済」に切り替わる <span class="opacity-50 text-sm">(P-04)</span>

</div>

<!-- 画面：実機（または画面録画）でのクリック操作。値札のQR→決済ページ→送金→「済」まで通す。 -->

---

# デモ②：事業者の運用
<TimeChip from="1:20" to="2:20" :seconds="60" />

<div class="mt-6 text-base leading-relaxed">

1. グループ一覧で店舗の ENS 名・Safe の状態・残高を確認 <span class="opacity-50 text-sm">(D-11 / DS-11)</span>
2. 店舗を1つ追加し、Safe の設定と ENS への登録が進む様子を見せる <span class="opacity-50 text-sm">(D-07 / DS-12)</span>
3. メンバーを追加し、グループとロール（Owner / Approver / Viewer）を割り当てる <span class="opacity-50 text-sm">(D-05 / DS-06,07)</span>
4. 出金を作成し、ウォレットでパスキーの署名を求める <span class="opacity-50 text-sm">(D-04,09 / DS-09, WS-06)</span>
5. 2人目の承認で `execTransaction` が実行され、出金が完了する <span class="opacity-50 text-sm">(W-04, W-05)</span>

</div>

<!-- テストデータでの通しがすでに動くため、台本どおりに操作する。 -->

---

# 技術的な工夫
<TimeChip from="2:20" to="2:50" :seconds="30" />

<div class="mt-6 text-base leading-relaxed">

- Safe の SDK を使わず、Safe4337Module の設定・パスキー署名者の作成・オーナー設定を1つの `setup()` にまとめ、Safe を<b>1トランザクションで</b>立ち上げる（EIP-712 `SafeOp` も自前実装）
- <b>パスキー（WebAuthn / P-256）がそのまま Safe のオーナーになる</b>。秘密鍵は誰も持たず、ガス代は ERC-4337 の Paymaster が肩代わり
- ENSv2 の<b>リソース単位のロール</b>で受取先レコードを書ける鍵を絞り、店舗の名前1つの書き換えで全チャネルの受取先が変わる
- Roles v2 で、将来の自動ブリッジのキーパー権限を「本部の Safe への送金だけ」に固定し、盗まれても資金に届かない設計

</div>

<!-- 画面：実際に Sepolia で送信した UserOperation のトランザクションハッシュ（Etherscanの画面） -->

---
layout: center
class: text-center
---

# 結果としめ
<TimeChip from="2:50" to="3:00" :seconds="10" />

<div class="mt-8 text-lg leading-relaxed">

vitest 32件・コントラクトのフォークテスト13件がすべて通過<br />
パスキーでの実際の Sepolia への送信も確認済み

<div class="mt-6 opacity-70 text-base">
次は Checkout コントラクトでの決済時の交換と、<br />
ゼロ知識証明を使ったレシート（買った記録による割引）に取り組む
</div>

<div class="mt-10 text-2xl">
bizzet ― ビジネスのための、ウォレット。
</div>

</div>

<!--
メモ・確認事項（発表者ノート、録画には映さない）
- デモで使う店舗名・金額・メンバー名を確定する
- Sepolia のテストデータ（Safe・メンバー・招待）を録画前にリセットして用意する
- Etherscan で見せるトランザクションハッシュのタブを事前に開いておく
- 100秒のデモ部分は必ず一度通しで練習し、操作の待ち時間（署名・トランザクション反映）を録画前に把握する
-->
