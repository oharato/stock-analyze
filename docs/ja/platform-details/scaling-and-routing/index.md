Copy page

# スケーリングとルーティング

### `get()`を使用したコンテナインスタンスのスケーリング

[](#scaling-container-instances-with-get)

注意

このセクションでは、[Containerパッケージ](/containers/container-package)のヘルパーを使用します。

現在、Containersは、一意のIDを持つコンテナを取得してからコンテナを起動することによってのみ手動でスケーリングされます。コンテナを取得しても自動的に起動しないことに注意してください。

TypeScript

```
// 2つのコンテナインスタンスを取得して起動するconst containerOne = getContainer(  env.MY_CONTAINER,  idOne,).startAndWaitForPorts();
const containerTwo = getContainer(  env.MY_CONTAINER,  idTwo,).startAndWaitForPorts();
```

各インスタンスは、`sleepAfter`時間が経過するか、手動で停止されるまで実行されます。

この動作は、コンテナインスタンスのライフサイクルを明示的に制御したい場合に非常に役立ちます。たとえば、特定のユーザー用にコンテナバックエンドインスタンスをスピンアップしたり、AI生成コードを分離するためにコードサンドボックスを一時的に実行したり、短命のバッチジョブを実行したりする場合などです。

#### `getRandom`ヘルパー関数

[](#the-getrandom-helper-function)

ただし、コンテナの複数のインスタンスを実行し、リクエストを簡単にルーティングしたい場合があります。

現在、これを実現する最良の方法は、_一時的な_`getRandom`ヘルパー関数を使用することです：

JavaScript

```
import { Container, getRandom } from "@cloudflare/containers";
const INSTANCE_COUNT = 3;
class Backend extends Container {  defaultPort = 8080;  sleepAfter = "2h";}
export default {  async fetch(request: Request, env: Env): Promise<Response> {    // 注意: "getRandom"は近い将来、レイテンシを考慮したルーティングに置き換えられる予定です    const containerInstance = getRandom(env.BACKEND, INSTANCE_COUNT)    return containerInstance.fetch(request);  },};
```

複数のステートレスコンテナインスタンスにルーティングするための一時的なソリューションとして、getRandom関数を提供しました。これは、リクエストごとにN個のインスタンスの1つをランダムに選択してルーティングします。残念ながら、これには2つの大きな欠点があります：

*   ユーザーがルーティングするインスタンスの固定数を設定する必要があります。
*   場所に関係なく、各インスタンスをランダムに選択します。

近い将来、組み込みのオートスケーリングとルーティング機能でこれらの問題を修正する予定です。

### オートスケーリングとルーティング（未リリース）

[](#autoscaling-and-routing-unreleased)

注意

これは未リリースの機能です。変更される可能性があります。

Containerクラスで`autoscale`プロパティをオンに設定することで、Containerのオートスケーリングをオンにできるようになります：

JavaScript

```
class MyBackend extends Container {  autoscale = true;  defaultPort = 8080;}
```

これにより、プラットフォームは着信トラフィックとリソース使用量（メモリ、CPU）に基づいてインスタンスを自動的にスケーリングするように指示されます。

コンテナインスタンスはローカルトラフィックを処理するために自動的に起動され、不要になると停止されます。

リクエストを正しいインスタンスにルーティングするには、`getContainer()`ヘルパー関数を使用してコンテナインスタンスを取得し、リクエストを渡します：

JavaScript

```
export default {  async fetch(request, env) {    return getContainer(env.MY_BACKEND).fetch(request);  },};
```

これにより、トラフィックはコンテナの最も近い準備完了インスタンスに送信されます。コンテナが過負荷になっているか、まだ起動していない場合、リクエストはより遠くにある可能性のあるコンテナにルーティングされます。コンテナの準備状況はリソース使用量に基づいて自動的に決定できますが、カスタム準備状況チェックでも設定可能になります。

オートスケーリングとレイテンシを考慮したルーティングは近い将来利用可能になり、リリース時に詳細に文書化されます。それまでは、`getRandom`ヘルパー関数を使用してリクエストを複数のコンテナインスタンスにルーティングできます。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/scaling-and-routing.mdx)

最終更新日: 2025年9月22日

[前へ  
イメージ管理](/containers/platform-details/image-management/) [次へ  
環境変数](/containers/platform-details/environment-variables/)

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
