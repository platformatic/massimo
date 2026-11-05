import { STATUS_CODES } from 'node:http'
import { getType } from './get-type.js'
import { capitalize, classCase, getResponseContentType, getResponseTypes } from './utils.js'

// The name of the type declared for one response of an operation.
export function getResponseTypeName (operationId, statusCode) {
  const statusCodeName = STATUS_CODES[statusCode]
  // Unrecognized status code
  if (statusCodeName === undefined) {
    return `${operationId}${statusCode}Response`
  }
  return `${operationId}Response${classCase(statusCodeName)}`
}

function responsesWriter (operationId, responsesObject, isFullResponse, writer, spec, schemaNames) {
  const mappedResponses = getResponseTypes(responsesObject)
  const responseTypes = Object.entries(responsesObject).map(([statusCode, response]) => {
    let typeName = getResponseTypeName(operationId, statusCode)
    let isResponseArray
    const responseContentType = getResponseContentType(response)
    if (responseContentType === 'application/json') {
      writeResponse(typeName, response.content['application/json'].schema, response.summary, response.description)
    } else if (responseContentType === null) {
      isFullResponse = true
      writer.writeLine(`export type ${typeName} = unknown`)
    } else if (mappedResponses.blob.includes(parseInt(statusCode))) {
      writer.writeLine(`export type ${typeName} = Blob`)
    } else if (mappedResponses.text.includes(parseInt(statusCode))) {
      writer.writeLine(`export type ${typeName} = string`)
    } else {
      isFullResponse = true
      writer.writeLine(`export type ${typeName} = string`)
    }

    const lowerStatusCode = statusCode.toLowerCase()
    const isStatusCodeRange =
      lowerStatusCode === '1xx' ||
      lowerStatusCode === '2xx' ||
      lowerStatusCode === '3xx' ||
      lowerStatusCode === '4xx' ||
      lowerStatusCode === '5xx'
    if (statusCode === '204') {
      if (isFullResponse) {
        typeName = undefined
      } else {
        return 'undefined'
      }
    }
    if (isResponseArray) typeName = `Array<${typeName}>`
    if (isFullResponse) {
      typeName = `FullResponse<${typeName}, ${isStatusCodeRange ? `StatusCode${lowerStatusCode}` : statusCode}>`
    }
    return typeName
  })
  // write response unions
  if (responseTypes.length) {
    const allResponsesName = `${capitalize(operationId)}Responses`
    writer.writeLine(`export type ${allResponsesName} =`)
    writer.indent(() => {
      if (responseTypes.length > 0) {
        writer.write(responseTypes.join('\n| '))
      } else {
        writer.write('unknown')
      }
    })
    writer.blankLine()
    return allResponsesName
  }
  return 'FullResponse<unknown, 200>'

  function writeResponse (typeName, responseSchema, summary, description) {
    if (!responseSchema) {
      return
    }
    if (description || summary) {
      writer.writeLine('/**')
      if (summary) {
        for (const line of summary.split('\n')) {
          writer.writeLine(` * ${line}`)
        }
        writer.writeLine(' *')
      }
      if (description) {
        for (const line of description.split('\n')) {
          writer.writeLine(` * ${line}`)
        }
      }
      writer.writeLine(' */')
    }
    writer.writeLine(`export type ${typeName} = ${getType(responseSchema, 'res', spec, undefined, schemaNames)}`)
  }
}

export { responsesWriter }
