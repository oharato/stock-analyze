Copy page

# Rollouts

## How rollouts work

[](#how-rollouts-work)

When you run `wrangler deploy`, the Worker code is updated immediately and Container instances are updated using a rolling deploy strategy. The default rollout configuration is two steps, where the first step updates 10% of the instances, and the second step updates the remaining 90%. This can be configured in your Wrangler config file using the [`rollout_step_percentage`](/workers/wrangler/configuration#containers) property.

When deploying a change, you can also configure a [`rollout_active_grace_period`](/workers/wrangler/configuration#containers), which is the minimum number of seconds to wait before an active container instance becomes eligible for updating during a rollout. At that point, the container will be sent at `SIGTERM`, and still has 15 minutes to shut down gracefully. If the instance does not stop within 15 minutes, it is forcefully stopped with a `SIGKILL` signal. If you have cleanup that must occur before a Container instance is stopped, you should do it during this 15 minute period.

Once stopped, the instance is replaced with a new instance running the updated code. Requests may hang while the container is starting up again.

Here is an example configuration that sets a 5 minute grace period and a two step rollout where the first step updates 10% of instances and the second step updates 100% of instances:

*   [wrangler.jsonc](#tab-panel-1392)
*   [wrangler.toml](#tab-panel-1393)

```
{  "$schema": "./node_modules/wrangler/config-schema.json",  "containers": [    {      "max_instances": 10,      "class_name": "MyContainer",      "image": "./Dockerfile",      "rollout_active_grace_period": 300,      "rollout_step_percentage": [        10,        100      ]    }  ],  "durable_objects": {    "bindings": [      {        "name": "MY_CONTAINER",        "class_name": "MyContainer"      }    ]  },  "migrations": [    {      "tag": "v1",      "new_sqlite_classes": [        "MyContainer"      ]    }  ]}
```

```
[[containers]]max_instances = 10class_name = "MyContainer"image = "./Dockerfile"rollout_active_grace_period = 300rollout_step_percentage = [10, 100]
[[durable_objects.bindings]]name = "MY_CONTAINER"class_name = "MyContainer"
[[migrations]]tag = "v1"new_sqlite_classes = ["MyContainer"]
```

## Immediate rollouts

[](#immediate-rollouts)

If you need to do a one-off deployment that rolls out to 100% of container instances in one step, you can deploy with:

*   [npm](#tab-panel-1389)
*   [yarn](#tab-panel-1390)
*   [pnpm](#tab-panel-1391)

Terminal window

```
npx wrangler deploy --containers-rollout=immediate
```

Terminal window

```
yarn wrangler deploy --containers-rollout=immediate
```

Terminal window

```
pnpm wrangler deploy --containers-rollout=immediate
```

Note that `rollout_active_grace_period`, if configured, will still apply.

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/platform-details/rollouts.mdx)

Last updated: Nov 26, 2025

[Previous  
Limits and Instance Types](/containers/platform-details/limits/) [Next  
Image Management](/containers/platform-details/image-management/)

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