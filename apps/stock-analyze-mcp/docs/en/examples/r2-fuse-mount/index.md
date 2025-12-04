Copy page

# Mount R2 buckets with FUSE

Mount R2 buckets as filesystems using FUSE in Containers

FUSE (Filesystem in Userspace) allows you to mount [R2 buckets](/r2/) as filesystems within Containers. Applications can then interact with R2 using standard filesystem operations rather than object storage APIs.

Common use cases include:

*   **Bootstrapping containers with assets** - Mount datasets, models, or dependencies for sandboxes and agent environments
*   **Persisting user state** - Store and access user configuration or application state without managing downloads
*   **Large static files** - Avoid bloating container images or downloading files at startup
*   **Editing files** - Make code or config available within the container and save edits across instances.

Performance considerations

Object storage is not a POSIX-compatible filesystem, nor is it local storage. While FUSE mounts provide a familiar interface, you should not expect native SSD-like performance.

Common use cases where this tradeoff is acceptable include reading shared assets, bootstrapping [agents](/agents/) or [sandboxes](/sandbox/) with initial data, persisting user state, and applications that require filesystem APIs but don't need high-performance I/O.

## Mounting buckets

[](#mounting-buckets)

To mount an R2 bucket, install a FUSE adapter in your Dockerfile and configure it to run at container startup.

This example uses [tigrisfs ↗](https://github.com/tigrisdata/tigrisfs), which supports S3-compatible storage including R2:

Dockerfile

```
FROM alpine:3.20
# Install FUSE and dependenciesRUN apk update && \    apk add --no-cache ca-certificates fuse curl bash
# Install tigrisfsRUN ARCH=$(uname -m) && \    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; fi && \    if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \    VERSION=$(curl -s https://api.github.com/repos/tigrisdata/tigrisfs/releases/latest | grep -o '"tag_name": "[^"]*' | cut -d'"' -f4) && \    curl -L "https://github.com/tigrisdata/tigrisfs/releases/download/${VERSION}/tigrisfs_${VERSION#v}_linux_${ARCH}.tar.gz" -o /tmp/tigrisfs.tar.gz && \    tar -xzf /tmp/tigrisfs.tar.gz -C /usr/local/bin/ && \    rm /tmp/tigrisfs.tar.gz && \    chmod +x /usr/local/bin/tigrisfs
# Create startup script that mounts bucket and runs a commandRUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    echo "Mounting bucket ${BUCKET_NAME}..."\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    echo "Contents of mounted bucket:"\n\    ls -lah /mnt/r2\n\    ' > /startup.sh && chmod +x /startup.sh
CMD ["/startup.sh"]
```

The startup script creates a mount point, starts tigrisfs in the background to mount the bucket, and then lists the mounted directory contents.

### Passing credentials to the container

[](#passing-credentials-to-the-container)

Your Container needs [R2 credentials](/r2/api/tokens/) and configuration passed as environment variables. Store credentials as [Worker secrets](/workers/configuration/secrets/), then pass them through the `envVars` property:

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

The `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` should be stored as secrets, while `R2_BUCKET_NAME` and `R2_ACCOUNT_ID` can be configured as variables in your `wrangler.jsonc`:

```
{  "vars": {    "R2_BUCKET_NAME": "my-bucket",    "R2_ACCOUNT_ID": "your-account-id"  }}
```

### Other S3-compatible storage providers

[](#other-s3-compatible-storage-providers)

Other S3-compatible storage providers, including AWS S3 and Google Cloud Storage, can be mounted using the same approach as R2. You will need to provide the appropriate endpoint URL and access credentials for the storage provider.

## Mounting bucket prefixes

[](#mounting-bucket-prefixes)

To mount a specific prefix (subdirectory) within a bucket, most FUSE adapters require mounting the entire bucket and then accessing the prefix path within the mount.

With tigrisfs, mount the bucket and access the prefix via the filesystem path:

```
RUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    echo "Accessing prefix: ${BUCKET_PREFIX}"\n\    ls -lah "/mnt/r2/${BUCKET_PREFIX}"\n\    ' > /startup.sh && chmod +x /startup.sh
```

Your application can then read from `/mnt/r2/${BUCKET_PREFIX}` to access only the files under that prefix. Pass `BUCKET_PREFIX` as an environment variable alongside your other R2 configuration.

## Mounting buckets as read-only

[](#mounting-buckets-as-read-only)

To prevent applications from writing to the mounted bucket, add the `-o ro` flag to mount the filesystem as read-only:

```
RUN printf '#!/bin/sh\n\    set -e\n\    \n\    mkdir -p /mnt/r2\n\    \n\    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"\n\    /usr/local/bin/tigrisfs --endpoint "${R2_ENDPOINT}" -o ro -f "${BUCKET_NAME}" /mnt/r2 &\n\    sleep 3\n\    \n\    ls -lah /mnt/r2\n\    ' > /startup.sh && chmod +x /startup.sh
```

This is useful for shared assets or configuration files where you want to ensure applications only read data.

## Related resources

[](#related-resources)

*   [Container environment variables](/containers/examples/env-vars-and-secrets/) - Learn how to pass secrets and variables to Containers
*   [tigrisfs ↗](https://github.com/tigrisdata/tigrisfs) - FUSE adapter for S3-compatible storage including R2
*   [s3fs ↗](https://github.com/s3fs-fuse/s3fs-fuse) - Alternative FUSE adapter for S3-compatible storage
*   [gcsfuse ↗](https://github.com/GoogleCloudPlatform/gcsfuse) - FUSE adapter for Google Cloud Storage buckets

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/r2-fuse-mount.mdx)

Last updated: Nov 25, 2025

[Previous  
Websocket to Container](/containers/examples/websocket/) [Next  
Using Durable Objects Directly ↗](https://github.com/cloudflare/containers-demos)

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