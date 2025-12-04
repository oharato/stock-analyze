Copy page

# よくある質問

よくある質問：

## コンテナのログはどのように機能しますか？

[](#how-do-container-logs-work)

ダッシュボードでログ（ライブテーリングを含む）を取得するには、Workerのwrangler設定で`observability`をtrueに切り替えます：

*   [wrangler.jsonc](#tab-panel-697)
*   [wrangler.toml](#tab-panel-698)

```
{  "observability": {    "enabled": true  }}
```

```
[observability]enabled = true
```

ログは[Workerログと同じ制限](/workers/observability/logs/workers-logs/#limits)の対象となります。つまり、無料プランでは3日間、有料プランでは7日間保持されます。

コストの詳細については、[Workersログの価格](/workers/observability/logs/workers-logs/#pricing)を参照してください。

Enterpriseユーザーの場合は、[Logpush](/logs/logpush/)を介してコンテナログを希望の宛先にエクスポートできます。

## コンテナインスタンスの場所はどのように選択されますか？

[](#how-are-container-instance-locations-selected)

コンテナを最初にデプロイすると、Cloudflareはネットワーク全体のさまざまな場所を選択してインスタンスをデプロイします。これらの場所は複数のリージョンにまたがります。

`this.ctx.container.start`でコンテナインスタンスがリクエストされると、事前に初期化された場所から最も近い空きコンテナインスタンスが選択されます。これは外部リクエストと同じリージョンにある可能性が高いですが、そうでない場合もあります。コンテナインスタンスが実行されると、将来のリクエストはすべて最初の場所にルーティングされます。

例：

*   ユーザーがコンテナをデプロイします。Cloudflareはネットワーク全体でインスタンスを自動的に準備します。
*   アルゼンチンのバリローチェにいるクライアントからリクエストが行われます。リクエストは、アルゼンチンのネウケンにあるCloudflareの場所のWorkerに到達します。
*   このWorkerリクエストは`MY_CONTAINER.get("session-1337")`を呼び出し、Durable Objectを起動し、その後`this.ctx.container.start`を呼び出します。
*   これにより、最も近い空きコンテナインスタンスがリクエストされます。
*   Cloudflareは、アルゼンチンのブエノスアイレスでインスタンスが空いていることを認識し、そこで起動します。
*   別のユーザーが同じコンテナにルーティングする必要があります。このユーザーのリクエストは、サンディエゴにあるCloudflareの場所で実行されているWorkerに到達します。
*   Workerは再び`MY_CONTAINER.get("session-1337")`を呼び出します。
*   最初のコンテナインスタンスがまだ実行中の場合、リクエストはブエノスアイレスの場所にルーティングされます。最初のコンテナがスリープ状態になった場合、Cloudflareは再びコンテナの最も近い「空き」インスタンス（おそらく北米にあるもの）を見つけようとし、そこでインスタンスを起動します。

## コンテナの更新とロールアウトはどのように機能しますか？

[](#how-do-container-updates-and-rollouts-work)

詳細については、[ロールアウトドキュメント](/containers/platform-details/rollouts/)を参照してください。

## スケーリングはどのように機能しますか？

[](#how-does-scaling-work)

詳細については、[スケーリングとルーティングのドキュメント](/containers/platform-details/scaling-and-routing/)を参照してください。

## コールドスタートとは何ですか？どれくらい速いですか？

[](#what-are-cold-starts-how-fast-are-they)

コールドスタートとは、完全に停止した状態からコンテナインスタンスが起動されることです。

完全に新しいIDで`env.MY_CONTAINER.get(id)`を呼び出し、このインスタンスを初めて起動すると、コールドスタートが発生します。

これにより、コンテナイメージがエントリポイントから初めて起動されます。このエントリポイントが何をするかによって、起動にかかる時間は異なります。

コンテナのコールドスタートは多くの場合2〜3秒の範囲ですが、これはイメージサイズやコード実行時間などの要因によって異なります。

## 既存のコンテナイメージを使用するにはどうすればよいですか？

[](#how-do-i-use-an-existing-container-image)

詳細については、[イメージ管理ドキュメント](/containers/platform-details/image-management/#using-existing-images)を参照してください。

## ディスクは永続的ですか？コンテナがスリープするとディスクはどうなりますか？

[](#is-disk-persistent-what-happens-to-my-disk-when-my-container-sleeps)

すべてのディスクは一時的です。コンテナインスタンスがスリープ状態になると、次に起動されたときには、コンテナイメージで定義された新しいディスクが使用されます。

永続ディスクはCloudflareチームが将来検討しているものですが、近い将来の予定はありません。

## メモリ不足になるとどうなりますか？

[](#what-happens-if-i-run-out-of-memory)

メモリ不足になると、インスタンスはメモリ不足（OOM）エラーをスローし、再起動されます。

コンテナはスワップメモリを使用しません。

## インスタンスはどのくらい実行できますか？ホストサーバーがシャットダウンされるとどうなりますか？

[](#how-long-can-instances-run-for-what-happens-when-a-host-server-is-shutdown)

Cloudflareは、特定の時間が経過した後にコンテナインスタンスを積極的にシャットダウンすることはありません。Containerクラスで`sleepAfter`を設定しない場合、またはインスタンスを手動で停止しない場合、ホストサーバーが再起動されない限り実行され続けます。これは不定期に発生しますが、Cloudflareがいかなるインスタンスも一定期間実行されることを保証しない程度には頻繁に発生します。

コンテナインスタンスがシャットダウンされる場合、`SIGTERM`シグナルが送信され、15分後に`SIGKILL`シグナルが送信されます。この時間内に正常なシャットダウンを確実にするために必要なクリーンアップを実行する必要があります。コンテナインスタンスは、この直後に別の場所で再起動されます。

## コンテナにシークレットを渡すにはどうすればよいですか？

[](#how-can-i-pass-secrets-to-my-container)

[Worker Secrets](/workers/configuration/secrets/)または[Secrets Store](/secrets-store/integrations/workers/)を使用して、Workerのシークレットを定義できます。

その後、`envVars`プロパティを使用してこれらのシークレットをコンテナに渡すことができます：

JavaScript

```
class MyContainer extends Container {  defaultPort = 5000;  envVars = {    MY_SECRET: this.env.MY_SECRET,  };}
```

または、Durable Objectでコンテナインスタンスを起動するときに：

JavaScript

```
this.ctx.container.start({  env: {    MY_SECRET: this.env.MY_SECRET,  },});
```

詳細については、[環境変数とシークレットの例](/containers/examples/env-vars-and-secrets/)を参照してください。

## コンテナからの送信（egress）を許可または禁止するにはどうすればよいですか？

[](#how-do-i-allow-or-disallow-egress-from-my-container)

コンテナを起動するときに、`enableInternet`を指定してインターネットアクセスをオンまたはオフに切り替えることができます。

無効にするには、Containerクラスで設定します：

JavaScript

```
class MyContainer extends Container {  defaultPort = 7000;  enableInternet = false;}
```

または、Durable Objectでコンテナインスタンスを起動するときに：

JavaScript

```
this.ctx.container.start({  enableInternet: false,});
```

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/faq.mdx)

最終更新日: 2025年9月22日

[前へ  
ベータ情報とロードマップ](/containers/beta-info/) [次へ  
価格](/containers/pricing/)

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
