<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/massimo-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./assets/massimo-logo-light.svg">
    <img alt="Massimo Logo" src="./assets/massimo-logo-light.svg" width="250">
  </picture>
</div>

<h1 align="center">Massimo</h1>

<div align="center">

[![npm version](https://badge.fury.io/js/massimo.svg)](https://badge.fury.io/js/massimo)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

</div>

**Massimo** is an API SDK client and CLI tool for creating fully-typed clients for remote OpenAPI or GraphQL APIs. Generate TypeScript/JavaScript clients with automatic type inference, authentication support, and seamless integration with popular frontend frameworks.

> **Why "Massimo"?** The name is inspired by [Massimo Troisi](https://en.wikipedia.org/wiki/Il_Postino:_The_Postman), the beloved Italian actor from the film "Il Postino" (The Postman). Just as the postman in the movie delivered messages and connected people, Massimo delivers API connections and bridges the gap between services, making communication between applications as effortless and poetic as Troisi's unforgettable performance.

## 🚀 Features

- **OpenAPI Client Generation**: Create fully-typed clients from OpenAPI 3.x specifications
- **GraphQL Client Generation**: Generate clients from GraphQL schemas with type support
- **TypeScript First**: Full TypeScript support with automatic type generation
- **Framework Agnostic**: Works with any Node.js application or frontend framework
- **Authentication Support**: Built-in support for headers, tokens, and custom authentication
- **Fastify Plugin**: Ready-to-use Fastify plugin for seamless integration

## 📦 Installation

### CLI Tool

```bash
npm install -g massimo-cli
```

### Library

```bash
npm install massimo
```

## 🛠️ Quick Start

### Generate an OpenAPI Client

```bash
massimo http://api.example.com/openapi.json --name myclient
```

### Generate a GraphQL Client

```bash
massimo http://api.example.com/graphql --name myclient --type graphql
```

### Use the Generated Client

**JavaScript/TypeScript (Node.js, Undici-based):**

The undici-based client is preferred for Node.js environments when you need:

- Maximum performance - Undici is the fastest HTTP/1.1 client for Node.js
- Advanced connection management with pooling, keep-alive, and pipelining
- HTTP/2 support with full capabilities
- Node.js optimized runtime (bundled with Node.js 18+)
- Advanced features like interceptors, custom dispatchers, and WebSocket support
- Efficient streaming with pipeline and stream methods for large payloads
- Comprehensive error types and network-level error handling

```typescript
// Generate Node.js client
// massimo http://api.example.com/openapi.json --name myclient

import myClient from "./myclient/myclient.js";

const client = await myClient({
  url: "https://api.example.com",
});

// OpenAPI
const users = await client.getUsers();
const newUser = await client.createUser({ name: "John Doe" });

// GraphQL
const result = await client.graphql({
  query: "query { users { id name } }",
});
```

**Frontend Client (Browser, Fetch-based):**

The fetch-based client is preferred for browser environments and when you need:

- Browser compatibility with native Fetch API (Undici is Node.js-only)
- Zero dependencies for minimal bundle size
- Isomorphic code that runs in browsers and Node.js
- Maximum compatibility across all JavaScript runtimes
- Simple HTTP requests without advanced configuration
- Publishing to npm with broadest runtime support
- Independence from specific undici version features

```typescript
// Generate frontend client
// massimo http://api.example.com/openapi.json --frontend --name myclient

// Option 1: Named operations
import { setBaseUrl, getUsers, createUser } from "./myclient/api.js";

setBaseUrl("https://api.example.com");

// Make type-safe API calls
const users = await getUsers({});
const newUser = await createUser({
  name: "Jane Doe",
  email: "jane@example.com",
});

// Option 2: Factory method
import buildClient from "./myclient/api.js";

const client = buildClient("https://api.example.com");

// Set default headers for authentication
client.setDefaultHeaders({
  Authorization: "Bearer token",
});

const users = await client.getUsers({});
const user = await client.getUserById({ id: "123" });
```

**Fastify Plugin:**

```javascript
const fastify = require("fastify")();
const pltClient = require("@platformatic/client/fastify-plugin");

fastify.register(pltClient, { url: "http://example.com" });

// GraphQL
fastify.post("/", async (request, reply) => {
  const res = await request.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }',
  });
  return res;
});

// OpenAPI
fastify.post("/", async (request, reply) => {
  const res = await request.movies.createMovie({ title: "foo" });
  return res;
});

fastify.listen({ port: 3000 });
```

Note that you would need to install @platformatic/client as a dependency.

**TypeScript with Fastify Plugin:**

Massimo generates full TypeScript support for Fastify. To add types information to your plugin, you can either extend the FastifyRequest interface globally or locally.

```typescript
import { type MoviesClient } from "./movies/movies.ts";
import fastify, { type FastifyRequest } from "fastify";
import pltClient from "@platformatic/client/fastify-plugin";

const server = fastify();
server.register(pltClient, { url: "http://example.com" });

// Method A: extend the interface globally
declare module "fastify" {
  interface FastifyRequest {
    movies: MoviesClient;
  }
}

server.get("/movies", async (request: FastifyRequest, reply: FastifyReply) => {
  return request.movies.getMovies();
});

// Method B: use a local request extension
interface MoviesRequest extends FastifyRequest {
  movies: MoviesClient;
}

server.get("/movies", async (request: MoviesRequest, reply: FastifyReply) => {
  return request.movies.getMovies();
});
```

## 📚 Documentation

### CLI Commands

```bash
# Generate client from URL
massimo <url> --name <client-name>

# Generate from local file
massimo ./openapi.json --name myclient

# Generate only TypeScript types
massimo <url> --name myclient --types-only

# Specify client type (auto-detected by default)
massimo <url> --name myclient --type openapi
massimo <url> --name myclient --type graphql

# Custom output folder
massimo <url> --name myclient --folder ./clients
```

### Client Options

```typescript
interface ClientOptions {
  url: string; // Base URL for the API
  headers?: Record<string, string>; // Default headers
  timeout?: number; // Request timeout in ms
  throwOnError?: boolean; // Throw on HTTP errors
}

const client = await generateMyClient({
  url: "https://api.example.com",
  headers: {
    Authorization: "Bearer token",
  },
  timeout: 5000,
  throwOnError: true,
});
```

### Authentication

Configure authentication headers dynamically:

```javascript
// In a Fastify plugin
app.configureMyClient({
  async getHeaders(req, reply) {
    return {
      Authorization: `Bearer ${req.user.token}`,
      "X-User-ID": req.user.id,
    };
  },
});
```

### TypeScript Support

Massimo generates full TypeScript definitions:

```typescript
// Generated types for OpenAPI
interface GetUsersResponse {
  id: string;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

interface Client {
  getUsers(): Promise<GetUsersResponse[]>;
  createUser(req: CreateUserRequest): Promise<GetUsersResponse>;
}

// Generated types for GraphQL
interface User {
  id?: string;
  name?: string;
  email?: string;
}

interface GraphQLClient {
  graphql<T>(options: {
    query: string;
    variables?: Record<string, unknown>;
    headers?: Record<string, string>;
  }): Promise<T>;
}
```

## 🏗️ Architecture

Massimo consists of two main packages:

- **`massimo`**: Core client library for generating and using API clients
- **`massimo-cli`**: Command-line tool for generating client code

### Supported APIs

- **OpenAPI 3.x**: Full support for OpenAPI specifications with automatic client generation
- **GraphQL**: Support for GraphQL schemas with type generation
- **Any HTTP API**: As long as it exposes OpenAPI or GraphQL schemas

### Generated Client Features

- **Type Safety**: Full TypeScript support with request/response typing
- **Error Handling**: Built-in error handling and validation
- **Request/Response Interceptors**: Middleware support for modifying requests/responses
- **Retry Logic**: Configurable retry mechanisms
- **Telemetry**: Automatic telemetry and tracing propagation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/platformatic/massimo.git
cd massimo
pnpm install
pnpm test
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/massimo
npm test
```

## 📄 License

Licensed under [Apache 2.0](./LICENSE).

## 🔗 Links

- [Documentation](https://docs.platformatic.dev/reference/client/)
- [Issues](https://github.com/platformatic/massimo/issues)
- [Discord Community](https://discord.gg/platformatic)

---

Made with ❤️ by the [Platformatic](https://platformatic.dev) team.
