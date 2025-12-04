Copy page

# Environment Variables

## Runtime environment variables

[](#runtime-environment-variables)

The container runtime automatically sets the following variables:

*   `CLOUDFLARE_APPLICATION_ID` - the ID of the Containers application
*   `CLOUDFLARE_COUNTRY_A2` - the [ISO 3166-1 Alpha 2 code ↗](https://www.iso.org/obp/ui/#search/code/) of a country the container is placed in
*   `CLOUDFLARE_LOCATION` - a name of a location the container is placed in
*   `CLOUDFLARE_REGION` - a region name
*   `CLOUDFLARE_DURABLE_OBJECT_ID` - the ID of the Durable Object instance that the container is bound to. You can use this to identify particular container instances on the dashboard.

## User-defined environment variables

[](#user-defined-environment-variables)

You can set environment variables when defining a Container in your Worker, or when starting a container instance.

For example:

JavaScript

```
class MyContainer extends Container {  defaultPort = 4000;  envVars = {    MY_CUSTOM_VAR: "value",    ANOTHER_VAR: "another_value",  };}
```

More details about defining environment variables and secrets can be found in [this example](/containers/examples/env-vars-and-secrets).

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/environment-variables.mdx)

Last updated: Sep 22, 2025

[Previous  
Scaling and Routing](/containers/platform-details/scaling-and-routing/) [Next  
Durable Object Interface ↗](/durable-objects/api/container/)

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