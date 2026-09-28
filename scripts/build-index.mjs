import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import MiniSearch from 'minisearch'

let records
try {
  records = JSON.parse(await readFile(resolve('public/search-index.json'), 'utf8'))
} catch {
  records = JSON.parse(await readFile(resolve('src/data.json'), 'utf8'))
}

const index = new MiniSearch({
  idField: 'id',
  fields: ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language'],
  storeFields: ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type'],
})
index.addAll(records)

const output = resolve('dist/search-index.json')
await mkdir(resolve('dist'), { recursive: true })
await writeFile(output, JSON.stringify(index.toJSON()))
console.log(`Wrote ${records.length} records to ${output}`)
