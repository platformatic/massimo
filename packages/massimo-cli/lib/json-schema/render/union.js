import { createChildRenderContext } from './render-context.js'

/**
 * Render a `oneOf` or `anyOf` schema as a TypeScript union.
 */
export function renderUnionType ({ context, renderType }) {
  return renderCombinatorMembers({
    context,
    members: context.schema.oneOf || context.schema.anyOf,
    separator: ' | ',
    keyword: context.schema.oneOf ? 'oneOf' : 'anyOf',
    renderType
  })
}

/**
 * Render an `allOf` schema as a TypeScript intersection.
 */
export function renderIntersectionType ({ context, renderType }) {
  return renderCombinatorMembers({
    context,
    members: context.schema.allOf,
    separator: ' & ',
    keyword: 'allOf',
    renderType
  })
}

/**
 * Render the members of a JSON Schema combinator with the correct child paths and grouping.
 */
function renderCombinatorMembers ({ context, members, separator, keyword, renderType }) {
  if (!Array.isArray(members) || members.length === 0) {
    return null
  }

  const renderedMembers = members.map((schema, index) => {
    const memberType = renderType({
      context: createChildRenderContext({
        context,
        schema,
        pathSuffix: `${keyword}/${index}`,
        lookupPathName: false
      })
    })

    return wrapCombinatorMember({ memberType, separator })
  }).filter(memberType => memberType !== 'unknown')

  if (renderedMembers.length === 0) {
    return null
  }

  return renderedMembers.join(separator)
}

/**
 * Parenthesize combinator members when needed to preserve TypeScript precedence.
 */
function wrapCombinatorMember ({ memberType, separator }) {
  if (separator === ' & ' && memberType.includes(' | ')) {
    return `(${memberType})`
  }

  if (separator === ' | ' && memberType.includes(' & ')) {
    return `(${memberType})`
  }

  return memberType
}
