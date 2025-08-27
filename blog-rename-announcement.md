# Introducing Massimo: The Next Evolution of Type-Safe API Client Generation

Today marks a significant milestone in the evolution of type-safe API development. What began as **@platformatic/client** in our [v0.19.0 release](https://blog.platformatic.dev/its-platformatic-client-time-in-the-v0190-release) has grown into something much bigger—a production-proven, enterprise-grade solution now powering companies like [Spendesk](https://www.businesswire.com/news/home/20230929251750/en/Spendesk-Adopts-Platformatic-to-Enhance-Backend-Development-Efficiency), who are not only using Massimo in production but actively contributing to its development.

We're thrilled to introduce **Massimo** (formerly @platformatic/client)—not just a new name, but the next evolution of type-safe API client generation. This relaunch also marks Massimo's independence as standalone packages without the @platformatic scope. 

## Why "Massimo"?

The name is inspired by [Massimo Troisi](https://en.wikipedia.org/wiki/Il_Postino:_The_Postman), the beloved Italian actor from the film "Il Postino" (The Postman). Just as the postman in the movie delivered messages and connected people, Massimo delivers API connections and bridges the gap between services, making communication between applications as effortless and poetic as Troisi's unforgettable performance.

## From Prototype to Production

Since its initial release, what started as a developer tool has evolved into an enterprise-grade solution. Massimo has been battle-tested in production environments, with companies like Spendesk relying on it to enhance their backend development efficiency. This real-world usage has driven continuous improvements, community contributions, and the robust feature set you see today.

## Complete Feature Overview

Massimo is a powerful API SDK client and CLI tool for creating fully-typed clients for remote OpenAPI or GraphQL APIs. Here's everything you need to know about its comprehensive, production-proven feature set:

### 🚀 Core Features

**OpenAPI & GraphQL Support**
- Generate typed clients from OpenAPI 3.x specifications with full TypeScript support
- Create GraphQL clients from schemas with automatic type generation
- Support for any backend that exposes OpenAPI or GraphQL endpoints

**Type-Safe Development**
- Full TypeScript-first development experience
- Automatically generated TypeScript types for complete type safety
- Request and response type validation with detailed error messages
- Support for complex OpenAPI schemas including nested objects and arrays

**Framework Integration**
- Works seamlessly with any JavaScript framework (Node.js, React, Vue, Angular)
- First-class Fastify plugin for server-side integration
- Browser-compatible clients using `fetch` API
- Support for both server and client environments

### 🛠️ CLI Tool Features

The `massimo-cli` provides extensive command-line functionality:

**Client Generation Options**
```bash
# Generate OpenAPI client
massimo http://api.example.com/openapi.json --name myclient

# Generate GraphQL client  
massimo http://api.example.com/graphql --name myclient --type graphql

# Frontend-compatible client
massimo http://api.example.com/openapi.json --frontend --language ts --name myclient

# Types only generation
massimo http://api.example.com/openapi.json --types-only --name myclient
```

**Advanced CLI Options**
- `--frontend` - Generate browser-compatible clients using `fetch`
- `--language js|ts` - Choose JavaScript or TypeScript output
- `--full-response` - Return complete response objects instead of just body
- `--full-request` - Wrap parameters in `body`, `headers`, `query` structure
- `--validate-response` - Enable response validation against schema
- `--optional-headers` - Mark specific headers as optional
- `--typescript` - Generate TypeScript plugin files
- `--with-credentials` - Add credentials support for CORS requests

### 📦 Client Library Features

The `massimo` core library offers programmatic API access:

**OpenAPI Client Builder**
```javascript
import { buildOpenAPIClient } from "massimo";

const client = await buildOpenAPIClient({
  url: 'https://api.example.com/openapi.json',
  headers: { Authorization: 'Bearer token' },
  validateResponse: true,
  fullResponse: false,
  throwOnError: true
});
```

**GraphQL Client Builder**
```javascript
import { buildGraphQLClient } from "massimo";

const client = await buildGraphQLClient({
  url: 'https://api.example.com/graphql',
  headers: { Authorization: 'Bearer token' }
});

const result = await client.graphql({
  query: 'mutation { createUser(input: { name: "John" }) { id } }',
  variables: { name: "John" }
});
```

### 🔧 Authentication & Security Features

**Dynamic Headers**
- Support for dynamic header generation via `getHeaders` function
- Request-specific authentication token handling
- Context-aware header modification

**Fastify Plugin Authentication**
```javascript
app.configureMyClient({
  async getHeaders(req, reply) {
    return {
      Authorization: `Bearer ${req.user.token}`,
      'X-User-ID': req.user.id
    };
  }
});
```

**Security Options**
- Custom header configuration for protected endpoints
- Support for various authentication schemes (Bearer, API Key, etc.)
- CORS credentials handling for browser clients

### 🌐 Frontend & Browser Support

**Frontend Client Generation**
- Generate browser-compatible clients using native `fetch` API
- Support for both named operations and factory patterns
- Global configuration for base URLs and default headers

**Frontend Client Usage**
```javascript
// Named operations approach
import { setBaseUrl, getMovies, setDefaultHeaders } from './api.js';

setBaseUrl('https://api.example.com');
setDefaultHeaders({ Authorization: 'Bearer token' });
const movies = await getMovies({});

// Factory approach
import build from './api.js';

const client = build('https://api.example.com', {
  headers: { Authorization: 'Bearer token' }
});
const movies = await client.getMovies({});
```

### 🏗️ Advanced Features

**Operation Mapping**
- Access to OpenAPI operation ID mappings via symbol properties
- Method and path inspection for debugging and tooling

**Request/Response Customization**
- Custom query parameter parsing
- Request body and header modification
- Full response object access when needed
- Response validation against OpenAPI schemas

**Telemetry & Monitoring**
- Automatic telemetry propagation in Fastify environments
- Request tracing and performance monitoring
- Built-in error handling with detailed error codes

**Error Handling**
Comprehensive error system with specific error codes:
- `PLT_MASSIMO_OPTIONS_URL_REQUIRED` - Missing URL in client options
- `PLT_MASSIMO_FORM_DATA_REQUIRED` - FormData required for multipart requests
- `PLT_MASSIMO_MISSING_PARAMS_REQUIRED` - Missing required path parameters
- `PLT_MASSIMO_INVALID_RESPONSE_SCHEMA` - Response validation failure
- And more detailed error scenarios for robust error handling

### 🏢 Enterprise Adoption & Community

**Production Usage**
Companies like Spendesk are using Massimo to power their production applications, demonstrating its reliability and enterprise readiness. The feedback and contributions from these production deployments have been instrumental in shaping Massimo's evolution.

**Community Contributions**
Massimo benefits from active community involvement, with enterprise users contributing back improvements, bug fixes, and feature requests based on real-world usage patterns.

### 🔄 Upgrading from @platformatic/client

**Package Names**
- `@platformatic/client` → `massimo`
- `@platformatic/client-cli` → `massimo-cli`

**CLI Command**
- `npx @platformatic/client-cli` → `npx massimo-cli` or `massimo`

**Import Statements**
```javascript
// Before
import { buildOpenAPIClient } from '@platformatic/client';
import pltClient from '@platformatic/client/fastify-plugin';

// After  
import { buildOpenAPIClient } from 'massimo';
import pltClient from 'massimo/fastify-plugin';
```

All existing APIs remain the same - this evolution maintains full backward compatibility!

### 🚀 Production Ready

**Battle-Tested Features**
- Used in production environments with proven reliability
- Built-in retry logic and error recovery mechanisms
- Performance optimized for high-throughput applications
- Comprehensive test coverage with end-to-end testing

**Development Experience**
- Hot-reload support in development environments
- Detailed debugging information and logging
- Integration with popular development tools
- Extensive documentation and examples

## Get Started Today

Install Massimo and start generating typed API clients:

```bash
# Install CLI globally
npm install -g massimo-cli

# Generate your first client
massimo http://api.example.com/openapi.json --name myclient

# Or use the library directly
npm install massimo
```

The same powerful features you loved in @platformatic/client are now available as standalone Massimo packages, with continued development and new features coming soon!

## Documentation & Resources

- [Getting Started Guide](https://docs.platformatic.dev/massimo/getting-started)
- [CLI Reference](https://docs.platformatic.dev/massimo/cli-reference)  
- [API Documentation](https://docs.platformatic.dev/massimo/programmatic)
- [GitHub Repository](https://github.com/platformatic/massimo)

Join our [Discord community](https://discord.gg/platformatic) for support and to connect with other developers using Massimo!