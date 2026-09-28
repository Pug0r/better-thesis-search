import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import './App.css'

const interfaceText = {
  pl: {
    title: '(nieoficjalna) Przeglądarka prac dyplomowych Uniwersytetu Jagiellońskiego',
    information: 'Informacje',
    informationBody: ['Narzędzie przeszukuje publicznie dostępne prace dyplomowe Uniwersytetu Jagiellońskiego.', 'Dane są obecnie odświeżane na żądanie.'],
    type: 'Rodzaj pracy',
    year: 'Rok publikacji',
    department: 'Wydział',
    language: 'Język',
    searchPlaceholder: 'Szukaj po tytule, autorze, uczelni...',
    searchAria: 'Szukaj prac',
    clear: 'Wyczyść wyszukiwanie',
    singular: 'praca',
    plural: 'prac',
    unavailable: 'Indeks wyszukiwania niedostępny',
    rebuild: 'Uruchom ponownie kompilację aplikacji.',
    noResults: 'Nie znaleziono wyników',
    start: 'Rozpocznij wyszukiwanie',
    tryAgain: 'Spróbuj zmienić frazę lub filtry.',
    searchHint: 'Wyszukaj po tytule, autorze lub słowach kluczowych.',
    loading: 'Ładowanie indeksu…',
    preparing: 'Przygotowywanie lokalnego indeksu wyszukiwania.',
    author: 'Autor',
    advisor: 'Promotor',
    open: 'Idź do pracy',
    localeSwitchLabel: 'Zmień na English',
  },
  en: {
    title: '(unofficial) Jagiellonian University thesis browser',
    information: 'Information',
    informationBody: ['This tool searches publicly available Jagiellonian University theses.', 'The data is currently refreshed on demand.'],
    type: 'Thesis type',
    year: 'Publication year',
    department: 'Faculty',
    language: 'Language',
    searchPlaceholder: 'Search by title, author, university...',
    searchAria: 'Search theses',
    clear: 'Clear search',
    singular: 'thesis',
    plural: 'theses',
    unavailable: 'Search index unavailable',
    rebuild: 'Run the application build again.',
    noResults: 'No results found',
    start: 'Start searching',
    tryAgain: 'Try changing the phrase or filters.',
    searchHint: 'Search by title, author, or keywords.',
    loading: 'Loading index…',
    preparing: 'Preparing the local search index.',
    author: 'Author',
    advisor: 'Advisor',
    open: 'Open thesis',
    localeSwitchLabel: 'Zmień na Polski',
  },
}

const typeLabels = {
  pl: { master: 'Praca magisterska', bachelor: 'Praca licencjacka' },
  en: { master: "Master's thesis", bachelor: "Bachelor's thesis" },
}

const DEBOUNCE_MS = 150
const MAX_RESULTS = 1000

function SearchApp() {
  const [catalog, setCatalog] = useState({ index: null, error: null })
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef(null)
  const updateQuery = (value) => {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), DEBOUNCE_MS)
  }
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [infoOpen, setInfoOpen] = useState(false)
  const [locale, setLocale] = useState('pl')
  const copy = interfaceText[locale]
  const labels = typeLabels[locale]
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const toggleFilter = (setSelected, value) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const facets = useMemo(() => {
    if (!catalog.index) return { departments: [], languages: [], types: [], years: [] }
    const records = catalog.index.search(MiniSearch.wildcard)
    const values = (field) => [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)))
    return {
      departments: values('department'),
      languages: values('language'),
      types: values('type'),
      years: values('year').map(String).sort((left, right) => Number(right) - Number(left)),
    }
  }, [catalog.index])
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}search-manifest.json`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Manifest unavailable')))
      .then((manifest) => fetch(`${base}${manifest.file}`))
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('Index unavailable')))
      .then((jsonString) => {
        const index = MiniSearch.loadJSON(jsonString, { idField: 'id', fields: ['title', 'author', 'advisor', 'reviewers', 'department', 'keywords', 'language'], storeFields: ['id', 'title', 'author', 'advisor', 'reviewers', 'department', 'year', 'keywords', 'language', 'url', 'type'] })
        setCatalog({ index, error: null })
      })
      .catch((error) => setCatalog({ index: null, error }))
  }, [])
  const hasCriteria = debouncedQuery.trim() || selectedTypes.length || selectedYears.length || selectedDepartments.length || selectedLanguages.length
  const results = useMemo(() => {
    if (!catalog.index) return []
    const searchQuery = debouncedQuery.trim() || MiniSearch.wildcard
    const matches = catalog.index.search(searchQuery, {
      prefix: Boolean(debouncedQuery.trim()),
      fuzzy: debouncedQuery.trim() ? 0.2 : false,
      filter: (result) => (!selectedTypes.length || selectedTypes.includes(result.type)) && (!selectedYears.length || selectedYears.includes(String(result.year))) && (!selectedDepartments.length || selectedDepartments.includes(result.department)) && (!selectedLanguages.length || selectedLanguages.includes(result.language)),
    })
    return matches.length > MAX_RESULTS ? matches.slice(0, MAX_RESULTS) : matches
  }, [catalog.index, debouncedQuery, selectedDepartments, selectedLanguages, selectedTypes, selectedYears])
  const rowVirtualizer = useWindowVirtualizer({ count: results.length, estimateSize: () => 190, overscan: 4 })
  return <main className="app-shell">
    <button className="locale-toggle" type="button" aria-label={copy.localeSwitchLabel} title={copy.localeSwitchLabel} onClick={() => setLocale((current) => current === 'pl' ? 'en' : 'pl')}>{locale === 'pl' ? 'EN' : 'PL'}</button>
    <button className="info-button" type="button" onClick={() => setInfoOpen((open) => !open)} aria-expanded={infoOpen} aria-label={copy.information}>i</button>
    {infoOpen && <aside className="info-panel"><p>{copy.informationBody[0]}</p><p>{copy.informationBody[1]}</p></aside>}
    <div className="workspace">
      <div className="page-heading"><h1>{copy.title}</h1></div>
      <aside className="filter-rail"><fieldset><legend>{copy.type}</legend>{facets.types.map((item) => <label key={item}><input type="checkbox" checked={!selectedTypes.length || selectedTypes.includes(item)} onChange={() => toggleFilter(setSelectedTypes, item)} /> <span>{labels[item] || item}</span></label>)}</fieldset><fieldset><legend>{copy.year}</legend>{facets.years.map((item) => <label key={item}><input type="checkbox" checked={selectedYears.includes(item)} onChange={() => toggleFilter(setSelectedYears, item)} /> <span>{item}</span></label>)}</fieldset><fieldset><legend>{copy.department}</legend>{facets.departments.map((item) => <label key={item}><input type="checkbox" checked={selectedDepartments.includes(item)} onChange={() => toggleFilter(setSelectedDepartments, item)} /> <span>{item}</span></label>)}</fieldset><fieldset><legend>{copy.language}</legend>{facets.languages.map((item) => <label key={item}><input type="checkbox" checked={selectedLanguages.includes(item)} onChange={() => toggleFilter(setSelectedLanguages, item)} /> <span>{item}</span></label>)}</fieldset></aside>
      <section className="results-panel" aria-live="polite">
        <div className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder={copy.searchPlaceholder} aria-label={copy.searchAria} autoFocus />{query && <button className="clear-button" type="button" onClick={() => updateQuery('')} aria-label={copy.clear}>×</button>}</div>
        <div className="results-heading"><span>{results.length} {results.length === 1 ? copy.singular : copy.plural}</span></div>
        {catalog.error ? <div className="empty-state"><h2>{copy.unavailable}</h2><p>{copy.rebuild}</p></div> : results.length ? <div className="results-list"><div className="results-spacer" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const result = results[virtualRow.index]; return <article className="result-card" key={result.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={{ transform: `translateY(${virtualRow.start}px)` }}><div className="result-content"><div className="result-header"><span className="result-type">{labels[result.type] || result.type}</span><span className="result-year">{result.year}</span><span className="result-language">{result.language}</span></div><h2>{result.title}</h2><p className="result-author">{copy.author}: {result.author} <span>·</span> {copy.advisor}: {result.advisor}</p><p className="result-department">{result.department}</p><div className="keywords">{result.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><a className="work-button" href={result.url} target="_blank" rel="noreferrer">{copy.open}</a></article> })}</div></div> : <div className="empty-state"><span>⌕</span><h2>{catalog.index ? (hasCriteria ? copy.noResults : copy.start) : copy.loading}</h2><p>{catalog.index ? (hasCriteria ? copy.tryAgain : copy.searchHint) : copy.preparing}</p></div>}
      </section>
    </div>
  </main>
}

export default SearchApp
