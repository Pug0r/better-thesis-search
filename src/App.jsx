import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { departments, languages, typeLabels, types, years } from './data'
import './App.css'

function SearchApp() {
  const [catalog, setCatalog] = useState({ index: null, error: null })
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [infoOpen, setInfoOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const listParentRef = useRef(null)
  const toggleFilter = (setSelected, value) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}search-index.json`)
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('Index unavailable')))
      .then((jsonString) => {
        const index = MiniSearch.loadJSON(jsonString, { idField: 'id', fields: ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language'], storeFields: ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type'] })
        setCatalog({ index, error: null })
      })
      .catch((error) => setCatalog({ index: null, error }))
  }, [])
  const hasCriteria = query.trim() || selectedTypes.length || selectedYears.length || selectedDepartments.length || selectedLanguages.length
  useEffect(() => {
    setVisibleCount(10)
  }, [query, selectedTypes, selectedYears, selectedDepartments, selectedLanguages])
  const results = useMemo(() => {
    if (!catalog.index) return []
    const searchQuery = query.trim() || MiniSearch.wildcard
    return catalog.index.search(searchQuery, {
      prefix: Boolean(query.trim()),
      fuzzy: query.trim() ? 0.2 : false,
      filter: (result) => (!selectedTypes.length || selectedTypes.includes(result.type)) && (!selectedYears.length || selectedYears.includes(String(result.year))) && (!selectedDepartments.length || selectedDepartments.includes(result.department)) && (!selectedLanguages.length || selectedLanguages.includes(result.language)),
    })
  }, [catalog.index, query, selectedDepartments, selectedLanguages, selectedTypes, selectedYears])
  const displayedResults = results.slice(0, visibleCount)
  useEffect(() => {
    const list = listParentRef.current
    if (!list || visibleCount >= results.length) return undefined
    const loadOnScroll = () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 160) {
        setVisibleCount((count) => Math.min(count + 10, results.length))
      }
    }
    list.addEventListener('scroll', loadOnScroll)
    return () => list.removeEventListener('scroll', loadOnScroll)
  }, [results.length, visibleCount])
  const rowVirtualizer = useVirtualizer({ count: displayedResults.length, getScrollElement: () => listParentRef.current, estimateSize: () => 190, overscan: 4 })
  return <main className="app-shell">
    <button className="info-button" type="button" onClick={() => setInfoOpen((open) => !open)} aria-expanded={infoOpen} aria-label="Informacje">i</button>
    {infoOpen && <aside className="info-panel"><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.</p><p>Curabitur blandit tempus porttitor. Aenean lacinia bibendum nulla sed consectetur.</p></aside>}
    <div className="workspace">
      <div className="page-heading"><h1>(nieoficjalna) Przeglądarka prac dyplomowych Uniwersytetu Jagiellońskiego</h1></div>
      <aside className="filter-rail"><h2>Filtruj</h2><fieldset><legend>Rodzaj pracy</legend>{types.filter((item) => item.value !== 'all').map((item) => <label key={item.value}><input type="checkbox" checked={!selectedTypes.length || selectedTypes.includes(item.value)} onChange={() => toggleFilter(setSelectedTypes, item.value)} /> <span>{item.label}</span></label>)}</fieldset><fieldset><legend>Rok publikacji</legend>{years.map((item) => <label key={item}><input type="checkbox" checked={selectedYears.includes(item)} onChange={() => toggleFilter(setSelectedYears, item)} /> <span>{item}</span></label>)}</fieldset><fieldset><legend>Wydział</legend>{departments.map((item) => <label key={item}><input type="checkbox" checked={selectedDepartments.includes(item)} onChange={() => toggleFilter(setSelectedDepartments, item)} /> <span>{item}</span></label>)}</fieldset><fieldset><legend>Język</legend>{languages.map((item) => <label key={item}><input type="checkbox" checked={selectedLanguages.includes(item)} onChange={() => toggleFilter(setSelectedLanguages, item)} /> <span>{item}</span></label>)}</fieldset></aside>
      <section className="results-panel" aria-live="polite">
        <div className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po tytule, autorze, uczelni..." aria-label="Szukaj prac" autoFocus />{query && <button className="clear-button" type="button" onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie">×</button>}</div>
        <div className="results-heading"><span>{results.length} {results.length === 1 ? 'praca' : 'prac'}</span><span className="index-note">{displayedResults.length} widocznych</span></div>
        {catalog.error ? <div className="empty-state"><h2>Indeks wyszukiwania niedostępny</h2><p>Uruchom ponownie kompilację aplikacji.</p></div> : displayedResults.length ? <div className="results-list" ref={listParentRef}><div className="results-spacer" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const result = displayedResults[virtualRow.index]; return <article className="result-card" key={result.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={{ transform: `translateY(${virtualRow.start}px)` }}><div className="result-content"><div className="result-header"><span className="result-type">{typeLabels[result.type]}</span><span className="result-year">{result.year}</span><span className="result-language">{result.language}</span></div><h2>{result.title}</h2><p className="result-author">Autor: {result.author} <span>·</span> Promotor: {result.advisor}</p><p className="result-department">{result.department}</p><div className="keywords">{result.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><a className="work-button" href={result.url} target="_blank" rel="noreferrer">Idź do pracy</a></article> })}</div></div> : <div className="empty-state"><span>⌕</span><h2>{catalog.index ? (hasCriteria ? 'Nie znaleziono wyników' : 'Rozpocznij wyszukiwanie') : 'Ładowanie indeksu…'}</h2><p>{catalog.index ? (hasCriteria ? 'Spróbuj zmienić frazę lub filtry.' : 'Wyszukaj po tytule, autorze lub słowach kluczowych.') : 'Przygotowywanie lokalnego indeksu wyszukiwania.'}</p></div>}
      </section>
    </div>
  </main>
}

export default SearchApp
