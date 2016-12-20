import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.getFavoritesRadioStations({}).then(data => {
  console.log(data)
})

sonos.getFavoritesRadioShows({}).then(data => {
  console.log(data)
})
