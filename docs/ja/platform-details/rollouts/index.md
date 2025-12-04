Copy page

# ロールアウト

## ロールアウトの仕組み

[](#how-rollouts-work)

`wrangler deploy`を実行すると、Workerコードは即座に更新され、コンテナインスタンスはローリングデプロイ戦略を使用して更新されます。デフォルトのロールアウト設定は2段階で、最初のステップでインスタンスの10%を更新し、2番目のステップで残りの90%を更新します。これは、Wrangler設定ファイルで[`rollout_step_percentage`](/workers/wrangler/configuration#containers)プロパティを使用して設定できます。

変更をデプロイするときに、[`rollout_active_grace_period`](/workers/wrangler/configuration#containers)を設定することもできます。これは、アクティブなコンテナインスタンスがロールアウト中に更新の対象となるまでに待機する最小秒数です。その時点で、コンテナには`SIGTERM`が送信され、正常にシャットダウンするために15分の猶予があります。インスタンスが15分以内に停止しない場合、`SIGKILL`シグナルで強制的に停止されます。コンテナインスタンスが停止する前に実行する必要があるクリーンアップがある場合は、この15分の期間中に実行する必要があります。

停止すると、インスタンスは更新されたコードを実行している新しいインスタンスに置き換えられます。コンテナが再起動している間、リクエストがハングする場合があります。

以下は、5分の猶予期間と、最初のステップでインスタンスの10%を更新し、2番目のステップでインスタンスの100%を更新する2段階のロールアウトを設定する設定例です：

*   [wrangler.jsonc](#tab-panel-1392)
*   [wrangler.toml](#tab-panel-1393)

```
{  "$schema": "./node_modules/wrangler/config-schema.json",  "containers": [    {      "max_instances": 10,      "class_name": "MyContainer",      "image": "./Dockerfile",      "rollout_active_grace_period": 300,      "rollout_step_percentage": [        10,        100      ]    }  ],  "durable_objects": {    "bindings": [      {        "name": "MY_CONTAINER",        "class_name": "MyContainer"      }    ]  },  "migrations": [    {      "tag": "v1",      "new_sqlite_classes": [        "MyContainer"      ]    }  ]}
```

```
[[containers]]max_instances = 10class_name = "MyContainer"image = "./Dockerfile"rollout_active_grace_period = 300rollout_step_percentage = [10, 100]
[[durable_objects.bindings]]name = "MY_CONTAINER"class_name = "MyContainer"
[[migrations]]tag = "v1"new_sqlite_classes = ["MyContainer"]
```

## 即時ロールアウト

[](#immediate-rollouts)

コンテナインスタンスの100%にワンステップでロールアウトする1回限りのデプロイメントを実行する必要がある場合は、次のようにデプロイできます：

*   [npm](#tab-panel-1389)
*   [yarn](#tab-panel-1390)
*   [pnpm](#tab-panel-1391)

ターミナルウィンドウ

```
npx wrangler deploy --containers-rollout=immediate
```

ターミナルウィンドウ

```
yarn wrangler deploy --containers-rollout=immediate
```

ターミナルウィンドウ

```
pnpm wrangler deploy --containers-rollout=immediate
```

設定されている場合、`rollout_active_grace_period`は引き続き適用されることに注意してください。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/rollouts.mdx)

最終更新日: 2025年11月26日

[前へ  
制限とインスタンスタイプ](/containers/platform-details/limits/) [次へ  
イメージ管理](/containers/platform-details/image-management/)

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
