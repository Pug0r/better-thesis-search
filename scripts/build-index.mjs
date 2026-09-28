import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import MiniSearch from 'minisearch'

const records = JSON.parse(await readFile(resolve('public/search-index.json'), 'utf8'))

const index = new MiniSearch({
  idField: 'id',
  fields: ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language'],
  storeFields: ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type'],
})
index.addAll(records)

const content = JSON.stringify(index.toJSON())
const hash = createHash('sha256').update(content).digest('hex').slice(0, 12)
const filename = `search-index.${hash}.json`

await mkdir(resolve('dist'), { recursive: true })
await writeFile(resolve('dist', filename), content)
await writeFile(resolve('dist/search-manifest.json'), JSON.stringify({ file: filename }) + '\n')
console.log(`Wrote ${records.length} records to dist/${filename}`)
