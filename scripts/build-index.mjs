import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import MiniSearch from 'minisearch'
import records from '../src/data.json' with { type: 'json' }

const index = new MiniSearch({
  idField: 'id',
  fields: ['title', 'author', 'advisor', 'department', 'keywords'],
  storeFields: ['id', 'title', 'author', 'advisor', 'department', 'year', 'keywords', 'url', 'type'],
})
index.addAll(records)

const output = resolve('dist/search-index.json')
await mkdir(resolve('dist'), { recursive: true })
await writeFile(output, JSON.stringify(index.toJSON()))
console.log(`Wrote ${records.length} records to ${output}`)
