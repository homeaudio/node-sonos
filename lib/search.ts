import * as dgram from 'dgram'
import { EventEmitter } from 'events'
import { Sonos } from './sonos'

export interface SearchOptions {

}

/**
 * Emits 'DeviceAvailable' on a Sonos Component Discovery
 */
export class Search extends EventEmitter {

  foundSonosDevices: {}
  socket: dgram.Socket
  pollTimer: NodeJS.Timer
  searchTimer: NodeJS.Timer

  constructor(options: SearchOptions) {
    super()
    this.foundSonosDevices = {}
    const PLAYER_SEARCH = new Buffer(['M-SEARCH * HTTP/1.1',
      'HOST: 239.255.255.250:1900',
      'MAN: ssdp:discover',
      'MX: 1',
      'ST: urn:schemas-upnp-org:device:ZonePlayer:1'].join('\r\n'))
    const sendDiscover = () => {
      ['239.255.255.250', '255.255.255.255'].forEach(addr => {
        this.socket.send(PLAYER_SEARCH, 0, PLAYER_SEARCH.length, 1900, addr)
      })
      // periodically send discover packet to find newly added devices
      this.pollTimer = setTimeout(sendDiscover, 10000)
    }
    this.socket = dgram.createSocket('udp4', (buffer, rinfo) => {
      const bufferStr = buffer.toString()
      if (bufferStr.match(/.+Sonos.+/)) {
        const modelCheck = bufferStr.match(/SERVER.*\((.*)\)/)
        const model = (modelCheck.length > 1 ? modelCheck[1] : null)
        const addr = rinfo.address
        if (!(addr in this.foundSonosDevices)) {
          const sonos = this.foundSonosDevices[addr] = new Sonos(addr)
          this.emit('DeviceAvailable', sonos, model)
        }
      }
    })
    this.socket.on('error', err => {
      this.emit('error', err)
    })
    this.socket.bind(options, () => {
      this.socket.setBroadcast(true)
      sendDiscover()
    })
    if (options.timeout) {
      this.searchTimer = setTimeout(() => {
        this.socket.close()
        this.emit('timeout')
      }, options.timeout)
    }
  }

  /**
   * Destroys Search class, stop searching, clean up
   *
   * @param  {Function} callback ()
   */
  destroy(callback) {
    clearTimeout(this.searchTimer)
    clearTimeout(this.pollTimer)
    this.socket.close(callback)
  }

}


/**
 * Create a Search Instance (emits 'DeviceAvailable' with a found Sonos Component)
 * @param  {Object} options Optional Options to control search behavior.
 *                          Set 'timeout' to how long to search for devices
 *                          (in milliseconds).
 * @param  {Function} listener Optional 'DeviceAvailable' listener (sonos)
 * @return {Search/EventEmitter Instance}
 */
export function search(listener: Function, options = {}) {
  const search = new Search(options)
  if (listener !== null) {
    search.on('DeviceAvailable', listener)
  }
  return search
}
