Copy page

# Stateless Instances

Run multiple instances across Cloudflare's network

To simply proxy requests to one of multiple instances of a container, you can use the `getRandom` function:

TypeScript

```
import { Container, getRandom } from "@cloudflare/containers";
const INSTANCE_COUNT = 3;
class Backend extends Container {  defaultPort = 8080;  sleepAfter = "2h";}
export default {  async fetch(request: Request, env: Env): Promise<Response> {    // note: "getRandom" to be replaced with latency-aware routing in the near future    const containerInstance = await getRandom(env.BACKEND, INSTANCE_COUNT);    return containerInstance.fetch(request);  },};
```

Note

This example uses the `getRandom` function, which is a temporary helper that will randomly select one of N instances of a Container to route requests to.

In the future, we will provide improved latency-aware load balancing and autoscaling.

This will make scaling stateless instances simple and routing more efficient. See the [autoscaling documentation](/containers/platform-details/scaling-and-routing) for more details.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/stateless.mdx)

Last updated: Nov 20, 2025

[Previous  
Examples](/containers/examples/) [Next  
Static Frontend, Container Backend](/containers/examples/container-backend/)

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