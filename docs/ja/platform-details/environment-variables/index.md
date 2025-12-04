Copy page

# 環境変数

## ランタイム環境変数

[](#runtime-environment-variables)

コンテナランタイムは、次の変数を自動的に設定します：

*   `CLOUDFLARE_APPLICATION_ID` - ContainersアプリケーションのID
*   `CLOUDFLARE_COUNTRY_A2` - コンテナが配置されている国の[ISO 3166-1 Alpha 2コード ↗](https://www.iso.org/obp/ui/#search/code/)
*   `CLOUDFLARE_LOCATION` - コンテナが配置されている場所の名前
*   `CLOUDFLARE_REGION` - リージョン名
*   `CLOUDFLARE_DURABLE_OBJECT_ID` - コンテナがバインドされているDurable ObjectインスタンスのID。これを使用して、ダッシュボードで特定のコンテナインスタンスを識別できます。

## ユーザー定義の環境変数

[](#user-defined-environment-variables)

WorkerでContainerを定義するとき、またはコンテナインスタンスを起動するときに、環境変数を設定できます。

例：

JavaScript

```
class MyContainer extends Container {  defaultPort = 4000;  envVars = {    MY_CUSTOM_VAR: "value",    ANOTHER_VAR: "another_value",  };}
```

環境変数とシークレットの定義に関する詳細は、[この例](/containers/examples/env-vars-and-secrets)を参照してください。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/environment-variables.mdx)

最終更新日: 2025年9月22日

[前へ  
スケーリングとルーティング](/containers/platform-details/scaling-and-routing/) [次へ  
Durable Objectインターフェース ↗](/durable-objects/api/container/)

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
