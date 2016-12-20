import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.queueNext('http://livingears.com/music/SceneNotHeard/091909/Do You Mind Kyla.mp3').then(playing => {
  console.log(playing)
})
