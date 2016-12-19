import * as xml2js from 'xml2js'
import fetch from 'node-fetch'
import { isArray } from 'util'

export function parseXML(str: string) {
  return new Promise<{[key: string]: string}>((resolve, reject) => {
    const parser = new xml2js.Parser()
    parser.parseString(str, (err, obj) => {
      if (err) {
        reject(err)
      }
      resolve(obj)
    })
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


/**
 * UPnP HTTP Request
 * @param  {String}   endpoint    HTTP Path
 * @param  {String}   action      UPnP Call/Function/Action
 * @param  {String}   body
 * @param  {String}   responseTag Expected Response Container XML Tag
 */
export async function soapPost(host: string, port: number, endpoint: string, action: string, body: string, responseTag: string) {
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
    const json = await parseXML(await res.text())
    if ((!json) || (!json['s:Envelope']) || (!isArray(json['s:Envelope']['s:Body']))) {
        throw new Error('Invalid response for ' + action + ': ' + JSON.stringify(json))
    }
    if (typeof json['s:Envelope']['s:Body'][0]['s:Fault'] !== 'undefined') {
        throw new Error(json['s:Envelope']['s:Body'][0]['s:Fault'])
    }
    return json['s:Envelope']['s:Body'][0][responseTag]
}
