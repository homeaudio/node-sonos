import * as xml2js from 'xml2js'
import * as xmlbuilder from 'xmlbuilder'
import fetch from 'node-fetch'
import * as debug from 'debug'

const logRequest = debug('sonos:net:request')
const logResponse = debug('sonos:net:response')

export function parseXML(str: string) {
  return new Promise<any>((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
    })
    parser.parseString(str, (err, obj) => {
      if (err) {
        reject(err)
      }
      resolve(obj)
    })
  })
}

export function buildXML(obj: any) {
  return xmlbuilder.create(obj).toString({
    pretty: true,
    indent: '  ',
    newline: '\n',
  })
}

/**
 * Wrap in UPnP Envelope
 */
export function withinSoapEnvelope(body: string) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
    `<s:Body>${body}</s:Body>`,
    '</s:Envelope>',
  ].join('')
}

/**
 * Encodes characters not allowed within html/xml tags
 */
export function htmlEntities(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function prepareSoapActionXML(action: string, name: string, body: { [key: string]: any }) {
    return buildXML({
        [`u:${action}`]: {
            '@xmlns:u': `urn:schemas-upnp-org:service:${name}:1`,
            ...body,
        },
    })
}

/**
 * UPnP HTTP Request
 * @param  {String}   endpoint    HTTP Path
 * @param  {String}   action      UPnP Call/Function/Action
 * @param  {String}   body
 * @param  {String}   responseTag Expected Response Container XML Tag
 */
export async function soapPost(host: string, port: number, endpoint: string, action: string, body: string, responseTag: string) {
  logRequest(body)
  const res = await fetch(`http://${host}:${port}${endpoint}`,
    {
      method: 'POST',
      headers: {
        SOAPAction: action,
        'Content-type': 'text/xml; charset=utf8',
      },
      body: withinSoapEnvelope(body),
    })
  if (res.status !== 200) {
    throw new Error('HTTP response code ' + res.status + ' for ' + action)
  }
  const text = await res.text()
  const json = await parseXML(text)
  if (!json || !json['s:Envelope'] || !json['s:Envelope']['s:Body']) {
    throw new Error('Invalid response for ' + action + ': ' + JSON.stringify(json))
  }
  const resultBody = json['s:Envelope']['s:Body']
  if (typeof resultBody['s:Fault'] !== 'undefined') {
    throw new Error(resultBody['s:Fault'])
  }
  if (typeof resultBody[responseTag] !== 'undefined') {
    logResponse(json['s:Envelope']['s:Body'][responseTag])
    return json['s:Envelope']['s:Body'][responseTag]
  } else {
    throw new Error(`Missing response tag and no error for '${action}: ${json} `)
  }
}
