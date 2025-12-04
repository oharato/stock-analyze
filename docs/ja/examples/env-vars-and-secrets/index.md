Copy page

# 環境変数とシークレット

環境変数とシークレットをコンテナに渡す

環境変数は、[`Container`](/containers/container-package)クラスの`envVars`フィールドを使用するか、コンテナの起動時に手動で設定することで、コンテナに渡すことができます。

シークレットは、[Worker Secrets](/workers/configuration/secrets/)または[Secret Store](/secrets-store/integrations/workers/)を使用してコンテナに渡すことができ、その後、環境変数としてコンテナに渡されます。

KV値は、[Workers KV](/kv/)を使用してコンテナに渡すことができ、その後、値を読み取って環境変数としてコンテナに渡します。

これらの例は、シークレット、KV値、および環境変数を渡すさまざまな方法を示しています。それぞれにおいて、以下を渡します：

*   ハードコードされた環境変数としての変数`"ENV_VAR"`
*   Worker Secretsからのシークレットとしてのシークレット`"WORKER_SECRET"`
*   Secret Storeからのシークレットとしてのシークレット`"SECRET_STORE_SECRET"`
*   Workers KVからの値としての値`"KV_VALUE"`

実際には、シークレットとデータを保存する方法のいずれか1つを使用するだけで済む場合がありますが、完全性のためにすべての方法を示します。

## シークレットとKVデータの作成

[](#creating-secrets-and-kv-data)

まず、Worker Secretsに`"WORKER_SECRET"`シークレットを作成しましょう：

*   [npm](#tab-panel-1335)
*   [yarn](#tab-panel-1336)
*   [pnpm](#tab-panel-1337)

ターミナルウィンドウ

```
npx wrangler secret put WORKER_SECRET
```

ターミナルウィンドウ

```
yarn wrangler secret put WORKER_SECRET
```

ターミナルウィンドウ

```
pnpm wrangler secret put WORKER_SECRET
```

次に、Secret Storeに"demo"というストアを作成し、そこに`"SECRET_STORE_SECRET"`シークレットを追加しましょう：

*   [npm](#tab-panel-1338)
*   [yarn](#tab-panel-1339)
*   [pnpm](#tab-panel-1340)

ターミナルウィンドウ

```
npx wrangler secrets-store store create demo --remote
```

ターミナルウィンドウ

```
yarn wrangler secrets-store store create demo --remote
```

ターミナルウィンドウ

```
pnpm wrangler secrets-store store create demo --remote
```

*   [npm](#tab-panel-1341)
*   [yarn](#tab-panel-1342)
*   [pnpm](#tab-panel-1343)

ターミナルウィンドウ

```
npx wrangler secrets-store secret create demo --name SECRET_STORE_SECRET --scopes workers --remote
```

ターミナルウィンドウ

```
yarn wrangler secrets-store secret create demo --name SECRET_STORE_SECRET --scopes workers --remote
```

ターミナルウィンドウ

```
pnpm wrangler secrets-store secret create demo --name SECRET_STORE_SECRET --scopes workers --remote
```

次に、`DEMO_KV`というKV名前空間を作成し、キーと値のペアを追加しましょう：

*   [npm](#tab-panel-1344)
*   [yarn](#tab-panel-1345)
*   [pnpm](#tab-panel-1346)

ターミナルウィンドウ

```
npx wrangler kv namespace create DEMO_KV
```

ターミナルウィンドウ

```
yarn wrangler kv namespace create DEMO_KV
```

ターミナルウィンドウ

```
pnpm wrangler kv namespace create DEMO_KV
```

*   [npm](#tab-panel-1347)
*   [yarn](#tab-panel-1348)
*   [pnpm](#tab-panel-1349)

ターミナルウィンドウ

```
npx wrangler kv key put --binding DEMO_KV KV_VALUE 'Hello from KV!'
```

ターミナルウィンドウ

```
yarn wrangler kv key put --binding DEMO_KV KV_VALUE 'Hello from KV!'
```

ターミナルウィンドウ

```
pnpm wrangler kv key put --binding DEMO_KV KV_VALUE 'Hello from KV!'
```

シークレットの作成方法の詳細については、[Workers Secretsドキュメント](/workers/configuration/secrets/)および[Secret Storeドキュメント](/secrets-store/integrations/workers/)を参照してください。KVのセットアップについては、[Workers KVドキュメント](/kv/)を参照してください。

## バインディングの追加

[](#adding-bindings)

次に、Wrangler設定でシークレット、KV値、および環境変数にアクセスするためのバインディングを追加する必要があります。

*   [wrangler.jsonc](#tab-panel-1350)
*   [wrangler.toml](#tab-panel-1351)

```
{  "name": "my-container-worker",  "vars": {    "ENV_VAR": "my-env-var"  },  "secrets_store_secrets": [    {      "binding": "SECRET_STORE",      "store_id": "demo",      "secret_name": "SECRET_STORE_SECRET"    }  ],  "kv_namespaces": [    {      "binding": "DEMO_KV",      "id": "<your-kv-namespace-id>"    }  ]  // 設定の残り...}
```

```
name = "my-container-worker"
[vars]ENV_VAR = "my-env-var"
[[secrets_store_secrets]]binding = "SECRET_STORE"store_id = "demo"secret_name = "SECRET_STORE_SECRET"
[[kv_namespaces]]binding = "DEMO_KV"id = "<your-kv-namespace-id>"
```

`"WORKER_SECRET"`は自動的に`env`に追加されるため、Wrangler設定ファイルで指定する必要がないことに注意してください。

また、Wrangler設定ファイルの_コンテナ関連_部分では、環境変数、シークレット、またはKV値について特定のものを設定していないことにも注意してください。

## Containerクラスでの`envVars`の使用

[](#using-envvars-on-the-container-class)

次に、`Container`クラスの`envVars`フィールドを使用して、環境変数とシークレットをコンテナに渡しましょう：

JavaScript

```
// https://developers.cloudflare.com/workers/runtime-apis/bindings/#importing-env-as-a-globalimport { env } from "cloudflare:workers";export class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = "10s";  envVars = {    WORKER_SECRET: env.WORKER_SECRET,    ENV_VAR: env.ENV_VAR,    // シークレットストアのバインディングやKV値をここでデフォルトとして設定することはできません。値の取得は非同期であるためです。  };}
```

この`Container`のすべてのインスタンスは、起動時にこれらの変数とシークレットが環境変数として設定されます。

## インスタンスごとの環境変数の設定

[](#setting-environment-variables-per-instance)

しかし、インスタンスごとに環境変数を設定したい場合はどうすればよいでしょうか？

この場合、`startAndWaitForPorts()`メソッドを使用して、各インスタンスに環境変数を渡します。

JavaScript

```
export class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = "10s";}
export default {  async fetch(request, env) {    if (new URL(request.url).pathname === "/launch-instances") {      let instanceOne = env.MY_CONTAINER.getByName("foo");      let instanceTwo = env.MY_CONTAINER.getByName("bar");
      // 各インスタンスは異なる環境変数のセットを取得します
      await instanceOne.startAndWaitForPorts({        startOptions: {          envVars: {            ENV_VAR: env.ENV_VAR + "foo",            WORKER_SECRET: env.WORKER_SECRET,            SECRET_STORE_SECRET: await env.SECRET_STORE.get(),            KV_VALUE: await env.DEMO_KV.get("KV_VALUE"),          },        },      });
      await instanceTwo.startAndWaitForPorts({        startOptions: {          envVars: {            ENV_VAR: env.ENV_VAR + "bar",            WORKER_SECRET: env.WORKER_SECRET,            SECRET_STORE_SECRET: await env.SECRET_STORE.get(),            KV_VALUE: await env.DEMO_KV.get("KV_VALUE"),            // インスタンスごとに異なるKVキーを読み取ることもできます            INSTANCE_CONFIG: await env.DEMO_KV.get("instance-bar-config"),          },        },      });      return new Response("Container instances launched");    }
    // ... など ...  },};
```

## コンテナでのKV値の読み取り

[](#reading-kv-values-in-containers)

KV値は、頻繁には変更されないがコンテナからアクセスできる必要がある設定データに特に役立ちます。KV操作は非同期であるため、コンテナの起動時に実行時に値を読み取る必要があります。

コンテナでKVを使用するための一般的なパターンは次のとおりです：

### 設定データ

[](#configuration-data)

JavaScript

```
export default {  async fetch(request, env) {    if (new URL(request.url).pathname === "/configure-container") {      // KVから設定を読み取る      const config = await env.DEMO_KV.get("container-config", "json");      const apiUrl = await env.DEMO_KV.get("api-endpoint");
      let container = env.MY_CONTAINER.getByName("configured");
      await container.startAndWaitForPorts({        startOptions: {          envVars: {            CONFIG_JSON: JSON.stringify(config),            API_ENDPOINT: apiUrl,            DEPLOYMENT_ENV: await env.DEMO_KV.get("deployment-env"),          },        },      });
      return new Response("Container configured and launched");    }  },};
```

### 機能フラグ

[](#feature-flags)

JavaScript

```
export default {  async fetch(request, env) {    if (new URL(request.url).pathname === "/launch-with-features") {      // KVから機能フラグを読み取る      const featureFlags = {        ENABLE_FEATURE_A: await env.DEMO_KV.get("feature-a-enabled"),        ENABLE_FEATURE_B: await env.DEMO_KV.get("feature-b-enabled"),        DEBUG_MODE: await env.DEMO_KV.get("debug-enabled"),      };
      let container = env.MY_CONTAINER.getByName("features");
      await container.startAndWaitForPorts({        startOptions: {          envVars: {            ...featureFlags,            CONTAINER_VERSION: "1.2.3",          },        },      });
      return new Response("Container launched with feature flags");    }  },};
```

## ビルド時環境変数

[](#build-time-environment-variables)

最後に、Wrangler設定の`image_vars`フィールドを使用して、コンテナイメージのビルド時にのみ使用可能なビルド時環境変数を設定することもできます。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/env-vars-and-secrets.mdx)

最終更新日: 2025年9月24日

[前へ  
ステータスフック](/containers/examples/status-hooks/) [次へ  
コンテナへのWebsocket](/containers/examples/websocket/)

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
