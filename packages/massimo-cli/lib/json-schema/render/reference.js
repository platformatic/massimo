import { getSchemaAtPath, toRefPath } from '../core/pointer.js'
import { createRenderContext } from './render-context.js'
import { getAliasTargetName } from '../core/scanner.js'

/**
 * Render a `$ref` either as a named alias target or by recursively rendering the referenced schema.
 */
export function renderReferenceType ({ ref, context, renderType }) {
  const path = toRefPath(ref)
  const aliasTargetName = getAliasTargetName({ path, state: context })
  if (aliasTargetName) {
    return aliasTargetName
  }

  const registeredName = context.nameOverrides?.get(path) || context.nameRegistry.getPathName({ path })
  if (registeredName) {
    return registeredName
  }

  const targetSchema = getSchemaAtPath({ schema: context.rootSchema, path })
  if (!targetSchema) {
    return 'unknown'
  }

  return renderType({
    context: createRenderContext({
      schema: targetSchema,
      state: context,
      path,
      lookupPathName: false
    })
  })
}
