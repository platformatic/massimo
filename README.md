<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/massimo-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./assets/massimo-logo-light.svg">
    <img alt="Massimo Logo" src="./assets/massimo-logo-light.svg" width="400">
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
npm install -g @platformatic/massimo-cli
```

### Library

```bash
npm install @platformatic/massimo
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

**JavaScript/TypeScript:**

```typescript
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

**Fastify Plugin:**

```javascript
import fastify from "fastify";
import pltClient from "@platformatic/massimo/fastify-plugin";

const app = fastify();

app.register(pltClient, {
  url: "https://api.example.com",
  name: "myapi",
});

app.get("/users", async (request, reply) => {
  return request.myapi.getUsers();
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

- **`@platformatic/massimo`**: Core client library for generating and using API clients
- **`@platformatic/massimo-cli`**: Command-line tool for generating client code

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
