import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import MiniSearch from 'minisearch'

const fields = ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language']
const storeFields = ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type']

function buildIndex(records) {
  const index = new MiniSearch({ idField: 'id', fields, storeFields })
  index.addAll(records)
  return JSON.stringify(index.toJSON())
}

export function devSearchIndex() {
  return {
    name: 'dev-search-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/search-index.json', async (_request, response, next) => {
        try {
          const source = resolve(server.config.root, 'public/search-index.json')
          const records = JSON.parse(await readFile(source, 'utf8'))
          response.setHeader('Content-Type', 'application/json')
          response.end(buildIndex(records))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
