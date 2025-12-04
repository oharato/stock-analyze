Copy page

# 価格

## vCPU、メモリ、ディスク

[](#vcpu-memory-and-disk)

Containersは、アクティブに実行されている10ミリ秒ごとに以下の料金で請求されます。月額5米ドルの[Workers Paidプラン](/workers/platform/pricing/)の一部として毎月の使用量が含まれています：

メモリ

CPU

ディスク

**無料**

N/A

N/A

N/A

**Workers Paid**

25 GiB-時間/月 込み  
+追加GiB-秒あたり$0.0000025

375 vCPU-分/月  
\+ 追加vCPU-秒あたり$0.000020

200 GB-時間/月  
+追加GB-秒あたり$0.00000007

使用した分だけ支払います — 請求はリクエストがコンテナに送信されたとき、または手動で開始されたときに開始されます。コンテナインスタンスがスリープ状態になると請求は停止します。これはタイムアウト後に自動的に発生する可能性があります。これにより、ゼロへのスケーリングが容易になり、バーストトラフィックでも高い使用率を得ることができます。

メモリとディスクの使用量は、選択したインスタンスタイプの_プロビジョニングされたリソース_に基づいていますが、CPU使用量は_アクティブな使用量_のみに基づいています。

#### インスタンスタイプ

[](#instance-types)

コンテナをデプロイするときに、[インスタンスタイプ](/containers/platform-details/#instance-types)を指定します。

選択したインスタンスタイプは請求額に影響します — より大きなインスタンスにはより多くのメモリとディスクが含まれ、追加コストが発生し、CPU容量が高くなるため、アクティブな使用量に基づいてより高いCPUコストが発生する可能性があります。

現在、以下のインスタンスタイプが利用可能です：

インスタンスタイプ

vCPU

メモリ

ディスク

lite

1/16

256 MiB

2 GB

basic

1/4

1 GiB

4 GB

standard-1

1/2

4 GiB

8 GB

standard-2

1

6 GiB

12 GB

standard-3

2

8 GiB

16 GB

standard-4

4

12 GiB

20 GB

## ネットワーク送信（Egress）

[](#network-egress)

Containersからの送信（Egress）は、以下の料金で価格設定されています：

リージョン

GBあたりの価格

月間含まれる割り当て

北米 & ヨーロッパ

$0.025

1 TB

オセアニア、韓国、台湾

$0.05

500 GB

その他すべて

$0.04

500 GB

## WorkersとDurable Objectsの価格

[](#workers-and-durable-objects-pricing)

Containersを使用する場合、コンテナへの着信リクエストは[Worker](/workers/platform/pricing/)によって処理され、各コンテナには独自の[Durable Object](/durable-objects/platform/pricing/)があります。WorkersとDurable Objectsの両方の使用に対して請求されます。

## ログと可観測性

[](#logs-and-observability)

Containersは[Workers Logs](/workers/observability/logs/workers-logs/)プラットフォームと統合されており、同じレートで請求されます。詳細については、[Workers Logsの価格](/workers/observability/logs/workers-logs/#pricing)を参照してください。

コンテナへのバインディングを使用して[Workerの可観測性を有効にする](/workers/observability/logs/workers-logs/#enable-workers-logs)と、コンテナからのログはCloudflareダッシュボードのContainersセクションとObservabilityセクションの両方に表示されます。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/pricing.mdx)

最終更新日: 2025年11月21日

[前へ  
よくある質問](/containers/faq/) [次へ  
llms.txt](/llms.txt)

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
