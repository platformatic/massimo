import { createChildRenderContext } from './render-context.js'

export function renderArrayType ({ context, renderType }) {
  const { schema } = context

  if (!schema.items) {
    return 'Array<unknown>'
  }

  if (Array.isArray(schema.items)) {
    const itemTypes = schema.items.map((itemSchema, index) => {
      return renderType({
        context: createChildRenderContext({
          context,
          schema: itemSchema,
          pathSuffix: `items/${index}`,
          lookupPathName: false
        })
      })
    })

    return `[${itemTypes.join(', ')}]`
  }

  const itemType = renderType({
    context: createChildRenderContext({
      context,
      schema: schema.items,
      pathSuffix: 'items'
    })
  })

  if (itemType.includes(' | ') || itemType.includes(' & ')) {
    return `Array<(${itemType})>`
  }

  return `Array<${itemType}>`
}
