/**
 * Constants
 */
const TRANSPORT_ENDPOINT = '/MediaRenderer/AVTransport/Control'
const RENDERING_ENDPOINT = '/MediaRenderer/RenderingControl/Control'
const DEVICE_ENDPOINT = '/DeviceProperties/Control'

/**
 * Dependencies
 */
import * as util from 'util'
import { EventEmitter } from 'events'
import * as dgram from 'dgram'
import * as request from 'request'
import * as xml2js from 'xml2js'
import * as debug from 'debug'
import * as _ from 'underscore'

const log = debug('sonos')


/**
 * Option Interfaces
 */
interface SearchMusicLibraryOptions {
  start?: number
  total?: number
}

function parseXML(str: string) {
  return new Promise<{[key: string]: string}>((resolve, reject) => {
    const parser = new xml2js.Parser()
    parser.parseString(str, (err, didl) => {
      if (err) {
        reject(err)
      }
      resolve(didl)
    })
  })
}

/**
 * Services
 */
import { ContentDirectory } from './services/ContentDirectory'

/**
 * Helpers
 */

/**
 * Wrap in UPnP Envelope
 */
function withinEnvelope(body: string) {
  return ['<?xml version="1.0" encoding="utf-8"?>',
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
    '<s:Body>' + body + '</s:Body>',
    '</s:Envelope>'].join('')
}

/**
 * Encodes characters not allowed within html/xml tags
 */
function htmlEntities(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Creates object with uri and metadata from Spotify track uri
 */
function optionsFromSpotifyUri(uri: string, title?: string) {
  const spotifyIds = uri.split(':')
  if (Array.isArray(spotifyIds) && spotifyIds.length < 3) {
    return uri
  }
  const spotifyUri = uri.replace(/:/g, '%3a')
  const meta = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="##SPOTIFYURI##" restricted="true"><dc:title>##RESOURCETITLE##</dc:title><upnp:class>##SPOTIFYTYPE##</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON3079_X_#Svc3079-0-Token</desc></item></DIDL-Lite>'
  if (uri.startsWith('spotify:track:')) {
    return {
      uri: spotifyUri,
      metadata: meta.replace('##SPOTIFYURI##', '00032020' + spotifyUri).replace('##RESOURCETITLE##', '').replace('##SPOTIFYTYPE##', 'object.item.audioItem.musicTrack')
    }
  } else if (uri.startsWith('spotify:album:')) {
    return {
      uri: 'x-rincon-cpcontainer:0004206c' + spotifyUri,
      metadata: meta.replace('##SPOTIFYURI##', '0004206c' + spotifyUri).replace('##RESOURCETITLE##', '').replace('##SPOTIFYTYPE##', 'object.container.album.musicAlbum')
    }
  } else if (uri.startsWith('spotify:artistTopTracks:')) {
    return {
      uri: 'x-rincon-cpcontainer:000e206c' + spotifyUri,
      metadata: meta.replace('##SPOTIFYURI##', '000e206c' + spotifyUri).replace('##RESOURCETITLE##', '').replace('##SPOTIFYTYPE##', 'object.container.playlistContainer')
    }
  } else if (uri.startsWith('spotify:user:')) {
    return {
      uri: 'x-rincon-cpcontainer:0006206c' + spotifyUri,
      metadata: meta.replace('##SPOTIFYURI##', '0006206c' + spotifyUri).replace('##RESOURCETITLE##', '').replace('##SPOTIFYTYPE##', 'object.container.playlistContainer')
    }
  } else if (uri.startsWith('spotify:artistRadio:')) {
    const radioTitle = (title !== undefined) ? title : 'Artist Radio'
    return {
      uri: spotifyUri,
      metadata: '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="000c206c' + spotifyUri + '" restricted="true"><dc:title>' + radioTitle + '</dc:title><upnp:class>object.item.audioItem.audioBroadcast.#artistRadio</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON3079_X_#Svc3079-0-Token</desc></item></DIDL-Lite>'
    }
  } else {
    return uri
  }
}

interface SonosOptions {
  endpoints?: {
    transport?: string
    rendering?: string
    device?: string
  }
}

export class Sonos {

  host: string
  port: number
  options: SonosOptions

  /**
   * Sonos Class
   * @param host IP/DNS
   * @param port
   */
  constructor(host: string, port?: number, options?: SonosOptions) {
    this.host = host
    this.port = port || 1400
    this.options = options || {}
    if (!this.options.endpoints) this.options.endpoints = {}
    if (!this.options.endpoints.transport) this.options.endpoints.transport = TRANSPORT_ENDPOINT
    if (!this.options.endpoints.rendering) this.options.endpoints.rendering = RENDERING_ENDPOINT
    if (!this.options.endpoints.device) this.options.endpoints.device = DEVICE_ENDPOINT
  }

  /**
   * UPnP HTTP Request
   * @param  {String}   endpoint    HTTP Path
   * @param  {String}   action      UPnP Call/Function/Action
   * @param  {String}   body
   * @param  {String}   responseTag Expected Response Container XML Tag
   */
  request(endpoint: string, action: string, body: string, responseTag: string) {
    log('Sonos.request(%j, %j, %j, %j, %j)', endpoint, action, body, responseTag)
    return new Promise<{[key: string]: any}>((resolve, reject) => {
      request({
        uri: 'http://' + this.host + ':' + this.port + endpoint,
        method: 'POST',
        headers: {
          'SOAPAction': action,
          'Content-type': 'text/xml; charset=utf8'
        },
        body: withinEnvelope(body)
      }, function (err, res, body) {
        if (err) return reject(err)
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP response code ' + res.statusCode + ' for ' + action))
        }
        (new xml2js.Parser()).parseString(body, function (err, json) {
          if (err) return reject(err)
          if ((!json) || (!json['s:Envelope']) || (!util.isArray(json['s:Envelope']['s:Body']))) {
            return reject(new Error('Invalid response for ' + action + ': ' + JSON.stringify(json)))
          }
          if (typeof json['s:Envelope']['s:Body'][0]['s:Fault'] !== 'undefined') {
            return reject(json['s:Envelope']['s:Body'][0]['s:Fault'])
          }
          return resolve(json['s:Envelope']['s:Body'][0][responseTag])
        })
      })
    })
  }

  /**
   * Get Music Library Information
   * @param  {String}   searchType  Choice - artists, albumArtists, albums, genres, composers, tracks, playlists, share
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  getMusicLibrary(searchType: string, options) {
    return this.searchMusicLibrary(searchType, null, options)
  }

  /**
   * Get Music Library Information
   * @param  {String}   searchType  Choice - artists, albumArtists, albums, genres, composers, tracks, playlists, share
   * @param  {String}   searchTerm  Optional - search term to search for
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  async searchMusicLibrary(searchType, searchTerm: string | null, options: SearchMusicLibraryOptions) {

    let searches = {
      'artists': 'A:ARTIST',
      'albumArtists': 'A:ALBUMARTIST',
      'albums': 'A:ALBUM',
      'genres': 'A:GENRE',
      'composers': 'A:COMPOSER',
      'tracks': 'A:TRACKS',
      'playlists': 'A:PLAYLISTS',
      'sonos_playlists': 'SQ:',
      'share': 'S:'
    }
    const defaultOptions = {
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '100',
      SortCriteria: ''
    }
    searches = searches[searchType]

    const opensearch = (!searchTerm) || (searchTerm === '')
    if (!opensearch) {
      searches = searches.concat(':' + searchTerm)
    }

    let opts = {
      ObjectID: searches
    }
    if (options.start !== undefined) opts.StartingIndex = options.start
    if (options.total !== undefined) opts.RequestedCount = options.total
    opts = _.extend(defaultOptions, opts)
    const contentDirectory = new ContentDirectory(this.host, this.port)
    const data = await contentDirectory.Browse(opts)
    const didl = await parseXML(data['Result'])
    if ((!didl) || (!didl['DIDL-Lite'])) {
      throw new Error('Cannot parse DIDTL result')
    }
    const resultcontainer: any[] = opensearch ? didl['DIDL-Lite']['container'] : didl['DIDL-Lite']['item']
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
        'title': util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
        'artist': util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
        'albumArtURL': albumArtURL,
        'album': util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
        'uri': util.isArray(item.res) ? item.res[0]._ : null
      }
    })
    return {
      returned: data['NumberReturned'],
      total: data['TotalMatches'],
      items
    }
  }

  /**
   * Get Current Track
   */
  async currentTrack() {
    log('Sonos.currentTrack()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"'
    const body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetPositionInfo>'
    const responseTag = 'u:GetPositionInfoResponse'
    const data = await this.request(this.options.endpoints.transport, action, body, responseTag)
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
      const track = this.parseDIDL(metadataData)
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
      const track = { position: position, duration: duration }
      if (data[0].TrackURI) {
        track.uri = data[0].TrackURI[0]
      }
      return track
    }
  }

  /**
   * Parse DIDL into track structure
   * @param  {String} didl
   * @return {object}
   */
  parseDIDL(didl) {
    if ((!didl) || (!didl['DIDL-Lite']) || (!util.isArray(didl['DIDL-Lite'].item)) || (!didl['DIDL-Lite'].item[0])) return {}
    const item = didl['DIDL-Lite'].item[0]
    return {
      title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
      artist: util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
      album: util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
      albumArtURI: util.isArray(item['upnp:albumArtURI']) ? item['upnp:albumArtURI'][0] : null
    }
  }

  /**
   * Get Current Volume
   */
  async getVolume() {
    log('Sonos.getVolume()')
    const action = '"urn:schemas-upnp-org:service:RenderingControl:1#GetVolume"'
    const body = '<u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetVolume>'
    const responseTag = 'u:GetVolumeResponse'
    const data = await this.request(this.options.endpoints.rendering, action, body, responseTag)
    return parseInt(data[0].CurrentVolume[0], 10)
  }

  /**
   * Get Current Muted
   */
  async getMuted() {
    log('Sonos.getMuted()')
    const action = '"urn:schemas-upnp-org:service:RenderingControl:1#GetMute"'
    const body = '<u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetMute>'
    const responseTag = 'u:GetMuteResponse'
    const data = this.request(this.options.endpoints.rendering, action, body, responseTag)
    return !!parseInt(data[0].CurrentMute[0], 10)
  }

  /**
   * Resumes Queue or Plays Provided URI
   * @param  {String|Object}   uri      Optional - URI to a Audio Stream or Object with play options
   */
  async play(uri: string | Object) {
    log('Sonos.play(%j)', uri)
    let action
    let body
    const self = this
    if (typeof uri === 'string') {
      uri = optionsFromSpotifyUri(uri)
    }
    const options = (typeof uri === 'object' ? uri : {})
    if (typeof uri === 'object') {
      options.uri = uri.uri
      options.metadata = uri.metadata
    } else {
      options.uri = (typeof uri === 'string' ? uri : undefined)
    }
    if (options.uri) {
      return this.queue({
        uri: options.uri,
        metadata: options.metadata
      }, function (err, queueResult) {
        if (err || !queueResult || queueResult.length < 0 || !queueResult[0].FirstTrackNumberEnqueued) {
          return cb(err)
        }
        const selectTrackNum = queueResult[0].FirstTrackNumberEnqueued[0]
        self.selectTrack(selectTrackNum, function (err) {
          if (err) return cb(err)
          return self.play(cb)
        })
      })
    } else {
      action = '"urn:schemas-upnp-org:service:AVTransport:1#Play"'
      body = '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>'
      return this.request(this.options.endpoints.transport, action, body, 'u:PlayResponse', function (err, data) {
        if (err) return cb(err)
        if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
          return cb(null, true)
        } else {
          return cb(new Error({
            err: err,
            data: data
          }), false)
        }
      })
    }
  }

  /**
   * Stop What's Playing
   */
  async stop(callback) {
    log('Sonos.stop()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Stop"'
    const body = '<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Stop>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:StopResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Become Coordinator of Standalone Group
   * @param  {Function} callback (err, stopped)
   */
  async becomeCoordinatorOfStandaloneGroup() {
    log('Sonos.becomeCoordinatorOfStandaloneGroup()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#BecomeCoordinatorOfStandaloneGroup"'
    const body = '<u:BecomeCoordinatorOfStandaloneGroup xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:BecomeCoordinatorOfStandaloneGroup>'
    const data = this.request(this.options.endpoints.transport, action, body, 'u:BecomeCoordinatorOfStandaloneGroupResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Pause Current Queue
   */
  async pause() {
    log('Sonos.pause()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Pause"'
    const body = '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Pause>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:PauseResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Seek the current track
   */
  async seek(seconds) {
    log('Sonos.seek(%j)', seconds)
    let hh, mm, ss
    hh = Math.floor(seconds / 3600)
    mm = Math.floor((seconds - (hh * 3600)) / 60)
    ss = seconds - ((hh * 3600) + (mm * 60))
    if (hh < 10) {
      hh = '0' + hh
    }
    if (mm < 10) {
      mm = '0' + mm
    }
    if (ss < 10) {
      ss = '0' + ss
    }
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Seek"'
    const body = '<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>' + hh + ':' + mm + ':' + ss + '</Target></u:Seek>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:SeekResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Select specific track in queue
   * @param  {Number}   trackNr    Number of track in queue (optional, indexed from 1)
   */
  async selectTrack(trackNr = 1) {
    log(`Sonos.selectTrack(${trackNr}`)
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Seek"'
    const body = '<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>TRACK_NR</Unit><Target>' + trackNr + '</Target></u:Seek>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:SeekResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Play next in queue
   */
  async next() {
    log('Sonos.next()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Next"'
    const body = '<u:Next xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Next>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:NextResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Play previous in queue
   */
  async previous() {
    log('Sonos.previous()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#Previous"'
    const body = '<u:Previous xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Previous>'
    const data = this.request(this.options.endpoints.transport, action, body, 'u:PreviousResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return true
    } else {
      throw (new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Select Queue. Mostly required after turning on the speakers otherwise play, setPlaymode and other commands will fail.
   */
  selectQueue() {
    log('Sonos.selectQueue()')
    const self = this
    self.getZoneInfo(function (err, data) {
      if (!err) {
        const action = '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"'
        const body = '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>' + 'x-rincon-queue:RINCON_' + data.MACAddress.replace(/:/g, '') + '0' + self.port + '#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>'
        self.request(self.options.endpoints.transport, action, body, 'u:SetAVTransportURIResponse', function (err, data) {
          if (err) return cb(err)
          if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
            return cb(null, true)
          } else {
            return cb(new Error({
              err: err,
              data: data
            }), false)
          }
        })
      } else {
        return cb(err)
      }
    })
  }

  /**
   * Add a song from spotify to the queue
   * @param  {String}   trackId      The spotify track ID
   * @param  {Function} callback (err, success)
   */
  addSpotify(trackId, callback) {
    const uri = 'x-sonos-spotify:spotify%3atrack%3a' + trackId
    const meta = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="00032020spotify%3atrack%3a' + trackId + '" restricted="true"><dc:title></dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON3079_X_#Svc3079-0-Token</desc></item></DIDL-Lite>'

    this.queue({
      uri: uri,
      metadata: meta
    }, callback)
  }

  /**
   * Plays Spotify radio based on artist uri
   */
  async playSpotifyRadio(artistId: string, artistName: string) {
    log('Sonos.playSpotifyRadio(%j, %j)', artistId, artistName)
    const self = this
    const options = optionsFromSpotifyUri('spotify:artistRadio:' + artistId, artistName)
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"'
    const body = '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>x-sonosapi-radio:' + options.uri + '?sid=12&amp;flags=8300&amp;sn=1</CurrentURI><CurrentURIMetaData>' + htmlEntities(options.metadata) + '</CurrentURIMetaData></u:SetAVTransportURI>'
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:SetAVTransportURIResponse')
    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return self.play()
    } else {
      throw (new Error({
        err: err,
        data: data
      })
    }
  }

  /**
   * Queue a Song Next
   * @param  {String|Object}   uri      URI to Audio Stream or Object containing options (uri, metadata)
   */
  queueNext(uri) {
    log('Sonos.queueNext(%j, %j)', uri, callback)
    var options = (typeof uri === 'object' ? uri : { metadata: '' })
    if (typeof uri === 'object') {
      options.metadata = uri.metadata || ''
      options.metadata = htmlEntities(options.metadata)
      options.uri = uri.uri
    } else {
      options.uri = uri
    }
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"'
    const body = '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>' + options.uri + '</CurrentURI><CurrentURIMetaData>' + options.metadata + '</CurrentURIMetaData></u:SetAVTransportURI>'
    return this.request(this.options.endpoints.transport, action, body, 'u:SetAVTransportURIResponse')
  }

  /**
   * Add a song to the queue.
   * @param  {String}   uri             URI to Audio Stream
   * @param  {Number}   positionInQueue Position in queue at which to add song (optional, indexed from 1,
   *                                    defaults to end of queue, 0 to explicitly set end of queue)
   * @param  {Function} callback (err, queued)
   */
  queue(uri, positionInQueue, callback) {
    log('Sonos.queue(%j, %j, %j)', uri, positionInQueue, callback)
    if (typeof positionInQueue === 'function') {
      callback = positionInQueue
      positionInQueue = 0
    }
    if (typeof uri === 'string') uri = optionsFromSpotifyUri(uri)
    var options = (typeof uri === 'object' ? uri : { metadata: '' })
    if (typeof uri === 'object') {
      options.metadata = uri.metadata || ''
      options.metadata = htmlEntities(options.metadata)
      options.uri = uri.uri
    } else {
      options.uri = uri
    }
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#AddURIToQueue"'
    const body = '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><EnqueuedURI>' + options.uri + '</EnqueuedURI><EnqueuedURIMetaData>' + options.metadata + '</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>' + positionInQueue + '</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>1</EnqueueAsNext></u:AddURIToQueue>'
    return this.request(this.options.endpoints.transport, action, body, 'u:AddURIToQueueResponse')
  }

  /**
   * Flush queue
   * @param  {Function} callback (err, flushed)
   */
  flush() {
    log('Sonos.flush()')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#RemoveAllTracksFromQueue"'
    const body = '<u:RemoveAllTracksFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:RemoveAllTracksFromQueue>'
    return this.request(this.options.endpoints.transport, action, body, 'u:RemoveAllTracksFromQueueResponse')
  }

  /**
   * Get the LED State
   */
  async getLEDState(): Promise<"On" | "Off"> {
    log('Sonos.getLEDState()')
    const action = '"urn:schemas-upnp-org:service:DeviceProperties:1#GetLEDState"'
    const body = '<u:GetLEDState xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"></u:GetLEDState>'
    const data = await this.request(this.options.endpoints.device, action, body, 'u:GetLEDStateResponse')
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
    const action = '"urn:schemas-upnp-org:service:DeviceProperties:1#SetLEDState"'
    const body = '<u:SetLEDState xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"><DesiredLEDState>' + desiredState + '</DesiredLEDState></u:SetLEDState>'
    return this.request(this.options.endpoints.device, action, body, 'u:SetLEDStateResponse')
  }

  /**
   * Get Zone Info
   */
  async getZoneInfo() {
    log('Sonos.getZoneInfo()')
    const action = '"urn:schemas-upnp-org:service:DeviceProperties:1#GetZoneInfo"'
    const body = '<u:GetZoneInfo xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"></u:GetZoneInfo>'
    const data = await this.request(this.options.endpoints.device, action, body, 'u:GetZoneInfoResponse')
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
    log('Sonos.getZoneAttrs(%j)')
    const action = '"urn:schemas-upnp-org:service:DeviceProperties:1#GetZoneAttributes"'
    const body = '"<u:GetZoneAttributes xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"></u:GetZoneAttributes>"'
    const data = await this.request(this.options.endpoints.device, action, body, 'u:GetZoneAttributesResponse')
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
   * @param  {Function} callback (err, info)
   */
  deviceDescription(callback) {
    request({
      uri: 'http://' + this.host + ':' + this.port + '/xml/device_description.xml'
    }, function (err, res, body) {
      if (err) return callback(err)
      if (res.statusCode !== 200) {
        return callback(new Error('non 200 errorCode'))
      }
      (new xml2js.Parser()).parseString(body, function (err, json) {
        if (err) return callback(err)
        const output = {}
        for (const d in json.root.device[0]) if (json.root.device[0].hasOwnProperty(d)) output[d] = json.root.device[0][d][0]
        callback(null, output)
      })
    })
  }

  /**
   * Set Name
   */
  setName(name: string) {
    log('Sonos.setName(%j)', name)
    name = name.replace(/[<&]/g, (str) => (str === '&') ? '&amp;' : '&lt;')
    const action = '"urn:schemas-upnp-org:service:DeviceProperties:1#SetZoneAttributes"'
    const body = '"<u:SetZoneAttributes xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"><DesiredZoneName>' + name + '</DesiredZoneName><DesiredIcon /><DesiredConfiguration /></u:SetZoneAttributes>"'
    return this.request(this.options.endpoints.device, action, body, 'u:SetZoneAttributesResponse')
  }

  /**
   * Set Play Mode
   * @param  {String} playmode
   * @param  {Function} callback (err, data)
   * @return {[type]}
   */
  setPlayMode(playmode: string, callback) {
    log('Sonos.setPlayMode(%j, %j)', playmode, callback)
    const mode = { NORMAL: true, REPEAT_ALL: true, SHUFFLE: true, SHUFFLE_NOREPEAT: true }[playmode.toUpperCase()]
    if (!mode) {
      throw new Error('invalid play mode ' + playmode)
    }
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#SetPlayMode"'
    const body = '<u:SetPlayMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><NewPlayMode>' + playmode.toUpperCase() + '</NewPlayMode></u:SetPlayMode>'
    return this.request(this.options.endpoints.transport, action, body, 'u:SetPlayModeResponse')
  }

  /**
   * Set Volume
   * @param  {String}   volume 0..100
   */
  setVolume(volume: number) {
    log('Sonos.setVolume(%j)', volume)
    const action = '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"'
    const body = '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>' + volume + '</DesiredVolume></u:SetVolume>'
    return this.request(this.options.endpoints.rendering, action, body, 'u:SetVolumeResponse')
  }

  /**
   * Set Muted
   */
  setMuted(muted: boolean) {
    log('Sonos.setMuted(%j)')
    if (typeof muted === 'string') {
      muted = !!parseInt(muted, 10)
    }
    const action = '"urn:schemas-upnp-org:service:RenderingControl:1#SetMute"'
    const body = '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>' + (muted ? '1' : '0') + '</DesiredMute></u:SetMute>'
    return this.request(this.options.endpoints.rendering, action, body, 'u:SetMutedResponse')
  }

  /**
   * Get Zones in contact with current Zone with Group Data
   * @param  {Function} callback (err, topology)
   */
  getTopology(callback) {
    log('Sonos.getTopology(%j)', callback)
    request('http://' + this.host + ':' + this.port + '/status/topology', function (err, res, body) {
      if (err) return callback(err)
      log(body)
      xml2js.parseString(body, function (err, topology) {
        if (err) return callback(err)
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
        callback(null, {
          zones: zones,
          mediaServers: mediaServers
        })
      })
    })
  }

  /**
   * Get Current Playback State
   */
  async getCurrentState() {
    log('Sonos.currentState(%j)')
    const action = '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo"'
    const body = '<u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetTransportInfo>'
    let state = null
    const data = await this.request(this.options.endpoints.transport, action, body, 'u:GetTransportInfoResponse')
    if (JSON.stringify(data[0].CurrentTransportState) === '["STOPPED"]') {
      state = 'stopped'
    } else if (JSON.stringify(data[0].CurrentTransportState) === '["PLAYING"]') {
      state = 'playing'
    } else if (JSON.stringify(data[0].CurrentTransportState) === '["PAUSED_PLAYBACK"]') {
      state = 'paused'
    } else if (JSON.stringify(data[0].CurrentTransportState) === '["TRANSITIONING"]') {
      state = 'transitioning'
    } else if (JSON.stringify(data[0].CurrentTransportState) === '["NO_MEDIA_PRESENT"]') {
      state = 'no_media'
    }
    return state
  }

  /**
   * Get Favorites Radio Stations
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  getFavoritesRadioStations(options, callback) {
    this.getFavoritesRadio('stations', options, callback)
  }

  /**
   * Get Favorites Radio Shows
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  getFavoritesRadioShows(options, callback) {
    this.getFavoritesRadio('shows', options, callback)
  }

  /**
   * Get Favorites Radio for a given radio type
   * @param  {String}   favoriteRadioType  Choice - stations, shows
   * @param  {Object}   options     Optional - default {start: 0, total: 100}
   * @param  {Function} callback (err, result) result - {returned: {String}, total: {String}, items:[{title:{String}, uri: {String}}]}
   */
  getFavoritesRadio(favoriteRadioType, options, callback) {
    const radioTypes = {
      'stations': 'R:0/0',
      'shows': 'R:0/1'
    }
    let defaultOptions = {
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '100',
      SortCriteria: '',
      ObjectID: 'R:0/0'
    }
    let opts = {
      ObjectID: radioTypes[favoriteRadioType]
    }
    if (options.start !== undefined) opts.StartingIndex = options.start
    if (options.total !== undefined) opts.RequestedCount = options.total
    opts = _.extend(defaultOptions, opts)
    const contentDirectory = new ContentDirectory(this.host, this.port)
    return contentDirectory.Browse(opts, function (err, data) {
      if (err) return callback(err)
      return (new xml2js.Parser()).parseString(data.Result, function (err, didl) {
        if (err) return callback(err, data)
        const items = []
        if ((!didl) || (!didl['DIDL-Lite'])) {
          return callback(new Error('Cannot parse DIDTL result'), data)
        }
        const resultcontainer = didl['DIDL-Lite'].item
        if (!util.isArray(resultcontainer)) {
          return callback(new Error('Cannot parse DIDTL result'), data)
        }
        _.each(resultcontainer, function (item) {
          items.push({
            'title': util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
            'uri': util.isArray(item.res) ? item.res[0]._ : null
          })
        })
        const result = {
          returned: data.NumberReturned,
          total: data.TotalMatches,
          items: items
        }
        return callback(null, result)
      })
    })
  }

  // Add Spotify track to the queue.

  addSpotifyQueue(trackId, callback) {
    const rand = '00030020'
    const uri = 'x-sonos-spotify:spotify%3atrack%3a' + trackId
    const meta = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="' + rand + 'spotify%3atrack%3a' + trackId + '" restricted="true"><dc:title></dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON2311_X_#Svc2311-0-Token</desc></item></DIDL-Lite>'

    this.queue({
      uri: uri,
      metadata: meta
    }, callback)
  }

  // Get queue

  getQueue(callback) {
    const self = this

    const defaultOptions = {
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '1000',
      SortCriteria: ''
    }

    let opts = {
      ObjectID: 'Q:0'
    }

    opts = _.extend(defaultOptions, opts)

    const contentDirectory = new ContentDirectory(this.host, this.port)
    return contentDirectory.Browse(opts, function (err, data) {
      if (err) return callback(err)
      return (new xml2js.Parser()).parseString(data.Result, function (err, didl) {
        if (err) return callback(err, data)
        const items = []
        if ((!didl) || (!didl['DIDL-Lite'])) {
          return callback(new Error('Cannot parse DIDTL result'), data)
        }
        const resultcontainer = didl['DIDL-Lite'].item
        if (!util.isArray(resultcontainer)) {
          return callback(new Error('Cannot parse DIDTL result'), data)
        }
        _.each(resultcontainer, function (item) {
          let albumArtURL = null
          if (util.isArray(item['upnp:albumArtURI'])) {
            if (item['upnp:albumArtURI'][0].indexOf('http') !== -1) {
              albumArtURL = item['upnp:albumArtURI'][0]
            } else {
              albumArtURL = 'http://' + self.host + ':' + self.port + item['upnp:albumArtURI'][0]
            }
          }
          items.push({
            'title': util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
            'artist': util.isArray(item['dc:creator']) ? item['dc:creator'][0] : null,
            'albumArtURL': albumArtURL,
            'album': util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
            'uri': util.isArray(item.res) ? item.res[0]._ : null
          })
        })
        const result = {
          returned: data.NumberReturned,
          total: data.TotalMatches,
          items: items
        }
        return callback(null, result)
      })
    })
  }
}


interface SearchOptions {

}

/**
 * Search "Class"
 * Emits 'DeviceAvailable' on a Sonos Component Discovery
 */
class Search extends EventEmitter {

  foundSonosDevices: {}
  socket: dgram.Socket
  pollTimer: NodeJS.Timer
  searchTimer: NodeJS.Timer

  constructor(options) {
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
      // Periodically send discover packet to find newly added devices
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
export function search(options, listener) {
  if (typeof options === 'function') {
    listener = options
    options = null
  }
  options = options || {}
  listener = listener || null
  const search = new Search(options)
  if (listener !== null) {
    search.on('DeviceAvailable', listener)
  }
  return search
}
