const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_MASSIMO'

const OptionsUrlRequiredError = createError(`${ERROR_PREFIX}_OPTIONS_URL_REQUIRED`, 'options.url is required')
const FormDataRequiredError = createError(
  `${ERROR_PREFIX}_FORM_DATA_REQUIRED`,
  'Operation %s should be called with a undici.FormData as payload'
)
const MissingParamsRequiredError = createError(
  `${ERROR_PREFIX}_MISSING_PARAMS_REQUIRED`,
  "Param %s is missing, and it's required"
)
const WrongOptsTypeError = createError(
  `${ERROR_PREFIX}_WRONG_OPTS_TYPE`,
  'opts.type must be either "openapi" or "graphql"'
)
const InvalidResponseSchemaError = createError(
  `${ERROR_PREFIX}_INVALID_RESPONSE_SCHEMA`,
  'No matching response schema found for status code %s'
)
const InvalidContentTypeError = createError(
  `${ERROR_PREFIX}_INVALID_CONTENT_TYPE`,
  'No matching content type schema found for %s'
)
const InvalidResponseFormatError = createError(
  `${ERROR_PREFIX}_INVALID_RESPONSE_FORMAT`,
  'Invalid response format'
)
const UnexpectedCallFailureError = createError(
  `${ERROR_PREFIX}_UNEXPECTED_CALL_FAILURE`,
  'Unexpected failure calling the client: %s'
)

module.exports = {
  ERROR_PREFIX,
  OptionsUrlRequiredError,
  FormDataRequiredError,
  MissingParamsRequiredError,
  WrongOptsTypeError,
  InvalidResponseSchemaError,
  InvalidContentTypeError,
  InvalidResponseFormatError,
  UnexpectedCallFailureError
}
