import MiniSearch from 'minisearch'

export const theses = [
  { id: 1, title: 'Designing for trust in algorithmic decision systems', author: 'Maya Chen', university: 'Stanford University', year: 2024, type: 'Master’s thesis' },
  { id: 2, title: 'The quiet infrastructure of neighborhood libraries', author: 'Jon Bell', university: 'University of Chicago', year: 2023, type: 'Doctoral dissertation' },
  { id: 3, title: 'Climate adaptation at the edge of the city', author: 'Nadia Okafor', university: 'MIT', year: 2024, type: 'Master’s thesis' },
  { id: 4, title: 'Learning to see: computer vision for ecological monitoring', author: 'Elliot Park', university: 'University of Washington', year: 2022, type: 'Doctoral dissertation' },
  { id: 5, title: 'A history of open access in the humanities', author: 'Clara Rodriguez', university: 'New York University', year: 2021, type: 'Master’s thesis' },
  { id: 6, title: 'Public transit as a platform for belonging', author: 'Samira Haddad', university: 'University of Toronto', year: 2023, type: 'Master’s thesis' },
  { id: 7, title: 'Interfaces for remembering disappearing languages', author: 'Noah Williams', university: 'University of Edinburgh', year: 2020, type: 'Doctoral dissertation' },
  { id: 8, title: 'The economics of repair cafés', author: 'Ines Martin', university: 'TU Delft', year: 2024, type: 'Master’s thesis' },
  { id: 9, title: 'Small data, deep stories', author: 'Priya Shah', university: 'University of Michigan', year: 2022, type: 'Master’s thesis' },
  { id: 10, title: 'Water, memory, and the post-industrial river', author: 'Luca Bianchi', university: 'University of Amsterdam', year: 2019, type: 'Doctoral dissertation' },
  { id: 11, title: 'Making room for rest in the working city', author: 'Ari Thompson', university: 'Columbia University', year: 2023, type: 'Master’s thesis' },
  { id: 12, title: 'The life of a dataset after publication', author: 'Keiko Tanaka', university: 'University of Melbourne', year: 2021, type: 'Doctoral dissertation' },
]

export const searchIndex = new MiniSearch({
  fields: ['title', 'author', 'university'],
  storeFields: ['title', 'author', 'university', 'year', 'type'],
})
searchIndex.addAll(theses)

export const types = ['All types', 'Master’s thesis', 'Doctoral dissertation']
export const years = ['2024 and newer', '2023 and newer', '2022 and newer']
