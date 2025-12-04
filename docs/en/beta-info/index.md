Copy page

# Beta Info & Roadmap

Currently, Containers are in beta. There are several changes we plan to make prior to GA:

## Upcoming Changes and Known Gaps

[](#upcoming-changes-and-known-gaps)

### Limits

[](#limits)

Container limits will be raised in the future. We plan to increase both maximum instance size and maximum number of instances in an account.

See the [Limits documentation](/containers/platform-details/#limits) for more information.

### Autoscaling and load balancing

[](#autoscaling-and-load-balancing)

Currently, Containers are not autoscaled or load balanced. Containers can be scaled manually by calling `get()` on their binding with a unique ID.

We plan to add official support for utilization-based autoscaling and latency-aware load balancing in the future.

See the [Autoscaling documentation](/containers/platform-details/scaling-and-routing) for more information.

### Reduction of log noise

[](#reduction-of-log-noise)

Currently, the `Container` class uses Durable Object alarms to help manage Container shutdown. This results in unnecessary log noise in the Worker logs. You can filter these logs out in the dashboard by adding a Query, but this is not ideal.

We plan to automatically reduce log noise in the future.

### Dashboard Updates

[](#dashboard-updates)

The dashboard will be updated to show:

*   links from Workers to their associated Containers

### Co-locating Durable Objects and Containers

[](#co-locating-durable-objects-and-containers)

Currently, Durable Objects are not co-located with their associated Container. When requesting a container, the Durable Object will find one close to it, but not on the same machine.

We plan to co-locate Durable Objects with their Container in the future.

### More advanced Container placement

[](#more-advanced-container-placement)

We currently prewarm servers across our global network with container images to ensure quick start times. There are times in which you may request a new container and it will be started in a location that farther from the end user than is desired. We are optimizing this process to ensure that this happens as little as possible, but it may still occur.

### Atomic code updates across Workers and Containers

[](#atomic-code-updates-across-workers-and-containers)

When deploying a Container with `wrangler deploy`, the Worker code will be immediately updated while the Container code will slowly be updated using a rolling deploy.

This means that you must ensure Worker code is backwards compatible with the old Container code.

In the future, Worker code in the Durable Object will only update when associated Container code updates.

## Feedback wanted

[](#feedback-wanted)

There are several areas where we wish to gather feedback from users:

*   Do you want to integrate Containers with any other Cloudflare services? If so, which ones and how?
*   Do you want more ways to interact with a Container via Workers? If so, how?
*   Do you need different mechanisms for routing requests to containers?
*   Do you need different mechanisms for scaling containers? (see [scaling documentation](/containers/platform-details/scaling-and-routing) for information on autoscaling plans)

At any point during the Beta, feel free to [give feedback using this form ↗](https://forms.gle/CscdaEGuw5Hb6H2s7).

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/beta-info.mdx)

Last updated: Sep 22, 2025

[Previous  
Wrangler Commands ↗](/workers/wrangler/commands/#containers) [Next  
Frequently Asked Questions](/containers/faq/)

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