Copy page

# コンテナのライフサイクル

## デプロイメント

[](#deployment)

Containerを使用してアプリケーションをデプロイすると、イメージは[Cloudflareのレジストリ](/containers/platform-details/image-management)にアップロードされ、Cloudflareのネットワークにグローバルに配信されます。Cloudflareは、同時実行コンテナインスタンスの数をスケールアップする際の起動時間を短縮するために、世界中でインスタンスを事前にスケジュールし、イメージを事前にフェッチします。

デプロイ時に即座に更新されるWorkersとは異なり、コンテナインスタンスはローリングデプロイ戦略を使用して更新されます。これにより、ロールアウト中に実行中のインスタンスを正常にシャットダウンできます。詳細については、[ロールアウト](/containers/platform-details/rollouts/)を参照してください。

## リクエストのライフサイクル

[](#lifecycle-of-a-request)

### クライアントからWorkerへ

[](#client-to-worker)

Containersは[Durable Objects](/durable-objects/)と[Workers](/workers/)によって支えられていることを思い出してください。リクエストは最初にWorkerを介してルーティングされます。これは通常、リクエストを行うユーザーとの間のレイテンシが最も良い場所にあるデータセンターによって処理されます。[Smart Placement](/workers/configuration/smart-placement/)がオンになっている場合、または最も近い場所が高負荷の場合、全体的なレイテンシを最適化するために別のデータセンターが選択される場合があります。

すべてのContainerリクエストはWorkerを通過するため、エンドユーザーはコンテナインスタンスに対して非HTTP TCPまたはUDPリクエストを行うことはできません。エンドユーザーからのインバウンドTCPまたはUDPを必要とするユースケースがある場合は、[お知らせください ↗](https://forms.gle/AGSq54VvUje6kmKu8)。

### WorkerからDurable Objectへ

[](#worker-to-durable-object)

Workerから、リクエストはDurable Objectインスタンスを通過します（[Containerパッケージ](/containers/container-package)はDurable Objectクラスを拡張します）。各Durable Objectインスタンスは、コードを実行して状態を保存できるグローバルにルーティング可能なアイソレートです。これにより、開発者は特定のコンテナインスタンス（配置場所に関係なく）に簡単にアドレス指定してルーティングし、コンテナのステータス変更時にフックを定義して実行し、インスタンスで定期的なチェックを実行し、各インスタンスに関連付けられた永続的な状態を保存できます。

### コンテナの起動

[](#starting-a-container)

Durable Objectインスタンスが新しいコンテナインスタンスの起動を要求すると、**事前にフェッチされたイメージを持つ最も近い場所**が選択されます。

注意

現在、Durable Objectsは関連するコンテナインスタンスと同じ場所に配置される場合がありますが、多くの場合そうではありません。

Cloudflareは現在、Durable Objectを実行できる場所の数を拡大することに取り組んでおり、これによりコンテナインスタンスが常にDurable Objectと同じ場所で実行できるようになります。

追加のコンテナインスタンスを起動すると、事前にフェッチされたイメージを持つ他の場所が使用され、Cloudflareは追加のスケーリングと迅速なコールドスタートのために、舞台裏で追加のマシンの準備を自動的に開始します。事前にウォームアップされた場所の数には限りがあるため、一部のコンテナインスタンスはエンドユーザーから遠い場所で起動される場合があります。これは、コンテナインスタンスが迅速に起動するようにするために行われます。アクティブに実行されているインスタンスに対してのみ課金され、未使用の事前にウォームアップされたイメージに対しては課金されません。

#### コールドスタート

[](#cold-starts)

コールドスタートとは、完全に停止した状態からコンテナインスタンスが起動されることです。完全に新しいIDで`env.MY_CONTAINER.get(id)`を呼び出し、このインスタンスを初めて起動すると、コールドスタートが発生します。これにより、コンテナイメージがエントリポイントから初めて起動されます。このエントリポイントが何をするかによって、起動にかかる時間は異なります。

コンテナのコールドスタートは多くの場合2〜3秒の範囲ですが、これはイメージサイズやコード実行時間などの要因によって異なります。

### 実行中のコンテナへのリクエスト

[](#requests-to-running-containers)

リクエストが新しいコンテナインスタンスを_開始_すると、事前にフェッチされたイメージを持つ最も近い場所が選択されます。特定のインスタンスへの後続のリクエストは、どこから発信されたかに関係なく、インスタンスが生きている限りこの場所にルーティングされます。

ただし、そのコンテナインスタンスが停止して再起動すると、将来のリクエストは_別の_場所にルーティングされる可能性があります。この場所は、再び、事前にフェッチされたイメージを持つ、元のリクエストに最も近い場所になります。

### コンテナランタイム

[](#container-runtime)

各コンテナインスタンスは独自のVM内で実行され、Cloudflareのネットワーク上で実行されている他のワークロードから強力に分離されています。コンテナは`linux/amd64`アーキテクチャ用に構築する必要があり、[サイズ制限](/containers/platform-details/limits)内に収まる必要があります。

[ログ記録](/containers/faq/#how-do-container-logs-work)、メトリクス収集、および[ネットワーク](/containers/faq/#how-do-i-allow-or-disallow-egress-from-my-container)は、開発者の設定に従って各コンテナで自動的に設定されます。

### コンテナのシャットダウン

[](#container-shutdown)

Containerクラスで[`sleepAfter` ↗](https://github.com/cloudflare/containers/blob/main/README.md#properties)を設定しない場合、またはインスタンスを手動で停止しない場合、コンテナはリクエストの受信を停止した直後にシャットダウンします。`sleepAfter`を設定すると、コンテナは指定された期間、存続します。

`stop()`または`destroy()`を呼び出すことで、コンテナインスタンスを手動でシャットダウンできます。詳細については、[Containerパッケージドキュメント ↗](https://github.com/cloudflare/containers/blob/main/README.md#container-methods)を参照してください。

コンテナインスタンスがシャットダウンされる場合、`SIGTERM`シグナルが送信され、15分後に`SIGKILL`シグナルが送信されます。この時間内に正常なシャットダウンを確実にするために必要なクリーンアップを実行する必要があります。

#### 永続ディスク

[](#persistent-disk)

すべてのディスクは一時的です。コンテナインスタンスがスリープ状態になると、次に起動されたときには、コンテナイメージで定義された新しいディスクが使用されます。永続ディスクはCloudflareチームが将来検討しているものですが、近い将来の予定はありません。

## リクエストの例

[](#an-example-request)

*   開発者がコンテナをデプロイします。Cloudflareはネットワーク全体でインスタンスを自動的に準備します。
*   アルゼンチンのバリローチェにいるクライアントからリクエストが行われます。リクエストは、近くのアルゼンチンのネウケンにあるCloudflareの場所のWorkerに到達します。
*   このWorkerリクエストは`getContainer(env.MY_CONTAINER, "session-1337")`を呼び出します。内部的には、これによりDurable Objectが起動し、その後`this.ctx.container.start`が呼び出されます。
*   これにより、最も近い空きコンテナインスタンスがリクエストされます。Cloudflareは、アルゼンチンのブエノスアイレスでインスタンスが空いていることを認識し、そこで起動します。
*   別のユーザーが同じコンテナにルーティングする必要があります。このユーザーのリクエストは、米国のサンディエゴにあるCloudflareの場所で実行されているWorkerに到達します。
*   Workerは再び`getContainer(env.MY_CONTAINER, "session-1337")`を呼び出します。
*   最初のコンテナインスタンスがまだ実行中の場合、リクエストはブエノスアイレスの元の場所にルーティングされます。最初のコンテナがスリープ状態になった場合、Cloudflareは再びコンテナの最も近い「空き」インスタンス（おそらく北米にあるもの）を見つけようとし、そこでインスタンスを起動します。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/architecture.mdx)

最終更新日: 2025年10月10日

[前へ  
Durable Objectsを直接使用する ↗](https://github.com/cloudflare/containers-demos) [次へ  
制限とインスタンスタイプ](/containers/platform-details/limits/)

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
