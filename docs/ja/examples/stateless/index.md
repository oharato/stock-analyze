Copy page

# ステートレスインスタンス

Cloudflareのネットワーク全体で複数のインスタンスを実行する

コンテナの複数のインスタンスの1つにリクエストを単純にプロキシするには、`getRandom`関数を使用できます：

TypeScript

```
import { Container, getRandom } from "@cloudflare/containers";
const INSTANCE_COUNT = 3;
class Backend extends Container {  defaultPort = 8080;  sleepAfter = "2h";}
export default {  async fetch(request: Request, env: Env): Promise<Response> {    // 注意: "getRandom"は近い将来、レイテンシを考慮したルーティングに置き換えられる予定です    const containerInstance = await getRandom(env.BACKEND, INSTANCE_COUNT);    return containerInstance.fetch(request);  },};
```

注意

この例では`getRandom`関数を使用しています。これは、リクエストをルーティングするためにN個のContainerインスタンスからランダムに1つを選択する一時的なヘルパーです。

将来的には、改善されたレイテンシを考慮したロードバランシングとオートスケーリングを提供する予定です。

これにより、ステートレスインスタンスのスケーリングが簡単になり、ルーティングがより効率的になります。詳細については、[オートスケーリングのドキュメント](/containers/platform-details/scaling-and-routing)を参照してください。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/stateless.mdx)

最終更新日: 2025年11月20日

[前へ  
例](/containers/examples/) [次へ  
静的フロントエンド、コンテナバックエンド](/containers/examples/container-backend/)

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
