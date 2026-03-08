import { createChildRenderContext } from './render-context.js'

export function renderUnionType ({ context, renderType }) {
  return renderCombinatorMembers({
    context,
    members: context.schema.oneOf || context.schema.anyOf,
    separator: ' | ',
    keyword: context.schema.oneOf ? 'oneOf' : 'anyOf',
    renderType
  })
}

export function renderIntersectionType ({ context, renderType }) {
  return renderCombinatorMembers({
    context,
    members: context.schema.allOf,
    separator: ' & ',
    keyword: 'allOf',
    renderType
  })
}

function renderCombinatorMembers ({ context, members, separator, keyword, renderType }) {
  if (!Array.isArray(members) || members.length === 0) {
    return 'unknown'
  }

  return members.map((schema, index) => {
    const memberType = renderType({
      context: createChildRenderContext({
        context,
        schema,
        pathSuffix: `${keyword}/${index}`,
        lookupPathName: false
      })
    })

    return wrapCombinatorMember({ memberType, separator })
  }).join(separator)
}

function wrapCombinatorMember ({ memberType, separator }) {
  if (separator === ' & ' && memberType.includes(' | ')) {
    return `(${memberType})`
  }

  if (separator === ' | ' && memberType.includes(' & ')) {
    return `(${memberType})`
  }

  return memberType
}
