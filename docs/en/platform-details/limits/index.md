Copy page

# Limits and Instance Types

## Instance Types

[](#instance-types)

The memory, vCPU, and disk space for Containers are set through predefined instance types. Six instance types are currently available:

Instance Type

vCPU

Memory

Disk

lite

1/16

256 MiB

2 GB

basic

1/4

1 GiB

4 GB

standard-1

1/2

4 GiB

8 GB

standard-2

1

6 GiB

12 GB

standard-3

2

8 GiB

16 GB

standard-4

4

12 GiB

20 GB

These are specified using the [`instance_type` property](/workers/wrangler/configuration/#containers) in your Worker's Wrangler configuration file. Looking for larger instances? [Give us feedback here](/containers/beta-info/#feedback-wanted) and tell us what size instances you need, and what you want to use them for.

Note

The `dev` and `standard` instance types are preserved for backward compatibility and are aliases for `lite` and `standard-1`, respectively.

## Limits

[](#limits)

While in open beta, the following limits are currently in effect:

Feature

Workers Paid

GiB Memory for all concurrent live Container instances

400GiB

vCPU for all concurrent live Container instances

100

TB Disk for all concurrent live Container instances

2TB

Image size

Same as [instance disk space](#instance-types)

Total image storage per account

50 GB [1](#user-content-fn-1)

## Footnotes

[](#footnote-label)

1.  Delete container images with `wrangler containers delete` to free up space. Note that if you delete a container image and then [roll back](/workers/configuration/versions-and-deployments/rollbacks/) your Worker to a previous version, this version may no longer work. [↩](#user-content-fnref-1)
    

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/limits.mdx)

Last updated: Oct 7, 2025

[Previous  
Lifecycle of a Container](/containers/platform-details/architecture/) [Next  
Rollouts](/containers/platform-details/rollouts/)

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