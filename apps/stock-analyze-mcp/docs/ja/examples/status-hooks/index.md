Copy page

# ステータスフック

コンテナのステータス変更に反応してWorkersコードを実行する

コンテナが起動、停止、エラーになると、`Container`クラスでステータスフックを定義したWorker内のコード実行をトリガーできます。詳細については、[Containerパッケージドキュメント ↗](https://github.com/cloudflare/containers/blob/main/README.md#lifecycle-hooks)を参照してください。

JavaScript

```
import { Container } from '@cloudflare/containers';
export class MyContainer extends Container {  defaultPort = 4000;  sleepAfter = '5m';
  override onStart() {    console.log('Container successfully started');  }
  override onStop(stopParams) {    if (stopParams.exitCode === 0) {      console.log('Container stopped gracefully');    } else {      console.log('Container stopped with exit code:', stopParams.exitCode);    }
    console.log('Container stop reason:', stopParams.reason);  }
  override onError(error: string) {    console.log('Container error:', error);  }}
```

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/status-hooks.mdx)

最終更新日: 2025年9月22日

[前へ  
Cronコンテナ](/containers/examples/cron/) [次へ  
環境変数とシークレット](/containers/examples/env-vars-and-secrets/)

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
