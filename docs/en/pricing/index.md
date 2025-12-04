Copy page

# Pricing

## vCPU, Memory and Disk

[](#vcpu-memory-and-disk)

Containers are billed for every 10ms that they are actively running at the following rates, with included monthly usage as part of the $5 USD per month [Workers Paid plan](/workers/platform/pricing/):

Memory

CPU

Disk

**Free**

N/A

N/A

**Workers Paid**

25 GiB-hours/month included  
+$0.0000025 per additional GiB-second

375 vCPU-minutes/month  
\+ $0.000020 per additional vCPU-second

200 GB-hours/month  
+$0.00000007 per additional GB-second

You only pay for what you use — charges start when a request is sent to the container or when it is manually started. Charges stop after the container instance goes to sleep, which can happen automatically after a timeout. This makes it easy to scale to zero, and allows you to get high utilization even with bursty traffic.

Memory and disk usage are based on the _provisioned resources_ for the instance type you select, while CPU usage is based on _active usage_ only.

#### Instance Types

[](#instance-types)

When you deploy a container, you specify an [instance type](/containers/platform-details/#instance-types).

The instance type you select will impact your bill — larger instances include more memory and disk, incurring additional costs, and higher CPU capacity, which allows you to incur higher CPU costs based on active usage.

The following instance types are currently available:

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

## Network Egress

[](#network-egress)

Egress from Containers is priced at the following rates:

Region

Price per GB

Included Allotment per month

North America & Europe

$0.025

1 TB

Oceania, Korea, Taiwan

$0.05

500 GB

Everywhere Else

$0.04

500 GB

## Workers and Durable Objects Pricing

[](#workers-and-durable-objects-pricing)

When you use Containers, incoming requests to your containers are handled by your [Worker](/workers/platform/pricing/), and each container has its own [Durable Object](/durable-objects/platform/pricing/). You are billed for your usage of both Workers and Durable Objects.

## Logs and Observability

[](#logs-and-observability)

Containers are integrated with the [Workers Logs](/workers/observability/logs/workers-logs/) platform, and billed at the same rate. Refer to [Workers Logs pricing](/workers/observability/logs/workers-logs/#pricing) for details.

When you [enable observability for your Worker](/workers/observability/logs/workers-logs/#enable-workers-logs) with a binding to a container, logs from your container will show in both the Containers and Observability sections of the Cloudflare dashboard.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/pricing.mdx)

Last updated: Nov 21, 2025

[Previous  
Frequently Asked Questions](/containers/faq/) [Next  
llms.txt](/llms.txt)

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