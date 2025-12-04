Copy page

# 静的フロントエンド、コンテナバックエンド

コンテナ化されたバックエンドを持つシンプルなフロントエンドアプリ

一般的なパターンは、Static Assetsを使用して静的フロントエンドアプリケーション（例：React、Vue、Svelte）を提供し、バックエンドリクエストをコンテナ化されたバックエンドアプリケーションに渡すことです。

この例では、静的アセットとして提供される単純な`index.html`ファイルを使用した例を示しますが、多くのフロントエンドフレームワークのいずれかを選択できます。詳細については、[Workersフレームワークの例](/workers/framework-guides/web-apps/)を参照してください。

完全な例については、[静的フロントエンド + コンテナバックエンドテンプレート ↗](https://github.com/mikenomitch/static-frontend-container-backend)を参照してください。

## Static Assetsとコンテナの設定

[](#configure-static-assets-and-a-container)

*   [wrangler.jsonc](#tab-panel-1329)
*   [wrangler.toml](#tab-panel-1330)

```
{  "name": "cron-container",  "main": "src/index.ts",  "assets": {    "directory": "./dist",    "binding": "ASSETS"  },  "containers": [    {      "class_name": "Backend",      "image": "./Dockerfile",      "max_instances": 3    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "Backend",        "name": "BACKEND"      }    ]  },  "migrations": [    {      "new_sqlite_classes": [        "Backend"      ],      "tag": "v1"    }  ]}
```

```
name = "cron-container"main = "src/index.ts"
[assets]directory = "./dist"binding = "ASSETS"
[[containers]]class_name = "Backend"image = "./Dockerfile"max_instances = 3
[[durable_objects.bindings]]class_name = "Backend"name = "BACKEND"
[[migrations]]new_sqlite_classes = [ "Backend" ]tag = "v1"
```

## 提供する単純なindex.htmlファイルを追加する

[](#add-a-simple-indexhtml-file-to-serve)

`./dist`ディレクトリに単純な`index.html`ファイルを作成します。

index.html

```
<!DOCTYPE html><html lang="en">
<head>  <meta charset="UTF-8">  <meta name="viewport" content="width=device-width, initial-scale=1.0">  <title>Widgets</title>  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/alpinejs/3.13.3/cdn.min.js"></script></head>
<body>  <div x-data="widgets()" x-init="fetchWidgets()">    <h1>Widgets</h1>    <div x-show="loading">Loading...</div>    <div x-show="error" x-text="error" style="color: red;"></div>    <ul x-show="!loading && !error">      <template x-for="widget in widgets" :key="widget.id">        <li>          <span x-text="widget.name"></span> - (ID: <span x-text="widget.id"></span>)        </li>      </template>    </ul>
    <div x-show="!loading && !error && widgets.length === 0">      ウィジェットが見つかりません。    </div>
  </div>
  <script>    function widgets() {      return {        widgets: [],        loading: false,        error: null,
        async fetchWidgets() {          this.loading = true;          this.error = null;
          try {            const response = await fetch('/api/widgets');            if (!response.ok) {              throw new Error(`HTTP ${response.status}: ${response.statusText}`);            }            this.widgets = await response.json();          } catch (err) {            this.error = err.message;          } finally {            this.loading = false;          }        }      }    }  </script>
</body>
</html>
```

この例では、[Alpine.js ↗](https://alpinejs.dev/)を使用して`/api/widgets`からウィジェットのリストを取得しています。

これは非常に単純な例であることを意図していますが、大幅に複雑にすることもできます。詳細については、[フロントエンドフレームワークと統合するWorkersの例](/workers/framework-guides/web-apps/)を参照してください。

## Workerを定義する

[](#define-a-worker)

Workerは、静的アセットの提供と、コンテナ化されたバックエンドへのリクエストのルーティングの両方ができる必要があります。

この場合、ルートが`/api`で始まる場合は3つのコンテナインスタンスのいずれかにリクエストを渡し、その他のすべてのリクエストは静的アセットとして提供されます。

JavaScript

```
import { Container, getRandom } from "@cloudflare/containers";
const INSTANCE_COUNT = 3;
class Backend extends Container {  defaultPort = 8080; // コンテナ内のポート8080にリクエストを渡す  sleepAfter = "2h"; // 2時間リクエストがない場合のみコンテナをスリープさせる}
export default {  async fetch(request, env) {    const url = new URL(request.url);    if (url.pathname.startsWith("/api")) {      // 注意: "getRandom"は近い将来、レイテンシを考慮したルーティングに置き換えられる予定です      const containerInstance = await getRandom(env.BACKEND, INSTANCE_COUNT);      return containerInstance.fetch(request);    }
    return env.ASSETS.fetch(request);  },};
```

注意

この例では`getRandom`関数を使用しています。これは、リクエストをルーティングするためにN個のContainerインスタンスからランダムに1つを選択する一時的なヘルパーです。

将来的には、改善されたレイテンシを考慮したロードバランシングとオートスケーリングを提供する予定です。

これにより、ステートレスインスタンスのスケーリングが簡単になり、ルーティングがより効率的になります。詳細については、[オートスケーリングのドキュメント](/containers/platform-details/scaling-and-routing)を参照してください。

## バックエンドコンテナを定義する

[](#define-a-backend-container)

コンテナは`/api/widgets`へのリクエストを処理できる必要があります。

この場合、ハードコードされたウィジェットのリストを返す単純なGolangバックエンドを使用します。

server.go

```
package main
import (  "encoding/json"  "log"  "net/http")
func handler(w http.ResponseWriter, r \*http.Request) {  widgets := []map[string]interface{}{    {"id": 1, "name": "Widget A"},    {"id": 2, "name": "Sprocket B"},    {"id": 3, "name": "Gear C"},  }
  w.Header().Set("Content-Type", "application/json")  w.Header().Set("Access-Control-Allow-Origin", "*")  json.NewEncoder(w).Encode(widgets)
}
func main() {  http.HandleFunc("/api/widgets", handler)  log.Fatal(http.ListenAndServe(":8080", nil))}
```

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/container-backend.mdx)

最終更新日: 2025年9月22日

[前へ  
ステートレスインスタンス](/containers/examples/stateless/) [次へ  
Cronコンテナ](/containers/examples/cron/)

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
