# Stock Analyze セキュリティガイド

このドキュメントでは、Cloudflare の無料プランを使用して、AI および Web サービスを保護するために実装できるセキュリティ対策の概要を説明します。

## 1. ✅ 完了: 内部サービスの隔離
`stock-analyze-mcp` を **非公開 (Private)** に設定しました。
- **実施内容**: `apps/stock-analyze-mcp/wrangler.jsonc` に `"workers_dev": false` を追加しました。
- **結果**: MCP サーバーはパブリックインターネットからアクセスできなくなりました。`stock-analyze-ai` ワーカー経由のセキュアな「Service Bindings」を通してのみアクセス可能です。

## 2. 🛡️ WAF (Web Application Firewall) - *手動設定が必要です*
WAF ルールはゾーンレベル（あなたのドメイン `ohchans.com`）で管理されるため、Cloudflare ダッシュボードで設定する必要があります。

### ステップ 1: Bot Fight Mode (ボットファイトモード) の有効化
1. **Cloudflare Dashboard** > **Security** > **Bots** に移動します。
2. **Bot Fight Mode** を **On** に切り替えます。
   - *これにより、単純な自動化ボットやスクリプトによるアクセスをブロックできます。*

### ステップ 2: WAF カスタムルールの設定 (無料プラン上限: 5ルール)
1. **Cloudflare Dashboard** > **Security** > **WAF** > **Custom rules** に移動します。
2. **Create rule** をクリックします。
3. **ルール例 1: 不審な地域からのアクセスをブロック** (任意)
   - **Name**: "Block High Risk Countries"
   - **Expression**: `(ip.geoip.country in {"CN" "RU" "NK"})` (必要に応じてカスタマイズしてください)
   - **Action**: `Block` (ブロック) または `Managed Challenge` (チャレンジ)。

### ステップ 3: レート制限 (Rate Limiting) (無料プラン上限: 1ルール)
1. **Cloudflare Dashboard** > **Security** > **WAF** > **Rate limiting rules** に移動します。
2. **Create rule** をクリックします。
3. **ルールの設定**:
   - **Rule Name**: "Global Rate Limit"
   - **If incoming requests match**: `URI Path` contains `/api/chat`.
   - **Then**: `Block` または `Managed Challenge`
   - **When rate exceeds**: `20` requests
   - **Period**: `10` seconds
   - **For**: `IP Address`
   - *これにより、一人のユーザーによる AI エンドポイントへのスパム行為を防ぎます。*

## 3. 🤖 Turnstile (スマートCAPTCHA) - *本番環境に推奨*
高コストな AI エンドポイントのボット悪用を防ぐため、Cloudflare Turnstile の導入を推奨します。

1. **Cloudflare Dashboard** > **Turnstile** に移動します。
2. `ohchans.com` 用のサイトを追加します。
3. **Site Key** (サイトキー) と **Secret Key** (シークレットキー) を取得します。
4. **実装**:
   - フロントエンド (`stock-analyze-web`) に Turnstile ウィジェットを追加します。
   - バックエンド (`stock-analyze-ai`) でトークンを検証するように更新します。

*Turnstile を実装したい場合は、Site Key と Secret Key をお知らせいただくか、コードの雛形の追加をご依頼ください。*
