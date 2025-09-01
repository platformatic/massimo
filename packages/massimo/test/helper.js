const undici = require('undici')

const { setGlobalDispatcher, Agent, request } = undici

setGlobalDispatcher(
  new Agent({
    keepAliveMaxTimeout: 1,
    keepAliveTimeout: 1
  })
)

module.exports = { request }
