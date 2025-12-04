Copy page

# 制限とインスタンスタイプ

## インスタンスタイプ

[](#instance-types)

Containersのメモリ、vCPU、およびディスク容量は、事前定義されたインスタンスタイプを通じて設定されます。現在、6つのインスタンスタイプが利用可能です：

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

これらは、WorkerのWrangler設定ファイルの[`instance_type`プロパティ](/workers/wrangler/configuration/#containers)を使用して指定します。より大きなインスタンスをお探しですか？[こちらからフィードバックをお寄せください](/containers/beta-info/#feedback-wanted)。必要なインスタンスサイズと、その用途をお知らせください。

注意

`dev`および`standard`インスタンスタイプは下位互換性のために保持されており、それぞれ`lite`および`standard-1`のエイリアスです。

## 制限

[](#limits)

オープンベータ期間中、現在以下の制限が適用されています：

機能

Workers Paid

すべての同時実行ライブコンテナインスタンスのGiBメモリ

400GiB

すべての同時実行ライブコンテナインスタンスのvCPU

100

すべての同時実行ライブコンテナインスタンスのTBディスク

2TB

イメージサイズ

[インスタンスディスク容量](#instance-types)と同じ

アカウントごとの合計イメージストレージ

50 GB [1](#user-content-fn-1)

## 脚注

[](#footnote-label)

1.  `wrangler containers delete`でコンテナイメージを削除してスペースを解放します。コンテナイメージを削除してからWorkerを以前のバージョンに[ロールバック](/workers/configuration/versions-and-deployments/rollbacks/)すると、このバージョンは機能しなくなる可能性があることに注意してください。[↩](#user-content-fnref-1)
    

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/limits.mdx)

最終更新日: 2025年10月7日

[前へ  
コンテナのライフサイクル](/containers/platform-details/architecture/) [次へ  
ロールアウト](/containers/platform-details/rollouts/)

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
