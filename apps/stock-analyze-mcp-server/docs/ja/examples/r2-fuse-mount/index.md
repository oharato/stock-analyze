Copy page

# FUSEでR2バケットをマウントする

ContainersでFUSEを使用してR2バケットをファイルシステムとしてマウントする

FUSE (Filesystem in Userspace) を使用すると、[R2バケット](/r2/)をContainers内のファイルシステムとしてマウントできます。これにより、アプリケーションはオブジェクトストレージAPIではなく、標準のファイルシステム操作を使用してR2と対話できます。

一般的なユースケースは次のとおりです：

*   **アセットを使用したコンテナのブートストラップ** - サンドボックスやエージェント環境用のデータセット、モデル、または依存関係をマウントする
*   **ユーザー状態の永続化** - ダウンロードを管理することなく、ユーザー設定やアプリケーション状態を保存してアクセスする
*   **大きな静的ファイル** - コンテナイメージの肥大化や起動時のファイルダウンロードを回避する
*   **ファイルの編集** - コンテナ内でコードや設定を利用可能にし、インスタンス間で編集を保存する

パフォーマンスに関する考慮事項

オブジェクトストレージはPOSIX互換ファイルシステムではなく、ローカルストレージでもありません。FUSEマウントは使い慣れたインターフェースを提供しますが、ネイティブSSDのようなパフォーマンスは期待しないでください。

このトレードオフが許容される一般的なユースケースには、共有アセットの読み取り、初期データを使用した[エージェント](/agents/)または[サンドボックス](/sandbox/)のブートストラップ、ユーザー状態の永続化、ファイルシステムAPIを必要とするが高性能I/Oを必要としないアプリケーションなどがあります。

## バケットのマウント

[](#mounting-buckets)

R2バケットをマウントするには、DockerfileにFUSEアダプターをインストールし、コンテナ起動時に実行するように設定します。

この例では、R2を含むS3互換ストレージをサポートする[tigrisfs ↗](https://github.com/tigrisdata/tigrisfs)を使用します：

Dockerfile

```
FROM alpine:3.20
# FUSEと依存関係をインストールRUN apk update && \    apk add --no-cache ca-certificates fuse curl bash
# tigrisfsをインストールRUN ARCH=$(uname -m) && \    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; fi && \    if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \    VERSION=$(curl -s https://api.github.com/repos/tigrisdata/tigrisfs/releases/latest | grep -o '"tag_name": "[^"]*' | cut -d'"' -f4) && \    curl -L "https://github.com/tigrisdata/tigrisfs/releases/download/${VERSION}/tigrisfs_${VERSION#v}_linux_${ARCH}.tar.gz" -o /tmp/tigrisfs.tar.gz && \    tar -xzf /tmp/tigrisfs.tar.gz -C /usr/local/bin/ && \    rm /tmp/tigrisfs.tar.gz && \    chmod +x /usr/local/bin/tigrisfs
# バケットをマウントしてコマンドを実行する起動スクリプトを作成RUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    echo "Mounting bucket ${BUCKET_NAME}..."\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    echo "Contents of mounted bucket:"\n\    ls -lah /mnt/r2\n\    ' > /startup.sh && chmod +x /startup.sh
CMD ["/startup.sh"]
```

起動スクリプトはマウントポイントを作成し、バックグラウンドでtigrisfsを起動してバケットをマウントし、マウントされたディレクトリの内容を一覧表示します。

### コンテナへの認証情報の受け渡し

[](#passing-credentials-to-the-container)

コンテナには、環境変数として渡される[R2認証情報](/r2/api/tokens/)と設定が必要です。認証情報を[Worker secrets](/workers/configuration/secrets/)として保存し、`envVars`プロパティを通じて渡します：

*   [JavaScript](#tab-panel-1333)
*   [TypeScript](#tab-panel-1334)

src/index.js

```
import { Container, getContainer } from "@cloudflare/containers";
export class FUSEDemo extends Container {  defaultPort = 8080;  sleepAfter = "10m";  envVars = {    AWS_ACCESS_KEY_ID: this.env.AWS_ACCESS_KEY_ID,    AWS_SECRET_ACCESS_KEY: this.env.AWS_SECRET_ACCESS_KEY,    BUCKET_NAME: this.env.R2_BUCKET_NAME,    R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,  };}
```

src/index.ts

```
import { Container, getContainer } from "@cloudflare/containers";
interface Env {  FUSEDemo: DurableObjectNamespace<FUSEDemo>;  AWS_ACCESS_KEY_ID: string;  AWS_SECRET_ACCESS_KEY: string;  R2_BUCKET_NAME: string;  R2_ACCOUNT_ID: string;}
export class FUSEDemo extends Container<Env> {  defaultPort = 8080;  sleepAfter = "10m";  envVars = {    AWS_ACCESS_KEY_ID: this.env.AWS_ACCESS_KEY_ID,    AWS_SECRET_ACCESS_KEY: this.env.AWS_SECRET_ACCESS_KEY,    BUCKET_NAME: this.env.R2_BUCKET_NAME,    R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,  };}
```

`AWS_ACCESS_KEY_ID`と`AWS_SECRET_ACCESS_KEY`はシークレットとして保存する必要がありますが、`R2_BUCKET_NAME`と`R2_ACCOUNT_ID`は`wrangler.jsonc`で変数として設定できます：

```
{  "vars": {    "R2_BUCKET_NAME": "my-bucket",    "R2_ACCOUNT_ID": "your-account-id"  }}
```

### その他のS3互換ストレージプロバイダー

[](#other-s3-compatible-storage-providers)

AWS S3やGoogle Cloud Storageを含む他のS3互換ストレージプロバイダーも、R2と同じアプローチを使用してマウントできます。ストレージプロバイダーの適切なエンドポイントURLとアクセス認証情報を提供する必要があります。

## バケットプレフィックスのマウント

[](#mounting-bucket-prefixes)

バケット内の特定のプレフィックス（サブディレクトリ）をマウントするには、ほとんどのFUSEアダプターでバケット全体をマウントしてから、マウント内のプレフィックスパスにアクセスする必要があります。

tigrisfsを使用すると、バケットをマウントし、ファイルシステムパスを介してプレフィックスにアクセスできます：

```
RUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    echo "Accessing prefix: ${BUCKET_PREFIX}"\n\    ls -lah "/mnt/r2/${BUCKET_PREFIX}"\n\    ' > /startup.sh && chmod +x /startup.sh
```

アプリケーションは`/mnt/r2/${BUCKET_PREFIX}`から読み取ることで、そのプレフィックス以下のファイルのみにアクセスできます。他のR2設定と一緒に`BUCKET_PREFIX`を環境変数として渡します。

## 読み取り専用としてのバケットのマウント

[](#mounting-buckets-as-read-only)

アプリケーションがマウントされたバケットに書き込むのを防ぐには、`-o ro`フラグを追加してファイルシステムを読み取り専用としてマウントします：

```
RUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -o ro -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    ls -lah /mnt/r2\n\    ' > /startup.sh && chmod +x /startup.sh
```

これは、アプリケーションがデータを読み取るだけであることを保証したい共有アセットや設定ファイルに役立ちます。

## 関連リソース

[](#related-resources)

*   [コンテナ環境変数](/containers/examples/env-vars-and-secrets/) - シークレットと変数をコンテナに渡す方法を学びます
*   [tigrisfs ↗](https://github.com/tigrisdata/tigrisfs) - R2を含むS3互換ストレージ用FUSEアダプター
*   [s3fs ↗](https://github.com/s3fs-fuse/s3fs-fuse) - S3互換ストレージ用代替FUSEアダプター
*   [gcsfuse ↗](https://github.com/GoogleCloudPlatform/gcsfuse) - Google Cloud Storageバケット用FUSEアダプター

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/r2-fuse-mount.mdx)

最終更新日: 2025年11月25日

[前へ  
コンテナへのWebsocket](/containers/examples/websocket/) [次へ  
Durable Objectsを直接使用する ↗](https://github.com/cloudflare/containers-demos)

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
