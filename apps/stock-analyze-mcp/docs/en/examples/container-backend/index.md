Copy page

# Static Frontend, Container Backend

A simple frontend app with a containerized backend

A common pattern is to serve a static frontend application (e.g., React, Vue, Svelte) using Static Assets, then pass backend requests to a containerized backend application.

In this example, we'll show an example using a simple `index.html` file served as a static asset, but you can select from one of many frontend frameworks. See our [Workers framework examples](/workers/framework-guides/web-apps/) for more information.

For a full example, see the [Static Frontend + Container Backend Template ↗](https://github.com/mikenomitch/static-frontend-container-backend).

## Configure Static Assets and a Container

[](#configure-static-assets-and-a-container)

*   [wrangler.jsonc](#tab-panel-1329)
*   [wrangler.toml](#tab-panel-1330)

```
{  "name": "cron-container",  "main": "src/index.ts",  "assets": {    "directory": "./dist",    "binding": "ASSETS"  },  "containers": [    {      "class_name": "Backend",      "image": "./Dockerfile",      "max_instances": 3    }  ],  "durable_objects": {    "bindings": [      {        "class_name": "Backend",        "name": "BACKEND"      }    ]  },  "migrations": [    {      "new_sqlite_classes": [        "Backend"      ],      "tag": "v1"    }  ]}
```

```
name = "cron-container"main = "src/index.ts"
[assets]directory = "./dist"binding = "ASSETS"
[[containers]]class_name = "Backend"image = "./Dockerfile"max_instances = 3
[[durable_objects.bindings]]class_name = "Backend"name = "BACKEND"
[[migrations]]new_sqlite_classes = [ "Backend" ]tag = "v1"
```

## Add a simple index.html file to serve

[](#add-a-simple-indexhtml-file-to-serve)

Create a simple `index.html` file in the `./dist` directory.

index.html

```
<!DOCTYPE html><html lang="en">
<head>  <meta charset="UTF-8">  <meta name="viewport" content="width=device-width, initial-scale=1.0">  <title>Widgets</title>  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/alpinejs/3.13.3/cdn.min.js"></script></head>
<body>  <div x-data="widgets()" x-init="fetchWidgets()">    <h1>Widgets</h1>    <div x-show="loading">Loading...</div>    <div x-show="error" x-text="error" style="color: red;"></div>    <ul x-show="!loading && !error">      <template x-for="widget in widgets" :key="widget.id">        <li>          <span x-text="widget.name"></span> - (ID: <span x-text="widget.id"></span>)        </li>      </template>    </ul>
    <div x-show="!loading && !error && widgets.length === 0">      No widgets found.    </div>
  </div>
  <script>    function widgets() {      return {        widgets: [],        loading: false,        error: null,
        async fetchWidgets() {          this.loading = true;          this.error = null;
          try {            const response = await fetch('/api/widgets');            if (!response.ok) {              throw new Error(`HTTP ${response.status}: ${response.statusText}`);            }            this.widgets = await response.json();          } catch (err) {            this.error = err.message;          } finally {            this.loading = false;          }        }      }    }  </script>
</body>
</html>
```

In this example, we are using [Alpine.js ↗](https://alpinejs.dev/) to fetch a list of widgets from `/api/widgets`.

This is meant to be a very simple example, but you can get significantly more complex. See [examples of Workers integrating with frontend frameworks](/workers/framework-guides/web-apps/) for more information.

## Define a Worker

[](#define-a-worker)

Your Worker needs to be able to both serve static assets and route requests to the containerized backend.

In this case, we will pass requests to one of three container instances if the route starts with `/api`, and all other requests will be served as static assets.

JavaScript

```
import { Container, getRandom } from "@cloudflare/containers";
const INSTANCE_COUNT = 3;
class Backend extends Container {  defaultPort = 8080; // pass requests to port 8080 in the container  sleepAfter = "2h"; // only sleep a container if it hasn't gotten requests in 2 hours}
export default {  async fetch(request, env) {    const url = new URL(request.url);    if (url.pathname.startsWith("/api")) {      // note: "getRandom" to be replaced with latency-aware routing in the near future      const containerInstance = await getRandom(env.BACKEND, INSTANCE_COUNT);      return containerInstance.fetch(request);    }
    return env.ASSETS.fetch(request);  },};
```

Note

This example uses the `getRandom` function, which is a temporary helper that will randomly select of of N instances of a Container to route requests to.

In the future, we will provide improved latency-aware load balancing and autoscaling.

This will make scaling stateless instances simple and routing more efficient. See the [autoscaling documentation](/containers/platform-details/scaling-and-routing) for more details.

## Define a backend container

[](#define-a-backend-container)

Your container should be able to handle requests to `/api/widgets`.

In this case, we'll use a simple Golang backend that returns a hard-coded list of widgets.

server.go

```
package main
import (  "encoding/json"  "log"  "net/http")
func handler(w http.ResponseWriter, r \*http.Request) {  widgets := []map[string]interface{}{    {"id": 1, "name": "Widget A"},    {"id": 2, "name": "Sprocket B"},    {"id": 3, "name": "Gear C"},  }
  w.Header().Set("Content-Type", "application/json")  w.Header().Set("Access-Control-Allow-Origin", "*")  json.NewEncoder(w).Encode(widgets)
}
func main() {  http.HandleFunc("/api/widgets", handler)  log.Fatal(http.ListenAndServe(":8080", nil))}
```

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/examples/container-backend.mdx)

Last updated: Sep 22, 2025

[Previous  
Stateless Instances](/containers/examples/stateless/) [Next  
Cron Container](/containers/examples/cron/)

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