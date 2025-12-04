Copy page

# Status Hooks

Execute Workers code in reaction to Container status changes

When a Container starts, stops, and errors, it can trigger code execution in a Worker that has defined status hooks on the `Container` class. Refer to the [Container package docs ↗](https://github.com/cloudflare/containers/blob/main/README.md#lifecycle-hooks) for more details.

JavaScript

```
import { Container } from '@cloudflare/containers';
export class MyContainer extends Container {  defaultPort = 4000;  sleepAfter = '5m';
  override onStart() {    console.log('Container successfully started');  }
  override onStop(stopParams) {    if (stopParams.exitCode === 0) {      console.log('Container stopped gracefully');    } else {      console.log('Container stopped with exit code:', stopParams.exitCode);    }
    console.log('Container stop reason:', stopParams.reason);  }
  override onError(error: string) {    console.log('Container error:', error);  }}
```

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/status-hooks.mdx)

Last updated: Sep 22, 2025

[Previous  
Cron Container](/containers/examples/cron/) [Next  
Env Vars and Secrets](/containers/examples/env-vars-and-secrets/)

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