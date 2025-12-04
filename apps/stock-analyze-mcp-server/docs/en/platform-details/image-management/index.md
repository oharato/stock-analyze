Copy page

# Image Management

## Pushing images during `wrangler deploy`

[](#pushing-images-during-wrangler-deploy)

When running `wrangler deploy`, if you set the `image` attribute in your [Wrangler configuration](/workers/wrangler/configuration/#containers) to a path to a Dockerfile, Wrangler will build your container image locally using Docker, then push it to a registry run by Cloudflare. This registry is integrated with your Cloudflare account and is backed by [R2](/r2/). All authentication is handled automatically by Cloudflare both when pushing and pulling images.

Just provide the path to your Dockerfile:

*   [wrangler.jsonc](#tab-panel-1383)
*   [wrangler.toml](#tab-panel-1384)

```
{  "containers": {    "image": "./Dockerfile"    // ...rest of config...  }}
```

```
[containers]image = "./Dockerfile"
```

And deploy your Worker with `wrangler deploy`. No other image management is necessary.

On subsequent deploys, Wrangler will only push image layers that have changed, which saves space and time.

Note

Docker or a Docker-compatible CLI tool must be running for Wrangler to build and push images. This is not necessary if you are using a pre-built image, as described below.

## Using pre-built container images

[](#using-pre-built-container-images)

Currently, we support images stored in the Cloudflare managed registry at `registry.cloudflare.com` and in [Amazon ECR ↗](https://aws.amazon.com/ecr/). Support for additional external registries is coming soon.

If you wish to use a pre-built image from another registry provider, first, make sure it exists locally, then push it to the Cloudflare Registry:

```
docker pull <public-image>docker tag <public-image> <image>:<tag>
```

Wrangler provides a command to push images to the Cloudflare Registry:

*   [npm](#tab-panel-1374)
*   [yarn](#tab-panel-1375)
*   [pnpm](#tab-panel-1376)

Terminal window

```
npx wrangler containers push <image>:<tag>
```

Terminal window

```
yarn wrangler containers push <image>:<tag>
```

Terminal window

```
pnpm wrangler containers push <image>:<tag>
```

Or, you can use the `-p` flag with `wrangler containers build` to build and push an image in one step:

*   [npm](#tab-panel-1377)
*   [yarn](#tab-panel-1378)
*   [pnpm](#tab-panel-1379)

Terminal window

```
npx wrangler containers build -p -t <tag> .
```

Terminal window

```
yarn wrangler containers build -p -t <tag> .
```

Terminal window

```
pnpm wrangler containers build -p -t <tag> .
```

This will output an image registry URI that you can then use in your Wrangler configuration:

*   [wrangler.jsonc](#tab-panel-1385)
*   [wrangler.toml](#tab-panel-1386)

```
{  "containers": {    "image": "registry.cloudflare.com/your-account-id/your-image:tag"    // ...rest of config...  }}
```

```
[containers]image = "registry.cloudflare.com/your-account-id/your-image:tag"
```

### Using Amazon ECR container images

[](#using-amazon-ecr-container-images)

To use container images stored in [Amazon ECR ↗](https://aws.amazon.com/ecr/), you will need to configure the ECR registry domain with credentials. These credentials get stored in [Secrets Store](/secrets-store) under the `containers` scope. When we prepare your container, these credentials will be used to generate an ephemeral token that can pull your image. We do not currently support public ECR images. To generate the necessary credentials for ECR, you will need to create an IAM user with a read-only policy. The following example grants access to all image repositories under AWS account `123456789012` in `us-east-1`.

```
{  "Version": "2012-10-17",  "Statement": [    {      "Action": ["ecr:GetAuthorizationToken"],      "Effect": "Allow",      "Resource": "*"    },    {      "Effect": "Allow",      "Action": [        "ecr:BatchCheckLayerAvailability",        "ecr:GetDownloadUrlForLayer",        "ecr:BatchGetImage"      ],      // arn:${Partition}:ecr:${Region}:${Account}:repository/${Repository-name}      "Resource": [        "arn:aws:ecr:us-east-1:123456789012:repository/*"        // "arn:aws:ecr:us-east-1:123456789012:repository/example-repo"      ]    }  ]}
```

You can then use the credentials for the IAM User to [configure a registry in Wrangler](/workers/wrangler/commands/#containers-registries). Wrangler will prompt you to create a Secrets Store store if one does not already exist, and then create your secret.

*   [npm](#tab-panel-1380)
*   [yarn](#tab-panel-1381)
*   [pnpm](#tab-panel-1382)

Terminal window

```
npx wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

Terminal window

```
yarn wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

Terminal window

```
pnpm wrangler containers registries configure 123456789012.dkr.ecr.us-east-1.amazonaws.com --aws-access-key-id=AKIAIOSFODNN7EXAMPLE
```

Once this is setup, you will be able to use ECR images in your wrangler config.

*   [wrangler.jsonc](#tab-panel-1387)
*   [wrangler.toml](#tab-panel-1388)

```
{  "containers": {    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/example-repo:tag"    // ...rest of config...  }}
```

```
[containers]image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/example-repo:tag"
```

Note

Currently, the Cloudflare Vite-plugin does not support registry links in local development, unlike `wrangler dev`. As a workaround, you can create a minimal Dockerfile that uses `FROM <registry-link>`. Make sure to `EXPOSE` a port in local dev as well.

## Pushing images with CI

[](#pushing-images-with-ci)

To use an image built in a continuous integration environment, install `wrangler` then build and push images using either `wrangler containers build` with the `--push` flag, or using the `wrangler containers push` command.

## Registry Limits

[](#registry-limits)

Images are limited to 2 GB in size and you are limited to 50 total GB in your account's registry.

Note

These limits will likely increase in the future.

Delete images with `wrangler containers images delete` to free up space, but reverting a Worker to a previous version that uses a deleted image will then error.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/image-management.mdx)

Last updated: Nov 14, 2025

[Previous  
Rollouts](/containers/platform-details/rollouts/) [Next  
Scaling and Routing](/containers/platform-details/scaling-and-routing/)

*   **Resources**
*   [API](/api/)
*   [New to Cloudflare?](/fundamentals/)
*   [Directory](/directory/)
*   [Sponsorships](/sponsorships/)
*   [Open Source](https://github.com/cloudflare)

*   **Support**
*   [Help Center](https://support.cloudflare.com/)
*   [System Status](https://www.cloudflarestatus.com/)
*   [Compliance](https://www.cloudflare.com/trust-hub/compliance-resources/)
*   [GDPR](https://www.cloudflare.com/trust-hub/gdpr/)

*   **Company**
*   [cloudflare.com](https://www.cloudflare.com/)
*   [Our team](https://www.cloudflare.com/people/)
*   [Careers](https://www.cloudflare.com/careers/)

*   **Tools**
*   [Cloudflare Radar](https://radar.cloudflare.com/)
*   [Speed Test](https://speed.cloudflare.com/)
*   [Is BGP Safe Yet?](https://isbgpsafeyet.com/)
*   [RPKI Toolkit](https://rpki.cloudflare.com/)
*   [Certificate Transparency](https://ct.cloudflare.com/)

*   **Community**
*   [X](https://x.com/cloudflare)
*   [Discord](http://discord.cloudflare.com/)
*   [YouTube](https://www.youtube.com/cloudflare)
*   [GitHub](https://github.com/cloudflare/cloudflare-docs)

*   © 2025 Cloudflare, Inc.
*   [Privacy Policy](https://www.cloudflare.com/privacypolicy/)
*   [Terms of Use](https://www.cloudflare.com/website-terms/)
*   [Report Security Issues](https://www.cloudflare.com/disclosure/)
*   [Trademark](https://www.cloudflare.com/trademark/)
*   ![privacy options](/_astro/privacyoptions.BWXSiJOZ_22PXh4.svg) Cookie Settings