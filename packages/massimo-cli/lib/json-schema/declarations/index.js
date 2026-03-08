import { renderCommentBlock } from '../comments.js'
import { canonicalizeDeclarationState } from './canonicalize.js'
import { buildDeclarationGraph, renderDeclarationGraph } from './graph.js'
import { validateDeclarationGraph } from './validate.js'

export { canonicalizeDeclarationState }

export function buildDeclarations ({ state }) {
  const canonicalState = state.nameOverrides && state.structuralAliasTargets
    ? state
    : canonicalizeDeclarationState({ state })
  const graph = buildDeclarationGraph({ state: canonicalState })

  validateDeclarationGraph({ graph })

  return renderDeclarationGraph({ graph })
}

export function renderDeclarations ({ declarations, rootName }) {
  const lines = []

  for (const [index, declaration] of declarations.entries()) {
    if (declaration.comment) {
      lines.push(...renderCommentBlock({ lines: declaration.comment }))
    }

    if (declaration.kind === 'interface') {
      const extendsClause = declaration.extends?.length > 0
        ? ` extends ${declaration.extends.join(', ')}`
        : ''
      lines.push(`interface ${declaration.name}${extendsClause} {`)
      lines.push(...declaration.bodyLines)
      lines.push('}')
    } else {
      lines.push(`type ${declaration.name} = ${declaration.value};`)
    }

    const nextDeclaration = declarations[index + 1]
    if (nextDeclaration && declaration.kind === 'interface' && !nextDeclaration.comment) {
      lines.push('')
    }
  }

  lines.push('')
  lines.push(`export { ${rootName} };`)

  return `${lines.join('\n')}\n`
}
