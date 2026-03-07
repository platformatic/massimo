import { getCommentLines, renderCommentBlock } from './comments.js'
import { createRenderContext } from './render-context.js'
import { buildObjectTypeLines } from './object.js'
import { getSchemaAtPath } from './pointer.js'
import { renderType } from './render-type.js'

export function buildDeclarations ({ state }) {
  const declarations = []

  for (const [path, name] of state.nameRegistry.getPathEntries()) {
    const schema = getSchemaAtPath({ schema: state.rootSchema, path })
    if (!schema) {
      continue
    }

    declarations.push(buildDeclaration({
      path,
      name,
      schema,
      state
    }))
  }

  return declarations
}

export function renderDeclarations ({ declarations, rootName }) {
  const lines = []

  for (const [index, declaration] of declarations.entries()) {
    if (index > 0) {
      lines.push('')
    }

    if (declaration.comment) {
      lines.push(...renderCommentBlock({ lines: declaration.comment }))
    }

    if (declaration.kind === 'interface') {
      lines.push(`interface ${declaration.name} {`)
      lines.push(...declaration.bodyLines)
      lines.push('}')
      continue
    }

    lines.push(`type ${declaration.name} = ${declaration.value};`)
  }

  lines.push('')
  lines.push(`export { ${rootName} };`)

  return `${lines.join('\n')}\n`
}

function buildDeclaration ({ path, name, schema, state }) {
  const context = createRenderContext({
    schema,
    state,
    path,
    lookupPathName: false,
    lookupChildPathNames: true
  })

  if (shouldUseInterface({ schema })) {
    return {
      kind: 'interface',
      name,
      comment: getCommentLines({ schema, name }),
      bodyLines: buildObjectTypeLines({ context, renderType })
    }
  }

  return {
    kind: 'type',
    name,
    comment: getCommentLines({ schema, name }),
    value: renderType({ context })
  }
}

function shouldUseInterface ({ schema }) {
  return hasObjectMembers({ schema }) && !hasCombinator({ schema })
}

function hasObjectMembers ({ schema }) {
  return schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined || schema.patternProperties
}

function hasCombinator ({ schema }) {
  return Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf) || Array.isArray(schema.allOf)
}
