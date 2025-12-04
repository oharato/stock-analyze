Copy page

# Getting started

In this guide, you will deploy a Worker that can make requests to one or more Containers in response to end-user requests. In this example, each container runs a small webserver written in Go.

This example Worker should give you a sense for simple Container use, and provide a starting point for more complex use cases.

## Prerequisites

[](#prerequisites)

### Ensure Docker is running locally

[](#ensure-docker-is-running-locally)

In this guide, we will build and push a container image alongside your Worker code. By default, this process uses [Docker ↗](https://www.docker.com/) to do so.

You must have Docker running locally when you run `wrangler deploy`. For most people, the best way to install Docker is to follow the [docs for installing Docker Desktop ↗](https://docs.docker.com/desktop/). Other tools like [Colima ↗](https://github.com/abiosoft/colima) may also work.

You can check that Docker is running properly by running the `docker info` command in your terminal. If Docker is running, the command will succeed. If Docker is not running, the `docker info` command will hang or return an error including the message "Cannot connect to the Docker daemon".

## Deploy your first Container

[](#deploy-your-first-container)

Run the following command to create and deploy a new Worker with a container, from the starter template:

*   [npm](#tab-panel-699)
*   [yarn](#tab-panel-700)
*   [pnpm](#tab-panel-701)

Terminal window

```
npm create cloudflare@latest -- --template=cloudflare/templates/containers-template
```

Terminal window

```
yarn create cloudflare --template=cloudflare/templates/containers-template
```

Terminal window

```
pnpm create cloudflare@latest --template=cloudflare/templates/containers-template
```

When you want to deploy a code change to either the Worker or Container code, you can run the following command using [Wrangler CLI](/workers/wrangler/):

*   [npm](#tab-panel-702)
*   [yarn](#tab-panel-703)
*   [pnpm](#tab-panel-704)

Terminal window

```
npx wrangler deploy
```

Terminal window

```
yarn wrangler deploy
```

Terminal window

```
pnpm wrangler deploy
```

When you run `wrangler deploy`, the following things happen:

*   Wrangler builds your container image using Docker.
*   Wrangler pushes your image to a [Container Image Registry](/containers/platform-details/image-management/) that is automatically integrated with your Cloudflare account.
*   Wrangler deploys your Worker, and configures Cloudflare's network to be ready to spawn instances of your container

The build and push usually take the longest on the first deploy. Subsequent deploys are faster, because they [reuse cached image layers ↗](https://docs.docker.com/build/cache/).

Note

After you deploy your Worker for the first time, you will need to wait several minutes until it is ready to receive requests. Unlike Workers, Containers take a few minutes to be provisioned. During this time, requests are sent to the Worker, but calls to the Container will error.

### Check deployment status

[](#check-deployment-status)

After deploying, run the following command to show a list of containers containers in your Cloudflare account, and their deployment status:

*   [npm](#tab-panel-705)
*   [yarn](#tab-panel-706)
*   [pnpm](#tab-panel-707)

Terminal window

```
npx wrangler containers list
```

Terminal window

```
yarn wrangler containers list
```

Terminal window

```
pnpm wrangler containers list
```

And see images deployed to the Cloudflare Registry with the following command:

*   [npm](#tab-panel-708)
*   [yarn](#tab-panel-709)
*   [pnpm](#tab-panel-710)

Terminal window

```
npx wrangler containers images list
```

Terminal window

```
yarn wrangler containers images list
```

Terminal window

```
pnpm wrangler containers images list
```

### Make requests to Containers

[](#make-requests-to-containers)

Now, open the URL for your Worker. It should look something like `https://hello-containers.YOUR_ACCOUNT_NAME.workers.dev`.

If you make requests to the paths `/container/1` or `/container/2`, your Worker routes requests to specific containers. Each different path after "/container/" routes to a unique container.

If you make requests to `/lb`, you will load balanace requests to one of 3 containers chosen at random.

You can confirm this behavior by reading the output of each request.

## Understanding the Code

[](#understanding-the-code)

Now that you've deployed your first container, let's explain what is happening in your Worker's code, in your configuration file, in your container's code, and how requests are routed.

## Each Container is backed by its own Durable Object

[](#each-container-is-backed-by-its-own-durable-object)

Incoming requests are initially handled by the Worker, then passed to a container-enabled [Durable Object](/durable-objects). To simplify and reduce boilerplate code, Cloudflare provides a [`Container` class ↗](https://github.com/cloudflare/containers) as part of the `@cloudflare/containers` NPM package.

You don't have to be familiar with Durable Objects to use Containers, but it may be helpful to understand the basics.

Each Durable Object runs alongside an individual container instance, manages starting and stopping it, and can interact with the container through its ports. Containers will likely run near the Worker instance requesting them, but not necessarily. Refer to ["How Locations are Selected"](/containers/platform-details/#how-are-locations-are-selected) for details.

In a simple app, the Durable Object may just boot the container and proxy requests to it.

In a more complex app, having container-enabled Durable Objects allows you to route requests to individual stateful container instances, manage the container lifecycle, pass in custom starting commands and environment variables to containers, run hooks on container status changes, and more.

See the [documentation for Durable Object container methods](/durable-objects/api/container/) and the [`Container` class repository ↗](https://github.com/cloudflare/containers) for more details.

### Configuration

[](#configuration)

Your [Wrangler configuration file](/workers/wrangler/configuration/) defines the configuration for both your Worker and your container:

*   [wrangler.jsonc](#tab-panel-711)
*   [wrangler.toml](#tab-panel-712)

```
{  "$schema": "./node_modules/wrangler/config-schema.json",  "containers": [    {      "max_instances": 10,      "class_name": "MyContainer",      "image": "./Dockerfile"    }  ],  "durable_objects": {    "bindings": [      {        "name": "MY_CONTAINER",        "class_name": "MyContainer"      }    ]  },  "migrations": [    {      "tag": "v1",      "new_sqlite_classes": [        "MyContainer"      ]    }  ]}
```

```
[[containers]]max_instances = 10class_name = "MyContainer"image = "./Dockerfile"
[[durable_objects.bindings]]name = "MY_CONTAINER"class_name = "MyContainer"
[[migrations]]tag = "v1"new_sqlite_classes = ["MyContainer"]
```

Important points about this config:

*   `image` points to a Dockerfile or to a directory containing a Dockerfile.
*   `class_name` must be a [Durable Object class name](/durable-objects/api/base/).
*   `max_instances` declares the maximum number of simultaneously running container instances that will run.
*   The Durable Object must use [`new_sqlite_classes`](/durable-objects/best-practices/access-durable-objects-storage/#create-sqlite-backed-durable-object-class) not `new_classes`.

### The Container Image

[](#the-container-image)

Your container image must be able to run on the `linux/amd64` architecture, but aside from that, has few limitations.

In the example you just deployed, it is a simple Golang server that responds to requests on port 8080 using the `MESSAGE` environment variable that will be set in the Worker and an [auto-generated environment variable](/containers/platform-details/#environment-variables) `CLOUDFLARE_DEPLOYMENT_ID.`

```
func handler(w http.ResponseWriter, r *http.Request) {  message := os.Getenv("MESSAGE")  instanceId := os.Getenv("CLOUDFLARE_DEPLOYMENT_ID")
  fmt.Fprintf(w, "Hi, I'm a container and this is my message: %s, and my instance ID is: %s", message, instanceId)}
```

Note

After deploying the example code, to deploy a different image, you can replace the provided image with one of your own.

### Worker code

[](#worker-code)

#### Container Configuration

[](#container-configuration)

First note `MyContainer` which extends the [`Container` ↗](https://github.com/cloudflare/containers) class:

JavaScript

```
export class MyContainer extends Container {  defaultPort = 8080;  sleepAfter = '10s';  envVars = {    MESSAGE: 'I was passed in via the container class!',  };
  override onStart() {    console.log('Container successfully started');  }
  override onStop() {    console.log('Container successfully shut down');  }
  override onError(error: unknown) {    console.log('Container error:', error);  }}
```

This defines basic configuration for the container:

*   `defaultPort` sets the port that the `fetch` and `containerFetch` methods will use to communicate with the container. It also blocks requests until the container is listening on this port.
*   `sleepAfter` sets the timeout for the container to sleep after it has been idle for a certain amount of time.
*   `envVars` sets environment variables that will be passed to the container when it starts.
*   `onStart`, `onStop`, and `onError` are hooks that run when the container starts, stops, or errors, respectively.

See the [Container class documentation](/containers/container-package) for more details and configuration options.

#### Routing to Containers

[](#routing-to-containers)

When a request enters Cloudflare, your Worker's [`fetch` handler](/workers/runtime-apis/handlers/fetch/) is invoked. This is the code that handles the incoming request. The fetch handler in the example code, launches containers in two ways, on different routes:

*   Making requests to `/container/` passes requests to a new container for each path. This is done by spinning up a new Container instance. You may note that the first request to a new path takes longer than subsequent requests, this is because a new container is booting.
    
    JavaScript
    
    ```
    if (pathname.startsWith("/container")) {  const container = env.MY_CONTAINER.getByName(pathname);  return await container.fetch(request);}
    ```
    
*   Making requests to `/lb` will load balance requests across several containers. This uses a simple `getRandom` helper method, which picks an ID at random from a set number (in this case 3), then routes to that Container instance. You can replace this with any routing or load balancing logic you choose to implement:
    
    JavaScript
    
    ```
    if (pathname.startsWith("/lb")) {  const container = await getRandom(env.MY_CONTAINER, 3);  return await container.fetch(request);}
    ```
    

This allows for multiple ways of using Containers:

*   If you simply want to send requests to many stateless and interchangeable containers, you should load balance.
*   If you have stateful services or need individually addressable containers, you should request specific Container instances.
*   If you are running short-lived jobs, want fine-grained control over the container lifecycle, want to parameterize container entrypoint or env vars, or want to chain together multiple container calls, you should request specific Container instances.

Note

Currently, routing requests to one of many interchangeable Container instances is accomplished with the `getRandom` helper.

This is temporary — we plan to add native support for latency-aware autoscaling and load balancing in the coming months.

## View Containers in your Dashboard

[](#view-containers-in-your-dashboard)

The [Containers Dashboard ↗](http://dash.cloudflare.com/?to=/:account/workers/containers) shows you helpful information about your Containers, including:

*   Status and Health
*   Metrics
*   Logs
*   A link to associated Workers and Durable Objects

After launching your Worker, navigate to the Containers Dashboard by clicking on "Containers" under "Workers & Pages" in your sidebar.

## Next Steps

[](#next-steps)

To do more:

*   Modify the image by changing the Dockerfile and calling `wrangler deploy`
*   Review our [examples](/containers/examples) for more inspiration
*   Get [more information on the Containers Beta](/containers/beta-info)

## Was this helpful?

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/containers/get-started.mdx)

Last updated: Oct 21, 2025

[Previous  
Overview](/containers/) [Next  
Examples](/containers/examples/)

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