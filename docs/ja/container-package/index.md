Copy page

# Containerパッケージ

コンテナインスタンスと対話するコードを書く場合、[Durable Objectを直接使用する](/containers/platform-details/durable-object-methods)か、[`@cloudflare/containers` ↗](https://www.npmjs.com/package/@cloudflare/containers)からインポート可能な[`Container`クラス ↗](https://github.com/cloudflare/containers)を使用できます。

ほとんどのユースケースでは、`Container`クラスを使用することをお勧めします。

*   [npm](#tab-panel-694)
*   [yarn](#tab-panel-695)
*   [pnpm](#tab-panel-696)

ターミナルウィンドウ

```
npm i @cloudflare/containers
```

ターミナルウィンドウ

```
yarn add @cloudflare/containers
```

ターミナルウィンドウ

```
pnpm add @cloudflare/containers
```

その後、`Container`を拡張するクラスを定義し、Workerで使用できます：

JavaScript

```
import { Container } from "@cloudflare/containers";
class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = "5m";}
export default {  async fetch(request, env) {    // デフォルトインスタンスを取得し、Worker外部からのリクエストを転送する    return env.MY_CONTAINER.getByName("hello").fetch(request);  },};
```

`Container`クラスは`DurableObject`を拡張しているため、すべての[Durable Object](/durable-objects)機能が利用可能です。また、以下のような一般的なコンテナ動作のための追加機能と優れたインターフェースも提供します：

*   非アクティブタイムアウト後のインスタンスのスリープ
*   特定のポートへのリクエスト
*   起動、停止、またはエラー時のステータスフックの実行
*   リクエストを行う前に特定のポートを待機する
*   環境変数とシークレットの設定

詳細と完全なAPIについては、[Containers GitHubリポジトリ ↗](https://github.com/cloudflare/containers)を参照してください。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/container-package.mdx)

最終更新日: 2025年9月22日

[前へ  
Durable Objectインターフェース ↗](/durable-objects/api/container/) [次へ  
ローカル開発](/containers/local-dev/)

*   **リソース**
*   [API](/api/)
*   [Cloudflareのご利用が初めての方](/fundamentals/)
*   [ディレクトリ](/directory/)
*   [スポンサーシップ](/sponsorships/)
*   [オープンソース](https://github.com/cloudflare)

*   **サポート**
*   [ヘルプセンター](https://support.cloudflare.com/)
*   [システムステータス](https://www.cloudflarestatus.com/)
*   [コンプライアンス](https://www.cloudflare.com/trust-hub/compliance-resources/)
*   [GDPR](https://www.cloudflare.com/trust-hub/gdpr/)

*   **会社情報**
*   [cloudflare.com](https://www.cloudflare.com/)
*   [チーム](https://www.cloudflare.com/people/)
*   [採用情報](https://www.cloudflare.com/careers/)

*   **ツール**
*   [Cloudflare Radar](https://radar.cloudflare.com/)
*   [Speed Test](https://speed.cloudflare.com/)
*   [Is BGP Safe Yet?](https://isbgpsafeyet.com/)
*   [RPKI Toolkit](https://rpki.cloudflare.com/)
*   [Certificate Transparency](https://ct.cloudflare.com/)

*   **コミュニティ**
*   [X](https://x.com/cloudflare)
*   [Discord](http://discord.cloudflare.com/)
*   [YouTube](https://www.youtube.com/cloudflare)
*   [GitHub](https://github.com/cloudflare/cloudflare-docs)

*   © 2025 Cloudflare, Inc.
*   [プライバシーポリシー](https://www.cloudflare.com/privacypolicy/)
*   [利用規約](https://www.cloudflare.com/website-terms/)
*   [セキュリティ問題の報告](https://www.cloudflare.com/disclosure/)
*   [商標](https://www.cloudflare.com/trademark/)
*   Cookie設定
