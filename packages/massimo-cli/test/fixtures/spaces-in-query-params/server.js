import Fastify from 'fastify'

export async function buildApp () {
  const app = Fastify()
  app.get('/search', async (request) => {
    const queryString = request.raw.url.split('?', 2)[1] ?? ''
    const rawQueryValue = queryString
      .split('&')
      .find(value => value.startsWith('query='))
      ?.slice('query='.length)

    return { received: decodeURIComponent(rawQueryValue ?? '') }
  })
  return app
}
