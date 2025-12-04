Copy page

# Container Package

When writing code that interacts with a container instance, you can either use a [Durable Object directly](/containers/platform-details/durable-object-methods) or use the [`Container` class ↗](https://github.com/cloudflare/containers) importable from [`@cloudflare/containers` ↗](https://www.npmjs.com/package/@cloudflare/containers).

We recommend using the `Container` class for most use cases.

*   [npm](#tab-panel-694)
*   [yarn](#tab-panel-695)
*   [pnpm](#tab-panel-696)

Terminal window

```
npm i @cloudflare/containers
```

Terminal window

```
yarn add @cloudflare/containers
```

Terminal window

```
pnpm add @cloudflare/containers
```

Then, you can define a class that extends `Container`, and use it in your Worker:

JavaScript

```
import { Container } from "@cloudflare/containers";
class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = "5m";}
export default {  async fetch(request, env) {    // gets default instance and forwards request from outside Worker    return env.MY_CONTAINER.getByName("hello").fetch(request);  },};
```

The `Container` class extends `DurableObject` so all [Durable Object](/durable-objects) functionality is available. It also provides additional functionality and a nice interface for common container behaviors, such as:

*   sleeping instances after an inactivity timeout
*   making requests to specific ports
*   running status hooks on startup, stop, or error
*   awaiting specific ports before making requests
*   setting environment variables and secrets

See the [Containers GitHub repo ↗](https://github.com/cloudflare/containers) for more details and the complete API.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/container-package.mdx)

Last updated: Sep 22, 2025

[Previous  
Durable Object Interface ↗](/durable-objects/api/container/) [Next  
Local Development](/containers/local-dev/)

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