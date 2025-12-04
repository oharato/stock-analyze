Copy page

# コンテナへのWebsocket

Websocketリクエストをコンテナに転送する

WebSocketリクエストは、`Container`クラスのデフォルトの`fetch`メソッドを使用して自動的にコンテナに転送されます：

JavaScript

```
import { Container, getContainer } from "@cloudflare/containers";
export class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = "2m";}
export default {  async fetch(request, env) {    // デフォルトインスタンスを取得し、Worker外部からのWebsocketを転送する    return getContainer(env.MY_CONTAINER).fetch(request);  },};
```

完全な例は、[Containerクラスリポジトリ ↗](https://github.com/cloudflare/containers/tree/main/examples/websocket)でご覧ください。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/websocket.mdx)

最終更新日: 2025年9月22日

[前へ  
環境変数とシークレット](/containers/examples/env-vars-and-secrets/) [次へ  
FUSEでR2バケットをマウントする](/containers/examples/r2-fuse-mount/)

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
