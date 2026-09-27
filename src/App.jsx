import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { typeLabels, types, years } from './data'
import './App.css'

function SearchApp() {
  const [catalog, setCatalog] = useState({ index: null, error: null })
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [year, setYear] = useState('Dowolny rok')
  const [infoOpen, setInfoOpen] = useState(false)
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
      filter: (result) => (type === 'all' || result.type === type) && (year === 'Dowolny rok' || result.year === Number(year)),
    })
  }, [catalog.index, query, type, year])
  const rowVirtualizer = useVirtualizer({ count: results.length, getScrollElement: () => listParentRef.current, estimateSize: () => 168, overscan: 4 })
  return <main className="app-shell">
    <button className="info-button" type="button" onClick={() => setInfoOpen((open) => !open)} aria-expanded={infoOpen} aria-label="Informacje">i</button>
    {infoOpen && <aside className="info-panel"><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.</p><p>Curabitur blandit tempus porttitor. Aenean lacinia bibendum nulla sed consectetur.</p></aside>}
    <div className="workspace">
      <aside className="filter-rail"><h2>Filtruj</h2><fieldset><legend>Rodzaj pracy</legend>{types.map((item) => <label key={item.value}><input type="checkbox" checked={type === item.value} onChange={() => setType(item.value)} /> <span>{item.label}</span></label>)}</fieldset><fieldset><legend>Rok publikacji</legend>{years.map((item) => { const value = item.slice(0, 4); return <label key={item}><input type="checkbox" checked={year === value} onChange={() => setYear(year === value ? 'Dowolny rok' : value)} /> <span>{item}</span></label> })}</fieldset></aside>
      <section className="results-panel" aria-live="polite">
        <div className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po tytule, autorze, uczelni..." aria-label="Szukaj prac" autoFocus />{query && <button className="clear-button" type="button" onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie">×</button>}</div>
        <div className="results-heading"><span>{results.length} {results.length === 1 ? 'praca' : 'prac'}</span><span className="index-note">wszystkie rekordy</span></div>
        {catalog.error ? <div className="empty-state"><h2>Indeks wyszukiwania niedostępny</h2><p>Uruchom ponownie kompilację aplikacji.</p></div> : results.length ? <div className="results-list" ref={listParentRef}><div className="results-spacer" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const result = results[virtualRow.index]; return <article className="result-card" key={result.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={{ transform: `translateY(${virtualRow.start}px)` }}><div className="result-content"><h2>{result.title}</h2><p className="result-status">{typeLabels[result.type]} <span>·</span> {result.year}</p><div className="result-details"><span><b>Autor</b>{result.author}</span><span><b>Wydział</b>{result.department}</span></div></div></article> })}</div></div> : <div className="empty-state"><span>⌕</span><h2>{catalog.index ? 'Nie znaleziono wyników' : 'Ładowanie indeksu…'}</h2><p>{catalog.index ? 'Spróbuj zmienić frazę lub filtry.' : 'Przygotowywanie lokalnego indeksu wyszukiwania.'}</p></div>}
      </section>
    </div>
  </main>
}

export default SearchApp
