import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.setVolume(30).then(playing => {
  console.log(playing)
})
