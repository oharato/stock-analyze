Copy page

# イメージ管理

## `wrangler deploy`中のイメージのプッシュ

[](#pushing-images-during-wrangler-deploy)

`wrangler deploy`を実行するときに、[Wrangler設定](/workers/wrangler/configuration/#containers)の`image`属性をDockerfileへのパスに設定すると、WranglerはDockerを使用してローカルでコンテナイメージをビルドし、Cloudflareが実行するレジストリにプッシュします。このレジストリはCloudflareアカウントと統合されており、[R2](/r2/)によってバックアップされています。イメージのプッシュ時とプル時の両方で、すべての認証はCloudflareによって自動的に処理されます。

Dockerfileへのパスを指定するだけです：

*   [wrangler.jsonc](#tab-panel-1383)
*   [wrangler.toml](#tab-panel-1384)

```
{  "containers": {    "image": "./Dockerfile"    // ...設定の残り...  }}
```

```
[containers]image = "./Dockerfile"
```

そして、`wrangler deploy`でWorkerをデプロイします。その他のイメージ管理は必要ありません。

その後のデプロイでは、Wranglerは変更されたイメージレイヤーのみをプッシュするため、スペースと時間を節約できます。

注意

Wranglerがイメージをビルドしてプッシュするには、DockerまたはDocker互換のCLIツールが実行されている必要があります。以下で説明するように、事前にビルドされたイメージを使用している場合、これは必要ありません。

## 事前にビルドされたコンテナイメージの使用

[](#using-pre-built-container-images)

現在、`registry.cloudflare.com`のCloudflare管理レジストリと[Amazon ECR ↗](https://aws.amazon.com/ecr/)に保存されているイメージをサポートしています。追加の外部レジストリのサポートは近日公開予定です。

別のレジストリプロバイダーの事前にビルドされたイメージを使用する場合は、まずローカルに存在することを確認してから、Cloudflareレジストリにプッシュします：

```
docker pull <public-image>docker tag <public-image> <image>:<tag>
```

Wranglerは、Cloudflareレジストリにイメージをプッシュするコマンドを提供します：

*   [npm](#tab-panel-1374)
*   [yarn](#tab-panel-1375)
*   [pnpm](#tab-panel-1376)

ターミナルウィンドウ

```
npx wrangler containers push <image>:<tag>
```

ターミナルウィンドウ

```
yarn wrangler containers push <image>:<tag>
```

ターミナルウィンドウ

```
pnpm wrangler containers push <image>:<tag>
```

または、`wrangler containers build`で`-p`フラグを使用して、ワンステップでイメージをビルドしてプッシュすることもできます：

*   [npm](#tab-panel-1377)
*   [yarn](#tab-panel-1378)
*   [pnpm](#tab-panel-1379)

ターミナルウィンドウ

```
npx wrangler containers build -p -t <tag> .
```

ターミナルウィンドウ

```
yarn wrangler containers build -p -t <tag> .
```

ターミナルウィンドウ

```
pnpm wrangler containers build -p -t <tag> .
```

これにより、Wrangler設定で使用できるイメージレジストリURIが出力されます：

*   [wrangler.jsonc](#tab-panel-1385)
*   [wrangler.toml](#tab-panel-1386)

```
{  "containers": {    "image": "registry.cloudflare.com/your-account-id/your-image:tag"    // ...設定の残り...  }}
```

```
[containers]image = "registry.cloudflare.com/your-account-id/your-image:tag"
```

### Amazon ECRコンテナイメージの使用

[](#using-amazon-ecr-container-images)

[Amazon ECR ↗](https://aws.amazon.com/ecr/)に保存されているコンテナイメージを使用するには、ECRレジストリドメインに認証情報を設定する必要があります。これらの認証情報は、`containers`スコープの下の[Secrets Store](/secrets-store)に保存されます。コンテナを準備するとき、これらの認証情報を使用して、イメージをプルできる一時的なトークンを生成します。現在、パブリックECRイメージはサポートしていません。ECRに必要な認証情報を生成するには、読み取り専用ポリシーを持つIAMユーザーを作成する必要があります。次の例では、`us-east-1`のAWSアカウント`123456789012`の下にあるすべてのイメージリポジトリへのアクセスを許可します。

```
{  "Version": "2012-10-17",  "Statement": [    {      "Action": ["ecr:GetAuthorizationToken"],      "Effect": "Allow",      "Resource": "*"    },    {      "Effect": "Allow",      "Action": [        "ecr:BatchCheckLayerAvailability",        "ecr:GetDownloadUrlForLayer",        "ecr:BatchGetImage"      ],      // arn:${Partition}:ecr:${Region}:${Account}:repository/${Repository-name}      "Resource": [        "arn:aws:ecr:us-east-1:123456789012:repository/*"        // "arn:aws:ecr:us-east-1:123456789012:repository/example-repo"      ]    }  ]}
```

その後、IAMユーザーの認証情報を使用して、[Wranglerでレジストリを設定](/workers/wrangler/commands/#containers-registries)できます。Wranglerは、Secrets Storeストアがまだ存在しない場合は作成するように求め、その後シークレットを作成します。

*   [npm](#tab-panel-1380)
*   [yarn](#tab-panel-1381)
*   [pnpm](#tab-panel-1382)

ターミナルウィンドウ

```
npx wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

ターミナルウィンドウ

```
yarn wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

ターミナルウィンドウ

```
pnpm wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

これが設定されると、wrangler設定でECRイメージを使用できるようになります。

*   [wrangler.jsonc](#tab-panel-1387)
*   [wrangler.toml](#tab-panel-1388)

```
{  "containers": {    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/example-repo:tag"    // ...設定の残り...  }}
```

```
[containers]image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/example-repo:tag"
```

注意

現在、Cloudflare Viteプラグインは、`wrangler dev`とは異なり、ローカル開発でのレジストリリンクをサポートしていません。回避策として、`FROM <registry-link>`を使用する最小限のDockerfileを作成できます。ローカル開発でもポートを`EXPOSE`することを確認してください。

## CIを使用したイメージのプッシュ

[](#pushing-images-with-ci)

継続的インテグレーション環境でビルドされたイメージを使用するには、`wrangler`をインストールしてから、`--push`フラグを指定した`wrangler containers build`を使用するか、`wrangler containers push`コマンドを使用してイメージをビルドしてプッシュします。

## レジストリ制限

[](#registry-limits)

イメージのサイズは2 GBに制限されており、アカウントのレジストリの合計は50 GBに制限されています。

注意

これらの制限は将来増加する可能性があります。

`wrangler containers images delete`でイメージを削除してスペースを解放しますが、削除されたイメージを使用する以前のバージョンにWorkerを戻すとエラーになります。

## 役に立ちましたか？

[ページを編集](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/image-management.mdx)

最終更新日: 2025年11月14日

[前へ  
ロールアウト](/containers/platform-details/rollouts/) [次へ  
スケーリングとルーティング](/containers/platform-details/scaling-and-routing/)

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
