import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.getCurrentTrack().then(track => {
  console.log(track)
})
