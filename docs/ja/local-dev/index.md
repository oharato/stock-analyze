Copy page

# ローカル開発

プロジェクトのディレクトリで[`npx wrangler dev`](/workers/wrangler/commands/#dev)（または[Cloudflare Viteプラグイン](/workers/vite-plugin/)を使用するViteプロジェクトの場合は`vite dev`）を実行するだけで、コンテナとWorkerの両方をローカルで実行できます。

Container対応のWorkerをローカルで開発するには、まずDocker互換のCLIツールとエンジンがインストールされていることを確認する必要があります。たとえば、[Docker Desktop ↗](https://docs.docker.com/desktop/)または[Colima ↗](https://github.com/abiosoft/colima)を使用できます。

開発セッションを開始すると、コンテナイメージがビルドまたはダウンロードされます。[Wrangler設定](/workers/wrangler/configuration/#containers)で`image`属性をローカルパスに設定している場合、イメージはローカルのDockerfileを使用してビルドされます。`image`属性がURLに設定されている場合、イメージはCloudflareレジストリからプルされます。

注意

現在、Cloudflare Viteプラグインは、`wrangler dev`とは異なり、ローカル開発でのレジストリリンクをサポートしていません。回避策として、`FROM <registry-link>`を使用する最小限のDockerfileを作成できます。ローカル開発用にもポートを`EXPOSE`することを確認してください。

Workerコードが新しいコンテナを作成するために呼び出すと、コンテナインスタンスがローカルで起動されます。リクエストは自動的に、ローカルで実行されている正しいコンテナにルーティングされます。

開発セッションが終了すると、関連するすべてのコンテナインスタンスは停止されますが、ローカルイメージは削除されないため、後続のビルドで再利用できます。

注意

Workerアプリが多数のコンテナインスタンスを作成する場合、ローカルマシンはCloudflareにデプロイするときほど多くのコンテナを同時に実行できない場合があります。

また、`max_instances`設定オプションはローカル開発中は適用されません。

さらに、コンテナをローカルで定期的に再構築する場合は、ディスク使用量を減らすために古いコンテナイメージをクリアする（`docker image prune`などを使用）ことをお勧めします。

## コンテナコードの反復

[](#iterating-on-container-code)

WranglerまたはViteで開発する場合、変更を保存するたびにWorkerのコードは自動的にリロードされますが、コンテナ内で実行されているコードはリロードされません。

新しいコード変更でコンテナを再構築するには、キーボードの`[r]`キーを押すと、再構築がトリガーされます。その後、コンテナインスタンスは新しくビルドされたイメージで再起動されます。

独自のコードウォッチャーとリロードメカニズムを設定するか、ローカルディレクトリをローカルコンテナイメージにマウントしてコード変更を同期することを好む場合があります。これは可能ですが、そのための組み込みメカニズムはなく、ベストプラクティスはコンテナコードで使用している言語とフレームワークによって異なります。

## トラブルシューティング

[](#troubleshooting)

### ポートの公開

[](#exposing-ports)

本番環境では、コンテナのすべてのポートにWorkerからアクセスできるため、Dockerfileの[`EXPOSE`命令 ↗](https://docs.docker.com/reference/dockerfile/#expose)を使用してポートを具体的に公開する必要はありません。

しかし、ローカル開発の場合は、アクセスする必要があるポートをDockerfileのEXPOSE命令で宣言する必要があります。たとえば、ポート4000にアクセスする場合は`EXPOSE 4000`とします。

ポートを公開していない場合、ローカル開発で次のエラーが表示されます：

```
The container "MyContainer" does not expose any ports. In your Dockerfile, please expose any ports you intend to connect to.
```

また、`Dockerfile`で公開していないポートに接続しようとすると、次のエラーが表示されます：

```
connect(): Connection refused: container port not found. Make sure you exposed the port in your container definition.
```

コンテナの起動中でポートがまだ利用できない場合にも、これが表示されることがあります。ポートが利用可能になるまで再試行する必要があります。この再試行ロジックは、[containersパッケージ ↗](https://github.com/cloudflare/containers/tree/main/src)を使用している場合は自動的に処理されます。

### ソケット設定 - `internal error`

[](#socket-configuration---internal-error)

コンテナへの接続を試みたときに不透明な`internal error`が表示される場合は、`DOCKER_HOST`環境変数をコンテナエンジンがリッスンしているソケットパスに設定する必要がある場合があります。WranglerまたはViteは、コンテナエンジンとの通信に使用する正しいソケットを自動的に見つけようとしますが、それが機能しない場合は、この環境変数を適切なソケットパスに設定する必要がある場合があります。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/local-dev.mdx)

最終更新日: 2025年9月22日

[前へ  
Containerパッケージ](/containers/container-package/) [次へ  
Wrangler設定 ↗](/workers/wrangler/configuration/#containers)

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
