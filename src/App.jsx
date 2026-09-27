import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { typeLabels, types, years } from './data'
import './App.css'

function SearchApp() {
  const [catalog, setCatalog] = useState({ index: null, error: null })
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [year, setYear] = useState('Any year')
  const [activeTab, setActiveTab] = useState('find')
  const [savedIds, setSavedIds] = useState([])
  const listParentRef = useRef(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}search-index.json`)
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('Index unavailable')))
      .then((jsonString) => {
        const index = MiniSearch.loadJSON(jsonString, { idField: 'id', fields: ['title', 'author', 'advisor', 'department', 'keywords'], storeFields: ['id', 'title', 'author', 'advisor', 'department', 'year', 'keywords', 'url', 'type'] })
        setCatalog({ index, error: null })
      })
      .catch((error) => setCatalog({ index: null, error }))
  }, [])
  const results = useMemo(() => {
    if (!catalog.index) return []
    const searchQuery = query.trim() || MiniSearch.wildcard
    return catalog.index.search(searchQuery, {
      prefix: Boolean(query.trim()),
      fuzzy: query.trim() ? 0.2 : false,
      filter: (result) => (type === 'all' || result.type === type) && (year === 'Any year' || result.year >= Number(year)) && (activeTab === 'find' || savedIds.includes(result.id)),
    })
  }, [activeTab, catalog.index, query, savedIds, type, year])
  const rowVirtualizer = useVirtualizer({ count: results.length, getScrollElement: () => listParentRef.current, estimateSize: () => 168, overscan: 4 })
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href={import.meta.env.BASE_URL} aria-label="Index home"><span className="brand-mark">i</span> Index</a><span className="offline-status"><span className="status-dot" /> Local library</span></header>
    <div className="workspace">
      <aside className="filter-rail"><h2>Filter by</h2><fieldset><legend>Document type</legend>{types.map((item) => <label key={item.value}><input type="checkbox" checked={type === item.value} onChange={() => setType(item.value)} /> <span>{item.label}</span></label>)}</fieldset><fieldset><legend>Published</legend>{years.map((item) => { const value = item.slice(0, 4); return <label key={item}><input type="checkbox" checked={year === value} onChange={() => setYear(year === value ? 'Any year' : value)} /> <span>{item}</span></label> })}</fieldset></aside>
      <section className="results-panel" aria-live="polite">
        <nav className="tabs" aria-label="Thesis views"><button className={activeTab === 'find' ? 'active' : ''} onClick={() => setActiveTab('find')}>Find a thesis</button><button className={activeTab === 'saved' ? 'active' : ''} onClick={() => setActiveTab('saved')}>Saved theses {savedIds.length > 0 && <span>{savedIds.length}</span>}</button></nav>
        <div className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, author, university..." aria-label="Search theses" autoFocus />{query && <button className="clear-button" type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
        <div className="results-heading"><span>{results.length} {results.length === 1 ? 'thesis' : 'theses'}</span><span className="index-note">{activeTab === 'saved' ? 'your saved list' : 'all records'}</span></div>
        {catalog.error ? <div className="empty-state"><h2>Search index unavailable</h2><p>Rebuild the app to generate the local index.</p></div> : results.length ? <div className="results-list" ref={listParentRef}><div className="results-spacer" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const result = results[virtualRow.index]; const saved = savedIds.includes(result.id); return <article className="result-card" key={result.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={{ transform: `translateY(${virtualRow.start}px)` }}><div className="result-content"><h2>{result.title}</h2><p className="result-status">{typeLabels[result.type]} <span>·</span> {result.year}</p><div className="result-details"><span><b>Author</b>{result.author}</span><span><b>Department</b>{result.department}</span></div></div><button className={`save-button ${saved ? 'saved' : ''}`} type="button" onClick={() => setSavedIds((current) => saved ? current.filter((id) => id !== result.id) : [...current, result.id])}>{saved ? 'Saved' : 'Save thesis'}</button></article> })}</div></div> : <div className="empty-state"><span>⌕</span><h2>{catalog.index ? 'No matches found' : 'Loading index…'}</h2><p>{catalog.index ? 'Try a broader search or save a thesis from the main list.' : 'Preparing the local search index.'}</p></div>}
      </section>
    </div>
  </main>
}

export default SearchApp
