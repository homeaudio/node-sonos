import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.selectQueue().then(response => {
  console.log(response)
})
