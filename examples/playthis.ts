import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')

sonos.play('https://archive.org/download/testmp3testfile/mpthreetest.mp3').then(playing => {
  console.log(playing)
})
