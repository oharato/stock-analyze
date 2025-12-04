Copy page

# Cron Container

Running a container on a schedule using Cron Triggers

To launch a container on a schedule, you can use a Workers [Cron Trigger](/workers/configuration/cron-triggers/).

For a full example, see the [Cron Container Template ↗](https://github.com/mikenomitch/cron-container/tree/main).

Use a cron expression in your Wrangler config to specify the schedule:

*   [wrangler.jsonc](#tab-panel-1331)
*   [wrangler.toml](#tab-panel-1332)

```
{  "name": "cron-container",  "main": "src/index.ts",  "triggers": {    "crons": [      "*/2 * * * *" // Run every 2 minutes    ]  },  "containers": [    {      "class_name": "CronContainer",      "image": "./Dockerfile"    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "CronContainer",        "name": "CRON_CONTAINER"      }    ]  },  "migrations": [    {      "new_sqlite_classes": ["CronContainer"],      "tag": "v1"    }  ]}
```

```
name = "cron-container"main = "src/index.ts"
[triggers]crons = [ "*/2 * * * *" ]
[[containers]]class_name = "CronContainer"image = "./Dockerfile"
[[durable_objects.bindings]]class_name = "CronContainer"name = "CRON_CONTAINER"
[[migrations]]new_sqlite_classes = [ "CronContainer" ]tag = "v1"
```

Then in your Worker, call your Container from the "scheduled" handler:

TypeScript

```
import { Container, getContainer } from '@cloudflare/containers';
export class CronContainer extends Container {  sleepAfter = '10s';
  override onStart() {    console.log('Starting container');  }
  override onStop() {    console.log('Container stopped');  }}
export default {  async fetch(): Promise<Response> {    return new Response("This Worker runs a cron job to execute a container on a schedule.");  },
  async scheduled(_controller: any, env: { CRON_CONTAINER: DurableObjectNamespace<CronContainer> }) {    let container = getContainer(env.CRON_CONTAINER);    await container.start({      envVars: {        MESSAGE: "Start Time: " + new Date().toISOString(),      }    })  },};
```

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/cron.mdx)

Last updated: Nov 24, 2025

[Previous  
Static Frontend, Container Backend](/containers/examples/container-backend/) [Next  
Status Hooks](/containers/examples/status-hooks/)

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