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


interface BrowseDirectoryResult {
  Result: string
  NumberReturned: string
  TotalMatches: string
}

interface DIDLLite {
  'DIDL-Lite': {
    item?: DIDLiteMetadata[],
    container?: DIDLiteMetadata[],
  }
}

interface DIDLiteMetadata {
  res?: {
    _: string,
  }
  'dc:title'?: string
  'dc:creator'?: string
  'upnp:album'?: string
  'upnp:albumArtURI'?: string
}

type SearchType = 'artists'
                | 'albumArtists'
                | 'albums'
                | 'genres'
                | 'composers'
                | 'tracks'
                | 'playlists'
                | 'sonos_playlists'
                | 'share'


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
import * as debug from 'debug'
import fetch from 'node-fetch'
import * as _ from 'underscore'
const log = debug('sonos')

import { ContentDirectory, ContentDirectoryBrowseOptions } from './services/ContentDirectory'
import { RenderingControl, AVTransport } from './services'
import { soapPost, parseXML } from './utils'
import { isSpotifyUri, optionsFromSpotifyUri } from './spotify'


export class Sonos {

  host: string
  port: number
  endpoints: Endpoints

  contentDirectory: ContentDirectory
  renderingControl: RenderingControl
  avTransport: AVTransport


  /**
   * Sonos Class
   * @param host IP/DNS
   */
  constructor(host: string, options: SonosOptions = {}) {
    this.host = host
    this.port = options.port || 1400
    const endpoints = options.endpoints || {}
    this.endpoints = {...DEFAULT_ENDPOINTS, ...endpoints}
    this.contentDirectory = new ContentDirectory(this.host, this.port)
    this.renderingControl = new RenderingControl(this.host, this.port)
    this.avTransport = new AVTransport(this.host, this.port)
  }

  /**
   * UPnP HTTP Request
   */
  private request(endpoint: string, serviceName: string, action: string, body: { [key: string]: any }) {
    return soapPost(this.host, this.port, endpoint, serviceName, action, body)
  }

  private deviceRequest(action: string, body: { [key: string]: any } = {}) {
    return this.request(this.endpoints.device, 'DeviceProperties', action, body)
  }

  private renderingRequest(action: string, body: { [key: string]: any } = {}) {
    return this.request(this.endpoints.rendering, 'RenderingControl', action,
      { InstanceID: 0, Channel: 'Master', ...body })
  }

  private parseDIDLForSingleTrack(didl: DIDLLite) {
    const x = didl['DIDL-Lite']
    if (!x.item || !x.item[0]) {
      return {}
    }
    return this.parseDIDLItem(x.item[0])
  }

  /**
   * Parse DIDL into track structure
   */
  private parseDIDLItem(item: DIDLiteMetadata) {

    const dcTitle = item['dc:title']
    const dcCreator = item['dc:creator']
    const album = item['upnp:album']
    const albumArtURI = item['upnp:albumArtURI']

    let albumArtURL: string | null = null
    if (albumArtURI) {
      if (albumArtURI.indexOf('http') !== -1) {
        albumArtURL = albumArtURI
      } else {
        albumArtURL = 'http://' + this.host + ':' + this.port + albumArtURI
      }
    }

    return {
      title: dcTitle ? dcTitle : null,
      artist: dcCreator ? dcCreator : null,
      albumArtURL,
      album: album ? album : null,
      uri: item.res ? item.res._ : null,
    }
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
    const data: BrowseDirectoryResult = await contentDirectory.Browse({...defaultOptions, ...options})
    const didl: DIDLLite = await parseXML(data['Result'])
    if (!didl['DIDL-Lite']) {
      throw new Error('Cannot parse DIDTL result')
    }

    const metadata = didl['DIDL-Lite']
    const resultcontainer = metadata['container'] || metadata['item']
    const items = !resultcontainer ? [] : resultcontainer.map(item => this.parseDIDLItem(item))
    return {
      returned: parseInt(data['NumberReturned'], 10),
      total: parseInt(data['TotalMatches'], 10),
      items,
    }

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
  searchMusicLibrary(searchType: SearchType, searchTerm: string | null,
                     options: SearchMusicLibraryOptions = {}) {

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
    return this.browseContentDirectory(browseOptions)
  }

  /**
   *  Get queue
   */
  getQueue() {
    return this.browseContentDirectory({
      ObjectID: 'Q:0',
      RequestedCount: '1000',
    })
  }

  /**
   * Get Current Track
   */
  async getCurrentTrack() {
    log('Sonos.currentTrack()')
    const data = await this.avTransport.GetPositionInfo()
    const metadata = data.TrackMetaData
    const position = (parseInt(data.RelTime.split(':'), 10) * 60 * 60) +
      (parseInt(data.RelTime.split(':')[1], 10) * 60) +
      parseInt(data.RelTime.split(':')[2], 10)
    const duration = (parseInt(data.TrackDuration.split(':'), 10) * 60 * 60) +
      (parseInt(data.TrackDuration.split(':')[1], 10) * 60) +
      parseInt(data.TrackDuration.split(':')[2], 10)
    const trackUri = data.TrackURI ? data.TrackURI : null
    if ((metadata) && (metadata.length > 0) && metadata !== 'NOT_IMPLEMENTED') {
      const metadataData = await parseXML(metadata)
      const track = this.parseDIDLForSingleTrack(metadataData)
      track.position = position
      track.duration = duration
      if (trackUri) {
        track.uri = trackUri
      }
      return track
    } else {
      const track = { position, duration }
      if (data.TrackURI) {
        track.uri = data.TrackURI
      }
      return track
    }
  }

  /**
   * Get Current Volume
   */
  async getVolume() {
    log('Sonos.getVolume()')
    const data = await this.renderingControl.GetVolume()
    return parseInt(data.CurrentVolume, 10)
  }

  /**
   * Set Volume
   * @param  {String}   volume 0..100
   */
  setVolume(volume: number) {
    log('Sonos.setVolume(%j)', volume)
    return this.renderingControl.SetVolume({ DesiredVolume: volume })
  }

  /**
   * Get Current Muted
   */
  async getMuted() {
    log('Sonos.getMuted()')
    const data = await this.renderingRequest('GetMute')
    return !!parseInt(data.CurrentMute, 10)
  }

  /**
   * Set Muted
   */
  setMuted(muted: boolean) {
    log('Sonos.setMuted(%j)')
    return this.renderingRequest('SetMute', { DesiredMute: (muted ? '1' : '0') })
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
      if (!queueResult.FirstTrackNumberEnqueued) {
        // TODO is this error accurate?
        throw new Error('Queuing was unsucessful')
      }
      const selectTrackNum = queueResult.FirstTrackNumberEnqueued
      await this.selectTrack(selectTrackNum)
      return this.play()
    } else {
      return this.avTransport.Play({ Speed: 1 })
    }
  }

  /**
   * Pause Current Queue
   */
  pause() {
    log('Sonos.pause()')
    return this.avTransport.Pause({ Speed: 1 })
  }

  /**
   * Stop What's Playing
   */
  stop() {
    log('Sonos.stop()')
    return this.avTransport.Stop({ Speed: 1 })
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
    return this.avTransport.Seek({
      Unit: 'REL_TIME',
      Target: hh + ':' + mm + ':' + ss,
    })
  }

  /**
   * Play next in queue
   */
  next() {
    log('Sonos.next()')
    return this.avTransport.Next({ Speed: 1 })
  }

  /**
   * Play previous in queue
   */
  previous() {
    log('Sonos.previous()')
    return this.avTransport.Previous({ Speed: 1 })
  }

  /**
   * Select specific track in queue
   * @param  trackNumber  Number of track in queue (optional, indexed from 1)
   */
  selectTrack(trackNumber = 1) {
    log(`Sonos.selectTrack(${trackNumber}`)
    return this.avTransport.Seek({
      Unit: 'TRACK_NR',
      Target: trackNumber,
    })
  }

  /**
   * Select Queue. Mostly required after turning on the speakers otherwise play, setPlaymode and other commands will fail.
   */
  async selectQueue() {
    log('Sonos.selectQueue()')
    const zoneData = await this.getZoneInfo()
    return this.avTransport.SetAVTransportURI({
      CurrentURI: 'x-rincon-queue:RINCON_' + zoneData.MACAddress.replace(/:/g, '') + '0' + this.port + '#0',
      CurrentURIMetaData: '',
    })
  }

  /**
   * Queue a Song Next
   * @param   uri      URI to Audio Stream
   * @param   metadata  optional metadata about the audio stream
   */
  queueNext(opts: { uri: string, metadata?: string}) {
    log(`Sonos.queueNext(${opts})`)
    return this.avTransport.SetAVTransportURI({
      CurrentURI: opts.uri,
      CurrentURIMetaData: opts.metadata || '',
    })
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
    return this.avTransport.AddURIToQueue({
      EnqueuedURI: options.uri,
      EnqueuedURIMetaData: options.metadata,
      DesiredFirstTrackNumberEnqueued: options.positionInQueue,
      EnqueueAsNext: 1,
    })
  }

  /**
   * Flush queue
   * @param  {Function} callback (err, flushed)
   */
  flush() {
    log('Sonos.flush()')
    return this.avTransport.RemoveAllTracksFromQueue()
  }

  /**
   * Become Coordinator of Standalone Group
   */
  becomeCoordinatorOfStandaloneGroup() {
    log('Sonos.becomeCoordinatorOfStandaloneGroup()')
    return this.avTransport.BecomeCoordinatorOfStandaloneGroup()
  }

  /**
   * Get the LED State
   */
  async getLEDState(): Promise<"On" | "Off"> {
    log('Sonos.getLEDState()')
    const data = await this.deviceRequest('GetLEDState')
    if (data && data.CurrentLEDState) {
      return data.CurrentLEDState
    } else {
      throw new Error('unknown response')
    }
  }

  /**
   * Set the LED State
   */
  setLEDState(desiredState: "On" | "Off") {
    log('Sonos.setLEDState(%j)', desiredState)
    return this.deviceRequest('SetLEDState', { DesiredLEDState: desiredState })
  }

  /**
   * Get Zone Info
   */
  getZoneInfo() {
    log('Sonos.getZoneInfo()')
    return this.deviceRequest('GetZoneInfo')
  }

  /**
   * Get Zone Attributes
   */
  getZoneAttrs() {
    log('Sonos.getZoneAttrs()')
    return this.deviceRequest('GetZoneAttributes')
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
    return parseXML(await res.text())
  }

  /**
   * Set Name
   */
  setName(name: string) {
    log('Sonos.setName(%j)', name)
    return this.deviceRequest('SetZoneAttributes', {
      DesiredZoneName: name,
      DesiredIcon: '',
      DesiredConfiguration: '',
    })
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
    return this.avTransport.SetPlayMode({ NewPlayMode: playmode.toUpperCase()})
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
    const data = await this.avTransport.GetTransportInfo()
    const statesToString = {
      STOPPED: 'stopped',
      PLAYING: 'playing',
      PAUSED_PLAYBACK: 'paused',
      TRANSITIONING: 'transitioning',
      NO_MEDIA_PRESENT: 'no_media',
    }
    return statesToString[data.CurrentTransportState]
  }

  /**
   * Get Favorites Radio for a given radio type
   * @param  {String}   favoriteRadioType  Choice - stations, shows
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   */
  private getFavoritesRadio(favoriteRadioType: 'stations' | 'shows', options) {
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
    return this.browseContentDirectory(opts)
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
