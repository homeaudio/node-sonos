import * as request from 'request'
import { parseString } from'xml2js'
import * as _ from 'underscore'

function withinEnvelope(body: string) {
  return ['<?xml version="1.0" encoding="utf-8"?>',
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
    '  <s:Body>' + body + '</s:Body>',
    '</s:Envelope>'].join('')
}

interface ServiceOptions {
  name: string
  host: string
  port?: number
  controlURL: string
  eventSubURL: string
  SCPDURL: string
}

export class Service {

  name: string
  host: string
  port: number
  controlURL: string
  eventSubURL: string
  SCPDURL: string
  
  constructor(options: ServiceOptions) {
    this.name = options.name
    this.host = options.host
    this.port = options.port || 1400
    this.controlURL = options.controlURL
    this.eventSubURL = options.eventSubURL
    this.SCPDURL = options.SCPDURL
  }

  _request(action: string, variables: {[key:string]: string}) {
    const messageAction = '"urn:schemas-upnp-org:service:' + this.name + ':1#' + action + '"'
    const messageBodyPre = '<u:' + action + ' xmlns:u="urn:schemas-upnp-org:service:' + this.name + ':1">'
    const messageBodyPost = '</u:' + action + '>'
    const messageBody = messageBodyPre + _.map(variables, (value, key) => '<' + key + '>' + value + '</' + key + '>').join('') + messageBodyPost
    const responseTag = 'u:' + action + 'Response'
    return new Promise<{[key: string]: any}>((resolve, reject) => {
      request({
        uri: 'http://' + this.host + ':' + this.port + this.controlURL,
        method: 'POST',
        headers: {
          'SOAPAction': messageAction,
          'Content-type': 'text/xml; charset=utf8'
        },
        body: withinEnvelope(messageBody)
      }, (err, res, body) => {
        if (err) {
          return reject(err)
        }

        parseString(body, (err, json) => {
          if (err) {
            return reject(err)
          }

          if (typeof json['s:Envelope']['s:Body'][0]['s:Fault'] !== 'undefined') {
            return reject(new Error(json['s:Envelope']['s:Body'][0]['s:Fault'][0].faultstring[0] +
              ': ' + json['s:Envelope']['s:Body'][0]['s:Fault'][0].detail[0].UPnPError[0].errorCode[0]))
          }

          const output = json['s:Envelope']['s:Body'][0][responseTag][0]
          delete output.$
          _.each(output, (item, key) => {
            output[key] = item[0]
          })
          return resolve(output)
        })
      })
    })
  }
}
