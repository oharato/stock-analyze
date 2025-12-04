Copy page

# ベータ版情報とロードマップ

現在、Containersはベータ版です。GA（一般提供）に先立ち、いくつかの変更を予定しています：

## 今後の変更と既知のギャップ

[](#upcoming-changes-and-known-gaps)

### 制限

[](#limits)

コンテナの制限は将来的に引き上げられる予定です。最大インスタンスサイズとアカウント内の最大インスタンス数の両方を増やす予定です。

詳細については、[制限のドキュメント](/containers/platform-details/#limits)を参照してください。

### オートスケーリングとロードバランシング

[](#autoscaling-and-load-balancing)

現在、Containersはオートスケーリングやロードバランシングされません。コンテナは、一意のIDでバインディングの`get()`を呼び出すことで手動でスケーリングできます。

将来的には、使用率ベースのオートスケーリングとレイテンシを考慮したロードバランシングの公式サポートを追加する予定です。

詳細については、[オートスケーリングのドキュメント](/containers/platform-details/scaling-and-routing)を参照してください。

### ログノイズの削減

[](#reduction-of-log-noise)

現在、`Container`クラスはDurable Objectのアラームを使用してコンテナのシャットダウンを管理しています。これにより、Workerログに不要なログノイズが発生します。ダッシュボードでクエリを追加してこれらのログを除外することはできますが、理想的ではありません。

将来的には、ログノイズを自動的に削減する予定です。

### ダッシュボードの更新

[](#dashboard-updates)

ダッシュボードは以下を表示するように更新されます：

*   Workersから関連するContainersへのリンク

### Durable ObjectsとContainersのコロケーション

[](#co-locating-durable-objects-and-containers)

現在、Durable Objectsは関連するContainerとコロケーション（同じ場所に配置）されていません。コンテナをリクエストすると、Durable Objectは近くにあるコンテナを見つけますが、同じマシン上ではありません。

将来的には、Durable ObjectsをContainerとコロケーションする予定です。

### より高度なコンテナ配置

[](#more-advanced-container-placement)

現在、迅速な起動時間を確保するために、グローバルネットワーク全体のサーバーでコンテナイメージをプリウォーム（事前準備）しています。新しいコンテナをリクエストしたときに、エンドユーザーから望ましい距離よりも遠い場所で起動される場合があります。このプロセスを最適化して、このようなことが可能な限り起こらないようにしていますが、それでも発生する可能性があります。

### WorkersとContainers間のアトミックなコード更新

[](#atomic-code-updates-across-workers-and-containers)

`wrangler deploy`でContainerをデプロイすると、Workerコードは即座に更新されますが、Containerコードはローリングデプロイを使用してゆっくりと更新されます。

つまり、Workerコードが古いContainerコードと下位互換性があることを確認する必要があります。

将来的には、Durable Object内のWorkerコードは、関連するContainerコードが更新されたときにのみ更新されるようになります。

## フィードバック募集

[](#feedback-wanted)

ユーザーからのフィードバックを収集したい分野がいくつかあります：

*   Containersを他のCloudflareサービスと統合したいですか？もしそうなら、どのサービスとどのように統合したいですか？
*   Workersを介してContainerと対話する他の方法が必要ですか？もしそうなら、どのように？
*   コンテナへのリクエストをルーティングするための異なるメカニズムが必要ですか？
*   コンテナをスケーリングするための異なるメカニズムが必要ですか？（オートスケーリング計画については[スケーリングのドキュメント](/containers/platform-details/scaling-and-routing)を参照してください）

ベータ期間中はいつでも、[このフォームを使用してフィードバックをお寄せください ↗](https://forms.gle/CscdaEGuw5Hb6H2s7)。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/beta-info.mdx)

最終更新日: 2025年9月22日

[前へ  
Wranglerコマンド ↗](/workers/wrangler/commands/#containers) [次へ  
よくある質問](/containers/faq/)

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
