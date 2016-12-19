import * as xml2js from 'xml2js'

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
