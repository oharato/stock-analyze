Copy page

# Containers (ベータ版)

サーバーレスコンテナでWorkersを強化しましょう

Workers Paidプランで利用可能

[Workers](/workers)上に構築されたアプリの一部として、あらゆるプログラミング言語で書かれ、あらゆるランタイム向けに構築されたコードを実行できます。

インフラストラクチャの管理を心配することなく、コンテナイメージをRegion:Earthにデプロイできます。Workerを定義して`wrangler deploy`を実行するだけです。

Containersを使用すると、以下のことが可能になります：

*   並列実行されるCPUコア、大量のメモリ、またはディスク容量を必要とするリソース集約型アプリケーション
*   完全なファイルシステム、特定のランタイム、またはLinuxライクな環境を必要とするアプリケーションやライブラリ
*   コンテナイメージとして配布されている既存のアプリケーションやツール

コンテナインスタンスはオンデマンドで起動し、[Worker](/workers)に記述したコードによって制御されます。API呼び出しを連鎖させたり、Kubernetesオペレーターを作成したりする代わりに、JavaScriptを書くだけです：

*   [Worker Code](#tab-panel-715)
*   [Worker Config](#tab-panel-716)

JavaScript

```
import { Container, getContainer } from "@cloudflare/containers";
export class MyContainer extends Container {  defaultPort = 4000; // コンテナがリッスンしているポート  sleepAfter = "10m"; // 10分間リクエストがない場合、インスタンスを停止}
export default {  async fetch(request, env) {    const { "session-id": sessionId } = await request.json();    // 指定されたセッションIDのコンテナインスタンスを取得    const containerInstance = getContainer(env.MY_CONTAINER, sessionId);    // デフォルトポートでコンテナインスタンスにリクエストを渡す    return containerInstance.fetch(request);  },};
```

*   [wrangler.jsonc](#tab-panel-713)
*   [wrangler.toml](#tab-panel-714)

```
{  "name": "container-starter",  "main": "src/index.js",  "compatibility_date": "2025-12-03",  "containers": [    {      "class_name": "MyContainer",      "image": "./Dockerfile",      "max_instances": 5    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "MyContainer",        "name": "MY_CONTAINER"      }    ]  },  "migrations": [    {      "new_sqlite_classes": ["MyContainer"],      "tag": "v1"    }  ]}
```

```
name = "container-starter"main = "src/index.js"compatibility_date = "2025-12-03"
[[containers]]class_name = "MyContainer"image = "./Dockerfile"max_instances = 5
[[durable_objects.bindings]]class_name = "MyContainer"name = "MY_CONTAINER"
[[migrations]]new_sqlite_classes = [ "MyContainer" ]tag = "v1"
```

[

始める

](/containers/get-started/)[

Containers ダッシュボード

](https://dash.cloudflare.com/?to=/:account/workers/containers)

* * *

## 次のステップ

[](#next-steps)

### 最初のコンテナをデプロイする

イメージをビルドしてプッシュし、Workerからコンテナを呼び出し、スケーリングとルーティングを理解します。

[コンテナをデプロイする](/containers/get-started/)

### コンテナの例

ステートレスおよびステートフルルーティング、リージョナルプレースメント、WorkflowやQueueとの統合、AI生成コードの実行、短命なワークロードなど、Workerでコンテナを使用する方法の例をご覧ください。

[例を見る](/containers/examples/)

* * *

## その他のリソース

[](#more-resources)

[ベータ版情報](/containers/beta-info/)

Containersベータ版と今後の機能について学びます。

[Wrangler](/workers/wrangler/commands/#containers)

Wranglerを使用して、イメージの開発、ビルド、プッシュ、およびコンテナのデプロイを行うためのコマンドについて詳しく学びます。

[制限](/containers/platform-details/#limits)

Containersの制限と、その範囲内で作業する方法について学びます。

[Containers Discord](https://discord.cloudflare.com)

Discordで他のContainersユーザーとつながりましょう。質問したり、作っているものを紹介したり、他の開発者とプラットフォームについて議論したりできます。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/index.mdx)

最終更新日: 2025年9月22日

[次へ  
始める](/containers/get-started/)

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
