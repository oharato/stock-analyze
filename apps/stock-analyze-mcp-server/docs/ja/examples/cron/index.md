Copy page

# Cronコンテナ

Cronトリガーを使用してスケジュールでコンテナを実行する

スケジュールでコンテナを起動するには、Workers [Cron Trigger](/workers/configuration/cron-triggers/)を使用できます。

完全な例については、[Cronコンテナテンプレート ↗](https://github.com/mikenomitch/cron-container/tree/main)を参照してください。

Wrangler設定でcron式を使用してスケジュールを指定します：

*   [wrangler.jsonc](#tab-panel-1331)
*   [wrangler.toml](#tab-panel-1332)

```
{  "name": "cron-container",  "main": "src/index.ts",  "triggers": {    "crons": [      "*/2 * * * *" // 2分ごとに実行    ]  },  "containers": [    {      "class_name": "CronContainer",      "image": "./Dockerfile"    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "CronContainer",        "name": "CRON_CONTAINER"      }    ]  },  "migrations": [    {      "new_sqlite_classes": ["CronContainer"],      "tag": "v1"    }  ]}
```

```
name = "cron-container"main = "src/index.ts"
[triggers]crons = [ "*/2 * * * *" ]
[[containers]]class_name = "CronContainer"image = "./Dockerfile"
[[durable_objects.bindings]]class_name = "CronContainer"name = "CRON_CONTAINER"
[[migrations]]new_sqlite_classes = [ "CronContainer" ]tag = "v1"
```

その後、Workerで"scheduled"ハンドラーからコンテナを呼び出します：

TypeScript

```
import { Container, getContainer } from '@cloudflare/containers';
export class CronContainer extends Container {  sleepAfter = '10s';
  override onStart() {    console.log('Starting container');  }
  override onStop() {    console.log('Container stopped');  }}
export default {  async fetch(): Promise<Response> {    return new Response("This Worker runs a cron job to execute a container on a schedule.");  },
  async scheduled(_controller: any, env: { CRON_CONTAINER: DurableObjectNamespace<CronContainer> }) {    let container = getContainer(env.CRON_CONTAINER);    await container.start({      envVars: {        MESSAGE: "Start Time: " + new Date().toISOString(),      }    })  },};
```

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/cron.mdx)

最終更新日: 2025年11月24日

[前へ  
静的フロントエンド、コンテナバックエンド](/containers/examples/container-backend/) [次へ  
ステータスフック](/containers/examples/status-hooks/)

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
