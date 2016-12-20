import { search } from '../'

console.log('Searching for Sonos devices...')
const searcher = search()

searcher.on('DeviceAvailable', (device, model) => {
  console.log(device, model)
})

// optionally stop searching and destroy after some time
setTimeout(() => {
  console.log('Stop searching for Sonos devices')
  searcher.destroy()
}, 30000)
