/**
 * Interfaces and Types
 */

interface Endpoints {
    transport: string
    rendering: string
    device: string
}

interface SonosOptions {
  port?: number
  endpoints?: Partial<Endpoints>
}

interface SearchMusicLibraryOptions {
  start?: string
  total?: string
}

type SearchType = "artists"
                | "albumArtists"
                | "albums"
                | "genres"
                | "composers"
                | "tracks"
                | "playlists"
                | "sonos_playlists"
                | "share"


/**
 * Constants
 */

const DEFAULT_ENDPOINTS: Endpoints = {
  transport: '/MediaRenderer/AVTransport/Control',
  rendering: '/MediaRenderer/RenderingControl/Control',
  device: '/DeviceProperties/Control',
}

const SEARCH_TYPES_TO_SPECIFIER: {[P in SearchType]: string } =  {
  artists: 'A:ARTIST',
  albumArtists: 'A:ALBUMARTIST',
  albums: 'A:ALBUM',
  genres: 'A:GENRE',
  composers: 'A:COMPOSER',
  tracks: 'A:TRACKS',
  playlists: 'A:PLAYLISTS',
  sonos_playlists: 'SQ:',
  share: 'S:',
}

/**
 * Dependencies
 */
import * as util from 'util'

import * as debug from 'debug'
import fetch from 'node-fetch'
import * as _ from 'underscore'
const log = debug('sonos')

import { ContentDirectory, ContentDirectoryBrowseOptions } from './services/ContentDirectory'
import { soapPost, htmlEntities, parseXML } from './utils'
import {isSpotifyUri, optionsFromSpotifyUri } from './spotify'

/**
 * Parse DIDL into track structure
 */
function parseDIDL(didl: string) {
  if ((!didl) || (!didl['DIDL-Lite']) || (!util.isArray(didl['DIDL-Lite'].item)) || (!didl['DIDL-Lite'].item[0])) {
    return {}
  }
  const item = didl['DIDL-Lite'].item[0]
  return {
    title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
    artist: util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
    album: util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
    albumArtURI: util.isArray(item['upnp:albumArtURI']) ? item['upnp:albumArtURI'][0] : null,
  }
}


export class Sonos {

  host: string
  port: number
  endpoints: Endpoints

  /**
   * Sonos Class
   * @param host IP/DNS
   */
  constructor(host: string, options: SonosOptions = {}) {
    this.host = host
    this.port = options.port || 1400
    const endpoints = options.endpoints || {}
    this.endpoints = {...DEFAULT_ENDPOINTS, ...endpoints}
  }

  /**
   * UPnP HTTP Request
   * @param  {String}   endpoint    HTTP Path
   * @param  {String}   action      UPnP Call/Function/Action
   * @param  {String}   body
   * @param  {String}   responseTag Expected Response Container XML Tag
   */
  private request(endpoint: string, action: string, body: string, responseTag: string) {
    log('Sonos.request(%j, %j, %j, %j, %j)', endpoint, action, body, responseTag)
    return soapPost(this.host, this.port, endpoint, action, body, responseTag)
  }

  private transportRequest(name: string, bodyContent= '') {
    const action = `"urn:schemas-upnp-org:service:AVTransport:1#${name}"`
    const body = `<u:${name} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>${bodyContent}</u:${name}>`
    return this.request(this.endpoints.transport, action, body, `u:${name}Response`)
  }

  private async transportCommand(name: string, bodyContent = '') {
    const data = await this.transportRequest(name, bodyContent)
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({ err, data })
    }
  }

  private deviceRequest(name: string, bodyContent = '') {
    const action = `"urn:schemas-upnp-org:service:DeviceProperties:1#${name}"`
    const body = `<u:${name} xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1">${bodyContent}</u:${name}>`
    return this.request(this.endpoints.device, action, body, `u:${name}Response`)
  }

  private renderingRequest(name: string, bodyContent = '') {
    const action = `"urn:schemas-upnp-org:service:RenderingControl:1#${name}"`
    const body = `<u:${name} xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel>${bodyContent}</u:${name}>`
    return this.request(this.endpoints.rendering, action, body, `u:${name}Response`)
  }

  private async browseContentDirectory(options: Partial<ContentDirectoryBrowseOptions>) {
    const defaultOptions: ContentDirectoryBrowseOptions = {
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '100',
      SortCriteria: '',
      ObjectID: '',
    }
    const contentDirectory = new ContentDirectory(this.host, this.port)
    const data = await contentDirectory.Browse({...defaultOptions, ...options})
    const didl = await parseXML(data['Result'])
    if (!didl['DIDL-Lite']) {
      throw new Error('Cannot parse DIDTL result')
    }
    return didl['DIDL-Lite']
  }

  /**
   * Get Music Library Information
   * @param  {String}   searchType  Choice - artists, albumArtists, albums, genres, composers, tracks, playlists, share
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  getMusicLibrary(searchType: SearchType, options) {
    return this.searchMusicLibrary(searchType, null, options)
  }

  /**
   * Get Music Library Information
   * @param  {String}   searchType  Choice - artists, albumArtists, albums, genres, composers, tracks, playlists, share
   * @param  {String}   searchTerm  Optional - search term to search for
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   */
  async searchMusicLibrary(searchType: SearchType,
                           searchTerm: string | null, options: SearchMusicLibraryOptions) {

    const browseOptions: Partial<ContentDirectoryBrowseOptions> = {
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '100',
      SortCriteria: '',
      ObjectID: '',
    }

    let searchSpecifier = SEARCH_TYPES_TO_SPECIFIER[searchType]
    const opensearch = (!searchTerm) || (searchTerm === '')
    if (!opensearch) {
      searchSpecifier = searchSpecifier.concat(':' + searchTerm)
    }
    browseOptions.ObjectID = searchSpecifier

    if (options.start !== undefined) {
      browseOptions.StartingIndex = options.start
    }

    if (options.total !== undefined) {
      browseOptions.RequestedCount = options.total
    }
    const data = this.browseContentDirectory(browseOptions)
    const resultcontainer: any[] = opensearch ? data['container'] : data['item']
    if (!util.isArray(resultcontainer)) {
      throw new Error('Cannot parse DIDTL result')
    }

    const items = resultcontainer.map(item => {
      let albumArtURL: string | null = null
      if (util.isArray(item['upnp:albumArtURI'])) {
        if (item['upnp:albumArtURI'][0].indexOf('http') !== -1) {
          albumArtURL = item['upnp:albumArtURI'][0]
        } else {
          albumArtURL = 'http://' + this.host + ':' + this.port + item['upnp:albumArtURI'][0]
        }
      }
      return {
        title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
        artist: util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
        albumArtURL,
        album: util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
        uri: util.isArray(item.res) ? item.res[0]._ : null,
      }
    })
    return {
      returned: data['NumberReturned'],
      total: data['TotalMatches'],
      items,
    }
  }

  /**
   *  Get queue
   */
  async getQueue() {
    const data = await this.browseContentDirectory({
      ObjectID: 'Q:0',
      RequestedCount: '1000',
    })
    const resultcontainer = data['item']
    if (!util.isArray(resultcontainer)) {
      throw new Error('Cannot parse DIDTL result')
    }
    const items = _.map(resultcontainer, item => {
      let albumArtURL: string | null = null
      if (util.isArray(item['upnp:albumArtURI'])) {
        if (item['upnp:albumArtURI'][0].indexOf('http') !== -1) {
          albumArtURL = item['upnp:albumArtURI'][0]
        } else {
          albumArtURL = 'http://' + this.host + ':' + this.port + item['upnp:albumArtURI'][0]
        }
      }
      return {
        title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
        artist: util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
        albumArtURL,
        album: util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
        uri: util.isArray(item.res) ? item.res[0]._ : null,
      }
    })
    return {
      returned: data['NumberReturned'],
      total: data['TotalMatches'],
      items,
    }
  }

  /**
   * Get Current Track
   */
  async getCurrentTrack() {
    log('Sonos.currentTrack()')
    const data = await this.transportRequest('GetPositionInfo')
    if ((!util.isArray(data)) || (data.length < 1)) {
      return {}
    }
    const metadata = data[0].TrackMetaData
    const position = (parseInt(data[0].RelTime[0].split(':')[0], 10) * 60 * 60) +
      (parseInt(data[0].RelTime[0].split(':')[1], 10) * 60) +
      parseInt(data[0].RelTime[0].split(':')[2], 10)
    const duration = (parseInt(data[0].TrackDuration[0].split(':')[0], 10) * 60 * 60) +
      (parseInt(data[0].TrackDuration[0].split(':')[1], 10) * 60) +
      parseInt(data[0].TrackDuration[0].split(':')[2], 10)
    const trackUri = data[0].TrackURI ? data[0].TrackURI[0] : null
    if ((metadata) && (metadata[0].length > 0) && metadata[0] !== 'NOT_IMPLEMENTED') {
      const metadataData = await parseXML(metadata)
      const track = parseDIDL(metadataData)
      track.position = position
      track.duration = duration
      track.albumArtURL = !track.albumArtURI ? null
        : (track.albumArtURI.indexOf('http') !== -1) ? track.albumArtURI
          : 'http://' + this.host + ':' + this.port + track.albumArtURI
      if (trackUri) {
        track.uri = trackUri
      }
      return track
    } else {
      const track = { position, duration }
      if (data[0].TrackURI) {
        track.uri = data[0].TrackURI[0]
      }
      return track
    }
  }

  /**
   * Get Current Volume
   */
  async getVolume() {
    log('Sonos.getVolume()')
    const data = await this.renderingRequest('GetVolume')
    return parseInt(data[0].CurrentVolume[0], 10)
  }

  /**
   * Set Volume
   * @param  {String}   volume 0..100
   */
  setVolume(volume: string) {
    log('Sonos.setVolume(%j)', volume)
    const bodyContent = '<DesiredVolume>' + volume + '</DesiredVolume></u:SetVolume>'
    return this.renderingRequest('SetVolume', bodyContent)
  }

  /**
   * Get Current Muted
   */
  async getMuted() {
    log('Sonos.getMuted()')
    const data = await this.renderingRequest('GetMute')
    return !!parseInt(data[0].CurrentMute[0], 10)
  }

  /**
   * Set Muted
   */
  setMuted(muted: boolean) {
    log('Sonos.setMuted(%j)')
    const bodyContent = '<DesiredMute>' + (muted ? '1' : '0') + '</DesiredMute>'
    return this.renderingRequest('SetMute', bodyContent)
  }

  /**
   * Resumes Queue or Plays Provided URI
   * @param  {String|Object}   uri      Optional - URI to a Audio Stream or Object with play options
   */
  async play(uri?: string, metadata = '') {
    log('Sonos.play(%j, %j)', uri, metadata)
    if (uri) {
      // check if it's a spotify uri
      let queueResult
      if (isSpotifyUri(uri)) {
        queueResult = await this.queue(optionsFromSpotifyUri(uri))
      } else {
        queueResult = await this.queue({ uri, metadata })
      }
      if (queueResult.length < 0 || !queueResult[0].FirstTrackNumberEnqueued) {
        // TODO is this error accurate?
        throw new Error('Queuing was unsucessful')
      }
      const selectTrackNum = queueResult[0].FirstTrackNumberEnqueued[0]
      await this.selectTrack(selectTrackNum)
      return this.play()
    } else {
      return this.transportCommand('Play', '<Speed>1</Speed>')
    }
  }

  /**
   * Pause Current Queue
   */
  pause() {
    log('Sonos.pause()')
    return this.transportCommand('Pause', '<Speed>1</Speed>')
  }

  /**
   * Stop What's Playing
   */
  stop() {
    log('Sonos.stop()')
    return this.transportCommand('Stop', '<Speed>1</Speed>')
  }

  /**
   * Seek the current track
   */
  seek(seconds: number) {
    log('Sonos.seek(%j)', seconds)
    let hh = Math.floor(seconds / 3600)
    let mm = Math.floor((seconds - (hh * 3600)) / 60)
    let ss = seconds - ((hh * 3600) + (mm * 60))
    if (hh < 10) {
      hh = '0' + hh
    }
    if (mm < 10) {
      mm = '0' + mm
    }
    if (ss < 10) {
      ss = '0' + ss
    }
    return this.transportCommand('Seek', '<Unit>REL_TIME</Unit><Target>' + hh + ':' + mm + ':' + ss + '</Target>')
  }

  /**
   * Play next in queue
   */
  next() {
    log('Sonos.next()')
    return this.transportCommand('Next', '<Speed>1</Speed>')
  }

  /**
   * Play previous in queue
   */
  previous() {
    log('Sonos.previous()')
    return this.transportCommand('Previous', '<Speed>1</Speed>')
  }

  /**
   * Select specific track in queue
   * @param  {Number}   trackNr    Number of track in queue (optional, indexed from 1)
   */
  selectTrack(trackNr = 1) {
    log(`Sonos.selectTrack(${trackNr}`)
    return this.transportCommand('Seek', '<Unit>TRACK_NR</Unit><Target>' + trackNr + '</Target>')
  }

  /**
   * Select Queue. Mostly required after turning on the speakers otherwise play, setPlaymode and other commands will fail.
   */
  async selectQueue() {
    log('Sonos.selectQueue()')
    const zoneData = await this.getZoneInfo()
    const bodyContent = '<CurrentURI>x-rincon-queue:RINCON_' + zoneData.MACAddress.replace(/:/g, '') + '0' + this.port + '#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>'
    return this.transportCommand('SetAVTransportURI', bodyContent)
  }

  /**
   * Queue a Song Next
   * @param   uri      URI to Audio Stream
   * @param   metadata  optional metadata about the audio stream
   */
  queueNext(opts: { uri: string, metadata?: string}) {
    log(`Sonos.queueNext(${opts})`)
    const bodyContent = `<CurrentURI>${opts.uri}</CurrentURI><CurrentURIMetaData>${htmlEntities(opts.metadata ? opts.metadata : '')}</CurrentURIMetaData></u:SetAVTransportURI>`
    return this.transportRequest('SetAVTransportURI', bodyContent)
  }

  /**
   * Add a song to the queue.
   * @param  {String}   uri             URI to Audio Stream
   * @param  {Number}   positionInQueue Position in queue at which to add song (optional, indexed from 1,
   *                                    defaults to end of queue, 0 to explicitly set end of queue)
   */
  queue(options: { uri: string, metadata?: string, positionInQueue?: number }) {
    log('Sonos.queue(%j)', options)
    const defaultOptions = {
      metadata: '',
      positionInQueue: 0,
    }
    options = { ...defaultOptions, ...options }
    const bodyContent = '<EnqueuedURI>' + options.uri + '</EnqueuedURI><EnqueuedURIMetaData>' + options.metadata + '</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>' + options.positionInQueue + '</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>1</EnqueueAsNext>'
    return this.transportRequest('AddURIToQueue', bodyContent)
  }

  /**
   * Flush queue
   * @param  {Function} callback (err, flushed)
   */
  flush() {
    log('Sonos.flush()')
    return this.transportRequest('RemoveAllTracksFromQueue')
  }

  /**
   * Become Coordinator of Standalone Group
   */
  becomeCoordinatorOfStandaloneGroup() {
    log('Sonos.becomeCoordinatorOfStandaloneGroup()')
    return this.transportCommand('BecomeCoordinatorOfStandaloneGroup')
  }

  /**
   * Get the LED State
   */
  async getLEDState(): Promise<"On" | "Off"> {
    log('Sonos.getLEDState()')
    const data = await this.deviceRequest('GetLEDState')
    if (data[0] && data[0].CurrentLEDState && data[0].CurrentLEDState[0]) {
      return data[0].CurrentLEDState[0]
    } else {
      throw new Error('unknown response')
    }
  }

  /**
   * Set the LED State
   */
  setLEDState(desiredState: "On" | "Off") {
    log('Sonos.setLEDState(%j)', desiredState)
    return this.deviceRequest('SetLEDState', '<DesiredLEDState>' + desiredState + '</DesiredLEDState>')
  }

  /**
   * Get Zone Info
   */
  async getZoneInfo() {
    log('Sonos.getZoneInfo()')
    const data = await this.deviceRequest('GetZoneInfo')
    const output = {}
    for (const d in data[0]) {
      if (data[0].hasOwnProperty(d) && d !== '$') {
        output[d] = data[0][d][0]
      }
    }
    return output
  }

  /**
   * Get Zone Attributes
   */
  async getZoneAttrs() {
    log('Sonos.getZoneAttrs()')
    const data = await this.deviceRequest('GetZoneAttributes')
    const output = {}
    for (const d in data[0]) {
      if (data[0].hasOwnProperty(d) && d !== '$') {
        output[d] = data[0][d][0]
      }
    }
    return output
  }

  /**
   * Get Information provided by /xml/device_description.xml
   */
  async getDeviceDescription() {
    log('Sonos.getDeviceDescription()')
    const res = await fetch('http://' + this.host + ':' + this.port + '/xml/device_description.xml')
    if (res.status !== 200) {
      throw new Error('Non-200 response code')
    }
    const json = await parseXML(await res.text())
    const output = {}
    for (const d in json.root.device[0]) {
      if (json.root.device[0].hasOwnProperty(d)) {
        output[d] = json.root.device[0][d][0]
      }
    }
    return output
  }

  /**
   * Set Name
   */
  setName(name: string) {
    log('Sonos.setName(%j)', name)
    name = name.replace(/[<&]/g, (str) => (str === '&') ? '&amp;' : '&lt;')
    const bodyContent = '<DesiredZoneName>' + name + '</DesiredZoneName><DesiredIcon /><DesiredConfiguration />'
    return this.deviceRequest('SetZoneAttributes', bodyContent)
  }

  /**
   * Set Play Mode
   * @param  {String} playmode
   */
  setPlayMode(playmode: 'NORMAL' | 'REPEAT_ALL' | 'SHUFFLE' | 'SHUFFLE_NOREPEAT') {
    log('Sonos.setPlayMode(%j)', playmode)
    const mode = { NORMAL: true, REPEAT_ALL: true, SHUFFLE: true, SHUFFLE_NOREPEAT: true }[playmode.toUpperCase()]
    if (!mode) {
      throw new Error('invalid play mode ' + playmode)
    }
    return this.transportRequest('SetPlayMode', '<NewPlayMode>' + playmode.toUpperCase() + '</NewPlayMode>')
  }

  /**
   * Get Zones in contact with current Zone with Group Data
   */
  async getTopology() {
    log('Sonos.getTopology()')
    const res = await fetch('http://' + this.host + ':' + this.port + '/status/topology')
    log(res.body)
    const topology = await parseXML(await res.text())
    const info = topology.ZPSupportInfo
    let zones = null
    let mediaServers = null
    if (info.ZonePlayers && info.ZonePlayers.length > 0) {
      zones = _.map(info.ZonePlayers[0].ZonePlayer, (zone) => _.extend(zone.$, {name: zone._}))
    }
    if (info.MediaServers && info.MediaServers.length > 0) {
      mediaServers = _.map(info.MediaServers[0].MediaServer, function (zone) {
        return _.extend(zone.$, {name: zone._})
      })
    }
    return {
      zones,
      mediaServers,
    }
  }

  /**
   * Get Current Playback State
   */
  async getCurrentState() {
    log('Sonos.getCurrentState()')
    const data = await this.transportRequest('GetTransportInfo')
    const statesToString = {
      STOPPED: 'stopped',
      PLAYING: 'playing',
      PAUSED_PLAYBACK: 'paused',
      TRANSITIONING: 'transitioning',
      NO_MEDIA_PRESENT: 'no_media',
    }
    const state = data[0].CurrentTransportState[0]
    return statesToString[state]
  }

  /**
   * Get Favorites Radio for a given radio type
   * @param  {String}   favoriteRadioType  Choice - stations, shows
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   */
  private async getFavoritesRadio(favoriteRadioType: 'stations' | 'shows', options) {
    const radioTypes = {
      stations: 'R:0/0',
      shows: 'R:0/1',
    }
    const opts: Partial<ContentDirectoryBrowseOptions> = {
      ObjectID: radioTypes[favoriteRadioType],
    }
    if (options.start !== undefined) {
      opts.StartingIndex = options.start
    }
    if (options.total !== undefined) {
      opts.RequestedCount = options.total
    }
    const data = await this.browseContentDirectory(opts)
    const resultcontainer = data['item']
    if (!util.isArray(resultcontainer)) {
      throw new Error('Cannot parse DIDTL result')
    }
    const items = _.map(resultcontainer, item => {
      return {
        title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
        uri: util.isArray(item.res) ? item.res[0]._ : null,
      }
    })
    return {
      returned: data['NumberReturned'],
      total: data['TotalMatches'],
      items,
    }
  }

  /**
   * Get Favorites Radio Stations
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   */
  getFavoritesRadioStations(options) {
    return this.getFavoritesRadio('stations', options)
  }

  /**
   * Get Favorites Radio Shows
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   */
  getFavoritesRadioShows(options) {
    return this.getFavoritesRadio('shows', options)
  }

  /**
   * Add a song from spotify to the queue
   * @param  trackId      The spotify track ID
   */
  queueSpotifyTrack(trackId: string) {
    return this.queue(optionsFromSpotifyUri(`spotify:track:${trackId}`))
  }

  /**
   * Plays Spotify radio based on artist uri
   */
  async playSpotifyRadio(artistId: string, artistName: string) {
    log('Sonos.playSpotifyRadio(%j, %j)', artistId, artistName)
    return this.queueNext(optionsFromSpotifyUri('spotify:artistRadio:' + artistId, artistName))
  }

}
