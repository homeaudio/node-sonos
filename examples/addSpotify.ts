import { Sonos } from '../'
const sonos = new Sonos(process.env.SONOS_HOST || '192.168.2.11')
const spotifyTrackTd = '5AdoS3gS47x40nBNlNmPQ8' // slayer ftw

sonos.queueSpotifyTrack(spotifyTrackTd).then(res => {
  console.log(res)
})
