# JSON Schema Type Generation

This directory contains the JSON Schema Draft-07 to TypeScript declaration generator used by `massimo-cli`.

The code is organized around one idea: generate `.d.ts` output in a way that is deterministic, inspectable, and easy to evolve without depending on side effects of other componentss.

## End-To-End Flow

The public entrypoint of the generator is [generator.js](./generator.js).

Generation happens in four phases:
1. Scan
   - Implemented in [core/scanner.js](./core/scanner.js)
   - Walks the schema once
   - Registers path-based names
   - Records scanned schema nodes, refs, and alias metadata

2. Canonicalize
   - Implemented in [declarations/canonicalize.js](./declarations/canonicalize.js)
   - Turns raw scan-time names into stable public declaration names
   - Resolves collisions deterministically
   - Computes safe structural alias targets

3. Build Declaration Graph
   - Implemented in [declarations/graph.js](./declarations/graph.js)
   - Converts canonicalized schema paths into declaration nodes
   - Expands object unions into base/branch/union declarations
   - Captures explicit dependencies between declarations

4. Validate and Render
   - Implemented in [declarations/validate.js](./declarations/validate.js) and [declarations/index.js](./declarations/index.js)
   - Rejects invalid declaration graphs
   - Emits final declarations in deterministic order
   - Renders the `.d.ts` module text

The render layer in [render/](./render) is used by both graph construction and final declaration building whenever a schema node needs an inline TypeScript type expression.

## Data Models

### Scan state

The scan phase returns a plain object that is passed through the rest of the pipeline. Its important fields are:
- `rootSchema`
  - the original input schema
- `rootName`
  - the top-level emitted type name
- `nameRegistry`
  - a path-to-name registry built during traversal
- `schemasByPath`
  - scanned schema nodes keyed by canonical schema path
- `aliasTargetByPath`
  - explicit alias target names for ref-driven reuse
- `aliasSourceSchemaByPath`
  - the schema node to use when an alias should inherit comments
- `refByPath`
  - which scanned paths came from `$ref`

This state is intentionally path-indexed. The later phases do not rediscover structure by traversing emitted declarations; they always go back to canonical schema paths.

### Canonicalized state

Canonicalization returns the scan state plus two additional fields:
- `nameOverrides`
  - final public names for emitted paths when they differ from raw scan-time names
- `structuralAliasTargets`
  - conservative alias reuse for safe scalar cases

From this point on, declaration emission should consider naming settled

### Declaration graph

The graph phase produces:
- `nodes`
  - a map of declaration node id to declaration node
- `entryIds`
  - the top-level declaration ids that define the public emission order

Each declaration node contains:
- `id`
  - stable internal identifier, usually a schema path
- `path`
  - original schema path
- `declaration`
  - final declaration payload, either `interface` or `type`
- `dependencyIds`
  - declaration nodes that must also exist in the output

The decalration graph is the boundary between "figuring out what should exist" and "rendering text".

## Why The Phases Are Split

I initially used a prototype-style approach that mixed naming, recursion, and rendering. That made it easy for the output to depend on whichever branch happened to be visited first.

The current split is meant to prevent that:
- **scan** decides what exists
- **canonicalize** decides what things are called
- **build declaration graph** decides which declarations are emitted and how they depend on each other
- **validate** rejects broken states early, and **render** only turns a validated declaration set into text (i.e. the types)

This split is needed to make sure that when a schema has deep nesting, a lot of ref reuse and somewhat heavy usage of combinators (e.g. allOf, oneOf), the output is deterministic. Without the split, the generated definitions got messy and would usually have a lot of duplicated defs like `Type`, `Type_1`, `Type_2`.

## Module Responsibilities

### `core/`
- [core/scanner.js](./core/scanner.js)
  - schema traversal
  - registration of names
  - ref expansion and alias metadata
  - helpers that tell the render layer when to inline property types.
    - if you're wondering why the scan layer has helpers for render layer, it's because those decisions rely on scan-time knowledge and not just the local schema node.
    - a way to think of this is - they are not render helpers, but more like scan-state query helpers used by rendering. hopefully that makes sense!
- [core/name-registry.js](./core/name-registry.js)
  - registers and resolves path:name assignments
- [core/naming.js](./core/naming.js)
  - type name normalization and singularization
- [core/pointer.js](./core/pointer.js)
  - JSON Pointer resolution

### `render/`
- [render/render-type.js](./render/render-type.js)
  - top-level dispatcher for inline type rendering
- [render/primitive.js](./render/primitive.js)
  - handles strings, numbers, booleans, consts, enums
- [render/array.js](./render/array.js)
  - handles arrays and tuples
- [render/object.js](./render/object.js)
  - handles object bodies, records, and open objects
- [render/union.js](./render/union.js)
  - handles combinators: `oneOf`, `anyOf`, `allOf`
- [render/reference.js](./render/reference.js)
  - `$ref` rendering and alias preference
- [render/render-context.js](./render/render-context.js)
  - shared render context passed between nested render calls

### `declarations/`
- [declarations/index.js](./declarations/index.js)
  - orchestration and final declaration rendering
- [declarations/canonicalize.js](./declarations/canonicalize.js)
  - naming policy
  - deterministic name collision handling
  - safe structural aliasing
- [declarations/graph.js](./declarations/graph.js)
  - declaration graph construction
  - object-union expansion
  - dependency collection
- [declarations/validate.js](./declarations/validate.js)
  - graph integrity checks
- [declarations/helpers.js](./declarations/helpers.js)
  - shared schema/path helpers used by canonicalization and graph building

### Top-level support files

- [comments.js](./comments.js)
  - comment extraction from schema metadata

## Naming Strategy

Names originate from schema paths, not from emitted declaration order.

The scan phase proposes names from:
- root title or explicit root name
- property names
- array item singularization
- definition keys
- union branch discriminators when available

Canonicalization then applies deterministic fixes:
- preserve one stable public name per emitted path
- singularize array item names when array and item would otherwise collide
- suffix name collisions in canonical path order
- reuse a previously named scalar alias only in narrow safe cases

If naming is ambiguous, the code prefers a distinct deterministic name over a more clever but less predictable alias collapse.

## Union Handling

Object unions are the most complex part of declaration emission.

The graph layer handles three main cases:
1. Plain object union
   - emit `BaseTypeName`, branch interfaces, and `type TypeName = BranchA | BranchB`

2. Single-branch object union
   - collapse into one declaration to avoid emitting unnecessary wrappers

3. Union-derived properties
   - when a base property would otherwise be `unknown`, build a property alias from the branch-specific declarations instead

This logic lives in [declarations/graph.js](./declarations/graph.js), not in the render layer, because it is about declaration structure rather than inline type syntax.

## Determinism Rules

The current implementation tries to keep output deterministic by enforcing these rules:
- names are based on canonical schema paths
- name collisions are resolved in canonical path order
- declaration graphs are built before rendering
- validation rejects conflicting duplicate declarations
- validation rejects missing dependencies
- validation rejects accidental self-referential aliases

Note that deterministic does not mean minimal. The code will emit extra declarations when that is the safer outcome.
Deterministic means same schema input and same code version produce the same emitted output.

## Tests

The tests are split by responsibility:
- [json-schema-scanner.test.js](/Users/curamet/development/oss/massimo/packages/massimo-cli/test/json-schema-scanner.test.js)
  - scan state and name discovery
- [json-schema-render-type.test.js](/Users/curamet/development/oss/massimo/packages/massimo-cli/test/json-schema-render-type.test.js)
  - inline type rendering
- [json-schema-reference.test.js](/Users/curamet/development/oss/massimo/packages/massimo-cli/test/json-schema-reference.test.js)
  - ref behavior
- [json-schema-declarations.test.js](/Users/curamet/development/oss/massimo/packages/massimo-cli/test/json-schema-declarations.test.js)
  - declaration-level behavior
- [json-schema-generator.test.js](/Users/curamet/development/oss/massimo/packages/massimo-cli/test/json-schema-generator.test.js)
  - end-to-end generation

## Where To Make Changes

- Change path discovery or raw naming inputs in `core/scanner.js`
- Change public declaration naming policy in `declarations/canonicalize.js`
- Change declaration expansion or dependency ordering in `declarations/graph.js`
- Change inline type rendering in `render/`
- Change output comments in `comments.js`

As a rule of thumb:
- if you are changing what a type is called, start in `declarations/canonicalize.js`
- if you are changing what declarations should exist, start in `declarations/graph.js`
- if you are changing how a schema fragment renders inline, start in `render/`
