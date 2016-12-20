import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.getMusicLibrary('sonos_playlists', {start: 0, total: 25}).then(result => {
  console.log(result)
})
