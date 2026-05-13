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

**Massimo** 是一个 API SDK 客户端和 CLI 工具，用于为远程 OpenAPI 或 GraphQL API 创建完全类型化的客户端。生成具有自动类型推断、身份验证支持以及与流行前端框架无缝集成的 TypeScript/JavaScript 客户端。

> **为什么叫 "Massimo"？** 这个名字的灵感来自 [Massimo Troisi](https://en.wikipedia.org/wiki/Il_Postino:_The_Postman)，电影 "Il Postino"（邮差）中备受喜爱的意大利演员。就像电影中的邮差传递信息并连接人们一样，Massimo 传递 API 连接并弥合服务之间的差距，使应用程序之间的通信像 Troisi 令人难忘的表演一样轻松和诗意。

## 🚀 功能特性

- **OpenAPI 客户端生成**：从 OpenAPI 3.x 规范创建完全类型化的客户端
- **GraphQL 客户端生成**：从 GraphQL 模式生成具有类型支持的客户端
- **TypeScript 支持**：生成具有完整类型推断的 TypeScript 代码
- **CLI 工具**：命令行界面，快速生成客户端
- **认证支持**：内置多种认证方式支持
- **框架集成**：与 React、Vue、Angular 等流行框架无缝集成

## 📦 安装

```bash
npm install massimo
```

## 🔧 使用方法

### CLI 使用

```bash
# 从 OpenAPI 规范生成客户端
massimo generate --openapi https://api.example.com/openapi.json

# 从 GraphQL 模式生成客户端
massimo generate --graphql https://api.example.com/graphql

# 指定输出目录
massimo generate --openapi ./openapi.json --output ./src/api
```

### 编程使用

```javascript
import { generateClient } from 'massimo';

// 从 OpenAPI 生成客户端
const client = await generateClient({
  source: 'https://api.example.com/openapi.json',
  output: './src/api'
});

// 使用生成的客户端
import { createClient } from './api/client';

const api = createClient({
  baseUrl: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

// 调用 API
const users = await api.getUsers();
const user = await api.getUser({ id: 1 });
```

## 📝 示例

### OpenAPI 客户端

```typescript
// 生成的客户端代码示例
interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiService {
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User>;
  createUser(user: Omit<User, 'id'>): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
}

const api: ApiService = createClient({
  baseUrl: 'https://api.example.com'
});

// 使用
const users = await api.getUsers();
console.log(users);
```

### GraphQL 客户端

```typescript
// 生成的 GraphQL 客户端
const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

// 查询
const { users } = await client.query({
  users: {
    id: true,
    name: true,
    email: true
  }
});

// 变更
const { createUser } = await client.mutation({
  createUser: {
    __args: {
      name: '张三',
      email: 'zhangsan@example.com'
    },
    id: true,
    name: true
  }
});
```

## 🔐 认证支持

Massimo 支持多种认证方式：

```typescript
// Bearer Token
const client = createClient({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'bearer',
    token: 'your-token'
  }
});

// API Key
const client = createClient({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'apikey',
    key: 'your-api-key',
    header: 'X-API-Key'
  }
});

// Basic Auth
const client = createClient({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'basic',
    username: 'user',
    password: 'pass'
  }
});
```

## 🛠️ 配置

### 配置文件

创建 `massimo.config.js` 文件：

```javascript
export default {
  // OpenAPI 配置
  openapi: {
    source: './openapi.json',
    output: './src/api'
  },
  
  // GraphQL 配置
  graphql: {
    source: './schema.graphql',
    output: './src/graphql'
  },
  
  // 生成选项
  options: {
    typescript: true,
    client: true,
    hooks: true
  }
};
```

## 📚 文档

详细文档请访问 [Massimo 文档网站](https://massimo.platformatic.dev)。

## 🤝 贡献

欢迎贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

## 📄 许可证

Apache 2.0

---

> 项目地址：[platformatic/massimo](https://github.com/platformatic/massimo)
> npm 包：[massimo](https://www.npmjs.com/package/massimo)
