Copy page

# Containers (Beta)

Enhance your Workers with serverless containers

Available on Workers Paid plan

Run code written in any programming language, built for any runtime, as part of apps built on [Workers](/workers).

Deploy your container image to Region:Earth without worrying about managing infrastructure - just define your Worker and `wrangler deploy`.

With Containers you can run:

*   Resource-intensive applications that require CPU cores running in parallel, large amounts of memory or disk space
*   Applications and libraries that require a full filesystem, specific runtime, or Linux-like environment
*   Existing applications and tools that have been distributed as container images

Container instances are spun up on-demand and controlled by code you write in your [Worker](/workers). Instead of chaining together API calls or writing Kubernetes operators, you just write JavaScript:

*   [Worker Code](#tab-panel-715)
*   [Worker Config](#tab-panel-716)

JavaScript

```
import { Container, getContainer } from "@cloudflare/containers";
export class MyContainer extends Container {  defaultPort = 4000; // Port the container is listening on  sleepAfter = "10m"; // Stop the instance if requests not sent for 10 minutes}
export default {  async fetch(request, env) {    const { "session-id": sessionId } = await request.json();    // Get the container instance for the given session ID    const containerInstance = getContainer(env.MY_CONTAINER, sessionId);    // Pass the request to the container instance on its default port    return containerInstance.fetch(request);  },};
```

*   [wrangler.jsonc](#tab-panel-713)
*   [wrangler.toml](#tab-panel-714)

```
{  "name": "container-starter",  "main": "src/index.js",  "compatibility_date": "2025-12-03",  "containers": [    {      "class_name": "MyContainer",      "image": "./Dockerfile",      "max_instances": 5    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "MyContainer",        "name": "MY_CONTAINER"      }    ]  },  "migrations": [    {      "new_sqlite_classes": ["MyContainer"],      "tag": "v1"    }  ]}
```

```
name = "container-starter"main = "src/index.js"compatibility_date = "2025-12-03"
[[containers]]class_name = "MyContainer"image = "./Dockerfile"max_instances = 5
[[durable_objects.bindings]]class_name = "MyContainer"name = "MY_CONTAINER"
[[migrations]]new_sqlite_classes = [ "MyContainer" ]tag = "v1"
```

[

Get started

](/containers/get-started/)[

Containers dashboard

](https://dash.cloudflare.com/?to=/:account/workers/containers)

* * *

## Next Steps

[](#next-steps)

### Deploy your first Container

Build and push an image, call a Container from a Worker, and understand scaling and routing.

[Deploy a Container](/containers/get-started/)

### Container Examples

See examples of how to use a Container with a Worker, including stateless and stateful routing, regional placement, Workflow and Queue integrations, AI-generated code execution, and short-lived workloads.

[See Examples](/containers/examples/)

* * *

## More resources

[](#more-resources)

[Beta Information](/containers/beta-info/)

Learn about the Containers Beta and upcoming features.

[Wrangler](/workers/wrangler/commands/#containers)

Learn more about the commands to develop, build and push images, and deploy containers with Wrangler.

[Limits](/containers/platform-details/#limits)

Learn about what limits Containers have and how to work within them.

[Containers Discord](https://discord.cloudflare.com)

Connect with other users of Containers on Discord. Ask questions, show what you are building, and discuss the platform with other developers.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/index.mdx)

Last updated: Sep 22, 2025

[Next  
Getting started](/containers/get-started/)

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