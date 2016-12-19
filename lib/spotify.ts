const SPOTIFY_METADATA_TEMPLATE = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="##SPOTIFYURI##" restricted="true"><dc:title>##RESOURCETITLE##</dc:title><upnp:class>##SPOTIFYTYPE##</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON3079_X_#Svc3079-0-Token</desc></item></DIDL-Lite>'


/**
 * Returns true iff a uri is a valid Spotify URI
 */
export function isSpotifyUri(uri: string) {
  return uri.startsWith('spotify')
}

export function spotifyMetadata(spotifyUri: string, spotifyType: string, resourceTitle = '') {
      return SPOTIFY_METADATA_TEMPLATE
                .replace('##SPOTIFYURI##', spotifyUri)
                .replace('##RESOURCETITLE##', resourceTitle)
                .replace('##SPOTIFYTYPE##', spotifyType)
}

/**
 * Creates object with uri and metadata from Spotify track uri.
 * @param radioTitle Optional, if the URI provided is a radio URI, the radio title can be manually set
 */
export function optionsFromSpotifyUri(uri: string, radioTitle = 'Artist Radio') {
  const spotifyIds = uri.split(':')
  if (Array.isArray(spotifyIds) && spotifyIds.length < 3) {
    return { uri }
  }
  const spotifyUri = uri.replace(/:/g, '%3a')
  if (uri.startsWith('spotify:track:')) {
    return {
      uri: spotifyUri,
      metadata: spotifyMetadata('00032020' + spotifyUri, 'object.item.audioItem.musicTrack'),
    }
  } else if (uri.startsWith('spotify:album:')) {
    return {
      uri: 'x-rincon-cpcontainer:0004206c' + spotifyUri,
      metadata: spotifyMetadata('0004206c' + spotifyUri, 'object.container.album.musicAlbum'),
    }
  } else if (uri.startsWith('spotify:artistTopTracks:')) {
    return {
      uri: 'x-rincon-cpcontainer:000e206c' + spotifyUri,
      metadata: spotifyMetadata('000e206c' + spotifyUri, 'object.container.playlistContainer'),
    }
  } else if (uri.startsWith('spotify:user:')) {
    return {
      uri: 'x-rincon-cpcontainer:0006206c' + spotifyUri,
      metadata: spotifyMetadata('0006206c' + spotifyUri, 'object.container.playlistContainer'),
    }
  } else if (uri.startsWith('spotify:artistRadio:')) {
    return {
      uri: 'x-sonosapi-radio:'  + spotifyUri + '?sid=12&amp;flags=8300&amp;sn=1',
      metadata: spotifyMetadata('000c206c' + spotifyUri, 'object.item.audioItem.audioBroadcast.#artistRadio', radioTitle),
    }
  } else {
    return { uri }
  }
}
