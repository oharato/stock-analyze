Copy page

# 始める

このガイドでは、エンドユーザーのリクエストに応じて1つ以上のコンテナにリクエストを行うWorkerをデプロイします。この例では、各コンテナはGoで書かれた小さなWebサーバーを実行します。

この例のWorkerは、単純なコンテナの使用感を掴み、より複雑なユースケースの出発点となるはずです。

## 前提条件

[](#prerequisites)

### Dockerがローカルで実行されていることを確認する

[](#ensure-docker-is-running-locally)

このガイドでは、Workerコードと一緒にコンテナイメージをビルドしてプッシュします。デフォルトでは、このプロセスに[Docker ↗](https://www.docker.com/)を使用します。

`wrangler deploy`を実行するときは、ローカルでDockerを実行している必要があります。ほとんどの人にとって、Dockerをインストールする最良の方法は、[Docker Desktopのインストール手順 ↗](https://docs.docker.com/desktop/)に従うことです。[Colima ↗](https://github.com/abiosoft/colima)のような他のツールも機能する場合があります。

ターミナルで`docker info`コマンドを実行して、Dockerが正しく実行されていることを確認できます。Dockerが実行されている場合、コマンドは成功します。Dockerが実行されていない場合、`docker info`コマンドはハングするか、「Cannot connect to the Docker daemon（Dockerデーモンに接続できません）」というメッセージを含むエラーを返します。

## 最初のコンテナをデプロイする

[](#deploy-your-first-container)

以下のコマンドを実行して、スターターテンプレートからコンテナを含む新しいWorkerを作成してデプロイします：

*   [npm](#tab-panel-699)
*   [yarn](#tab-panel-700)
*   [pnpm](#tab-panel-701)

ターミナルウィンドウ

```
npm create cloudflare@latest -- --template=cloudflare/templates/containers-template
```

ターミナルウィンドウ

```
yarn create cloudflare --template=cloudflare/templates/containers-template
```

ターミナルウィンドウ

```
pnpm create cloudflare@latest --template=cloudflare/templates/containers-template
```

Workerまたはコンテナコードのいずれかにコード変更をデプロイする場合は、[Wrangler CLI](/workers/wrangler/)を使用して次のコマンドを実行できます：

*   [npm](#tab-panel-702)
*   [yarn](#tab-panel-703)
*   [pnpm](#tab-panel-704)

ターミナルウィンドウ

```
npx wrangler deploy
```

ターミナルウィンドウ

```
yarn wrangler deploy
```

ターミナルウィンドウ

```
pnpm wrangler deploy
```

`wrangler deploy`を実行すると、以下のことが起こります：

*   WranglerはDockerを使用してコンテナイメージをビルドします。
*   Wranglerは、Cloudflareアカウントと自動的に統合された[コンテナイメージレジストリ](/containers/platform-details/image-management/)にイメージをプッシュします。
*   WranglerはWorkerをデプロイし、コンテナのインスタンスを生成できるようにCloudflareのネットワークを構成します。

通常、最初のデプロイではビルドとプッシュに最も時間がかかります。その後のデプロイは、[キャッシュされたイメージレイヤーを再利用する ↗](https://docs.docker.com/build/cache/)ため、より高速になります。

注意

Workerを初めてデプロイした後、リクエストを受け取る準備ができるまで数分待つ必要があります。Workersとは異なり、Containersはプロビジョニングに数分かかります。この間、リクエストはWorkerに送信されますが、コンテナへの呼び出しはエラーになります。

### デプロイ状況を確認する

[](#check-deployment-status)

デプロイ後、次のコマンドを実行して、Cloudflareアカウント内のコンテナのリストとそのデプロイ状況を表示します：

*   [npm](#tab-panel-705)
*   [yarn](#tab-panel-706)
*   [pnpm](#tab-panel-707)

ターミナルウィンドウ

```
npx wrangler containers list
```

ターミナルウィンドウ

```
yarn wrangler containers list
```

ターミナルウィンドウ

```
pnpm wrangler containers list
```

また、以下のコマンドでCloudflareレジストリにデプロイされたイメージを確認できます：

*   [npm](#tab-panel-708)
*   [yarn](#tab-panel-709)
*   [pnpm](#tab-panel-710)

ターミナルウィンドウ

```
npx wrangler containers images list
```

ターミナルウィンドウ

```
yarn wrangler containers images list
```

ターミナルウィンドウ

```
pnpm wrangler containers images list
```

### コンテナへのリクエストを行う

[](#make-requests-to-containers)

次に、WorkerのURLを開きます。`https://hello-containers.YOUR_ACCOUNT_NAME.workers.dev`のようなURLになるはずです。

`/container/1`または`/container/2`というパスにリクエストを行うと、Workerは特定のコンテナにリクエストをルーティングします。"/container/"の後の異なるパスは、それぞれ一意のコンテナにルーティングされます。

`/lb`にリクエストを行うと、ランダムに選ばれた3つのコンテナのいずれかにリクエストがロードバランスされます。

各リクエストの出力を読むことで、この動作を確認できます。

## コードを理解する

[](#understanding-the-code)

最初のコンテナをデプロイしたので、Workerのコード、設定ファイル、コンテナのコードで何が起きているのか、そしてリクエストがどのようにルーティングされるのかを説明しましょう。

## 各コンテナは独自のDurable Objectによって支えられています

[](#each-container-is-backed-by-its-own-durable-object)

着信リクエストは最初にWorkerによって処理され、その後コンテナ対応の[Durable Object](/durable-objects)に渡されます。ボイラープレートコードを簡素化し削減するために、Cloudflareは`@cloudflare/containers` NPMパッケージの一部として[`Container`クラス ↗](https://github.com/cloudflare/containers)を提供しています。

Containersを使用するためにDurable Objectsに精通している必要はありませんが、基本を理解しておくと役立つ場合があります。

各Durable Objectは個々のコンテナインスタンスと一緒に実行され、その起動と停止を管理し、ポートを通じてコンテナと対話できます。コンテナは、リクエスト元のWorkerインスタンスの近くで実行される可能性が高いですが、必ずしもそうではありません。詳細については、["場所の選択方法"](/containers/platform-details/#how-are-locations-are-selected)を参照してください。

単純なアプリでは、Durable Objectはコンテナを起動し、リクエストをプロキシするだけかもしれません。

より複雑なアプリでは、コンテナ対応のDurable Objectsを使用することで、個々のステートフルなコンテナインスタンスへのリクエストのルーティング、コンテナライフサイクルの管理、コンテナへのカスタム起動コマンドや環境変数の受け渡し、コンテナステータス変更時のフックの実行などが可能になります。

詳細については、[Durable Objectコンテナメソッドのドキュメント](/durable-objects/api/container/)および[`Container`クラスのリポジトリ ↗](https://github.com/cloudflare/containers)を参照してください。

### 設定

[](#configuration)

[Wrangler設定ファイル](/workers/wrangler/configuration/)は、Workerとコンテナの両方の設定を定義します：

*   [wrangler.jsonc](#tab-panel-711)
*   [wrangler.toml](#tab-panel-712)

```
{  "$schema": "./node_modules/wrangler/config-schema.json",  "containers": [    {      "max_instances": 10,      "class_name": "MyContainer",      "image": "./Dockerfile"    }  ],  "durable_objects": {    "bindings": [      {        "name": "MY_CONTAINER",        "class_name": "MyContainer"      }    ]  },  "migrations": [    {      "tag": "v1",      "new_sqlite_classes": [        "MyContainer"      ]    }  ]}
```

```
[[containers]]max_instances = 10class_name = "MyContainer"image = "./Dockerfile"
[[durable_objects.bindings]]name = "MY_CONTAINER"class_name = "MyContainer"
[[migrations]]tag = "v1"new_sqlite_classes = ["MyContainer"]
```

この設定に関する重要なポイント：

*   `image`は、DockerfileまたはDockerfileを含むディレクトリを指します。
*   `class_name`は、[Durable Objectクラス名](/durable-objects/api/base/)でなければなりません。
*   `max_instances`は、同時に実行されるコンテナインスタンスの最大数を宣言します。
*   Durable Objectは、`new_classes`ではなく[`new_sqlite_classes`](/durable-objects/best-practices/access-durable-objects-storage/#create-sqlite-backed-durable-object-class)を使用する必要があります。

### コンテナイメージ

[](#the-container-image)

コンテナイメージは`linux/amd64`アーキテクチャで実行できる必要がありますが、それ以外にはほとんど制限はありません。

デプロイしたばかりの例では、Workerで設定される`MESSAGE`環境変数と、[自動生成される環境変数](/containers/platform-details/#environment-variables) `CLOUDFLARE_DEPLOYMENT_ID`を使用して、ポート8080でリクエストに応答する単純なGolangサーバーです。

```
func handler(w http.ResponseWriter, r *http.Request) {  message := os.Getenv("MESSAGE")  instanceId := os.Getenv("CLOUDFLARE_DEPLOYMENT_ID")
   fmt.Fprintf(w, "Hi, I'm a container and this is my message: %s, and my instance ID is: %s", message, instanceId)}
```

注意

サンプルコードをデプロイした後、別のイメージをデプロイするには、提供されたイメージを独自のイメージに置き換えることができます。

### Workerコード

[](#worker-code)

#### コンテナ設定

[](#container-configuration)

まず、[`Container` ↗](https://github.com/cloudflare/containers)クラスを拡張する`MyContainer`に注目してください：

JavaScript

```
export class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = '10s';  envVars = {    MESSAGE: 'I was passed in via the container class!',  };
   override onStart() {    console.log('Container successfully started');  }
   override onStop() {    console.log('Container successfully shut down');  }
   override onError(error: unknown) {    console.log('Container error:', error);  }}
```

これはコンテナの基本的な設定を定義します：

*   `defaultPort`は、`fetch`および`containerFetch`メソッドがコンテナと通信するために使用するポートを設定します。また、コンテナがこのポートでリッスンするまでリクエストをブロックします。
*   `sleepAfter`は、コンテナが一定時間アイドル状態になった後にスリープするタイムアウトを設定します。
*   `envVars`は、コンテナの起動時に渡される環境変数を設定します。
*   `onStart`、`onStop`、および`onError`は、それぞれコンテナの起動時、停止時、またはエラー時に実行されるフックです。

詳細と設定オプションについては、[Containerクラスのドキュメント](/containers/container-package)を参照してください。

#### コンテナへのルーティング

[](#routing-to-containers)

リクエストがCloudflareに入ると、Workerの[`fetch`ハンドラー](/workers/runtime-apis/handlers/fetch/)が呼び出されます。これは、着信リクエストを処理するコードです。サンプルコードのfetchハンドラーは、異なるルートで2つの方法でコンテナを起動します：

*   `/container/`へのリクエストを行うと、パスごとに新しいコンテナにリクエストが渡されます。これは、新しいContainerインスタンスを起動することによって行われます。新しいパスへの最初のリクエストは、後続のリクエストよりも時間がかかることに気付くかもしれません。これは、新しいコンテナが起動しているためです。
    
    JavaScript
    
    ```
    if (pathname.startsWith("/container")) {  const container = env.MY_CONTAINER.getByName(pathname);  return await container.fetch(request);}
    ```
    
*   `/lb`へのリクエストを行うと、リクエストは複数のコンテナ間でロードバランスされます。これは単純な`getRandom`ヘルパーメソッドを使用しており、設定された数（この場合は3）からランダムにIDを選び、そのContainerインスタンスにルーティングします。これを、実装することを選択した任意のルーティングまたはロードバランシングロジックに置き換えることができます：
    
    JavaScript
    
    ```
    if (pathname.startsWith("/lb")) {  const container = await getRandom(env.MY_CONTAINER, 3);  return await container.fetch(request);}
    ```
    

これにより、Containersを使用する複数の方法が可能になります：

*   単に多くのステートレスで交換可能なコンテナにリクエストを送信したい場合は、ロードバランスを行うべきです。
*   ステートフルなサービスがある場合、または個別にアドレス指定可能なコンテナが必要な場合は、特定のContainerインスタンスをリクエストすべきです。
*   短命なジョブを実行している場合、コンテナのライフサイクルを細かく制御したい場合、コンテナのエントリーポイントや環境変数をパラメータ化したい場合、または複数のコンテナ呼び出しを連鎖させたい場合は、特定のContainerインスタンスをリクエストすべきです。

注意

現在、多くの交換可能なContainerインスタンスの1つへのリクエストのルーティングは、`getRandom`ヘルパーを使用して行われています。

これは一時的なものです — 今後数ヶ月以内に、レイテンシを考慮したオートスケーリングとロードバランシングのネイティブサポートを追加する予定です。

## ダッシュボードでコンテナを表示する

[](#view-containers-in-your-dashboard)

[Containers ダッシュボード ↗](http://dash.cloudflare.com/?to=/:account/workers/containers)には、以下を含むContainersに関する役立つ情報が表示されます：

*   ステータスとヘルス
*   メトリクス
*   ログ
*   関連するWorkersとDurable Objectsへのリンク

Workerを起動した後、サイドバーの「Workers & Pages」の下にある「Containers」をクリックして、Containersダッシュボードに移動します。

## 次のステップ

[](#next-steps)

さらに行うには：

*   Dockerfileを変更して`wrangler deploy`を呼び出し、イメージを変更する
*   [例](/containers/examples)を確認して、さらなるインスピレーションを得る
*   [Containersベータ版の詳細情報](/containers/beta-info)を取得する

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/get-started.mdx)

最終更新日: 2025年10月21日

[前へ  
概要](/containers/) [次へ  
例](/containers/examples/)

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
