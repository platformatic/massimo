import { getSchemaAtPath, toRefPath } from './pointer.js'
import { createRenderContext } from './render-context.js'

export function renderReferenceType ({ ref, context, renderType }) {
  const path = toRefPath(ref)
  const registeredName = context.nameRegistry.getPathName({ path })
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
