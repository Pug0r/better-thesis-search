import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import MiniSearch from 'minisearch'

const fields = ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language']
const storeFields = ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type']

let cachedIndex = null
let cachedMtime = 0

export function devSearchIndex() {
  return {
    name: 'dev-search-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/search-manifest.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(JSON.stringify({ file: 'search-index.json' }))
      })

      server.middlewares.use('/search-index.json', async (_request, response, next) => {
        try {
          const source = resolve(server.config.root, 'public/search-index.json')
          const { mtimeMs } = await import('node:fs').then((fs) => fs.statSync(source))
          if (!cachedIndex || mtimeMs !== cachedMtime) {
            const records = JSON.parse(await readFile(source, 'utf8'))
            const index = new MiniSearch({ idField: 'id', fields, storeFields })
            index.addAll(records)
            cachedIndex = JSON.stringify(index.toJSON())
            cachedMtime = mtimeMs
          }
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-cache')
          response.end(cachedIndex)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
