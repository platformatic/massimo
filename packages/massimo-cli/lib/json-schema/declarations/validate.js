/**
 * Validate the declaration graph before text rendering so invalid output fails fast.
 */
export function validateDeclarationGraph ({ graph }) {
  const nameSignatures = new Map()

  for (const node of graph.nodes.values()) {
    for (const dependencyId of node.dependencyIds) {
      if (!graph.nodes.has(dependencyId)) {
        throw new Error(`Missing declaration dependency: ${dependencyId}`)
      }
    }

    const signature = getDeclarationSignature({ declaration: node.declaration })
    const existingSignature = nameSignatures.get(node.declaration.name)
    if (existingSignature && existingSignature !== signature) {
      throw new Error(`Conflicting declaration emitted for ${node.declaration.name}`)
    }
    nameSignatures.set(node.declaration.name, signature)

    if (isSelfReferentialAliasDeclaration({ declaration: node.declaration })) {
      throw new Error(`Invalid self-referential alias emitted for ${node.declaration.name}`)
    }
  }

  validateDeclarationGraphCycles({ graph })
}

/**
 * Reject declaration graphs that contain dependency cycles.
 */
function validateDeclarationGraphCycles ({ graph }) {
  const visiting = new Set()
  const visited = new Set()

  function visit (id) {
    if (visited.has(id)) {
      return
    }

    if (visiting.has(id)) {
      throw new Error(`Declaration cycle detected at ${id}`)
    }

    visiting.add(id)
    const node = graph.nodes.get(id)
    for (const dependencyId of node?.dependencyIds || []) {
      visit(dependencyId)
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.nodes.keys()) {
    visit(id)
  }
}

/**
 * Build a comparable signature for duplicate-declaration detection.
 */
function getDeclarationSignature ({ declaration }) {
  return JSON.stringify({
    ...declaration,
    dependencyPaths: undefined,
    skipDependencies: undefined
  })
}

/**
 * Detect alias declarations that directly point back to themselves.
 */
function isSelfReferentialAliasDeclaration ({ declaration }) {
  if (!declaration || declaration.kind !== 'type') {
    return false
  }

  const escapedName = declaration.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escapedName}\\b`).test(declaration.value)
}
