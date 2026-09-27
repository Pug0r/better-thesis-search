import MiniSearch from 'minisearch'
import records from '../src/data.json' with { type: 'json' }

const index = new MiniSearch({
  idField: 'id',
  fields: ['title', 'author', 'advisor', 'department', 'keywords'],
  storeFields: ['id', 'title', 'author', 'advisor', 'department', 'year', 'keywords', 'url', 'type'],
})
index.addAll(records)
const serializedIndex = JSON.stringify(index.toJSON())

// Development-only: serve the same artifact that the production build generates.
export function devSearchIndex() {
  return {
    name: 'dev-search-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/search-index.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.end(serializedIndex)
      })
    },
  }
}
