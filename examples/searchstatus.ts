import { search } from '../'

console.log('Searching for Sonos devices...')
const searcher = search()

search(function (sonos) {
  debug("Found Sonos '%s'", sonos.host)
  sonos.currentTrack(function (err, track) {
    if (err) throw err
    console.log(track || 'Nothing Playing')
  })
})
