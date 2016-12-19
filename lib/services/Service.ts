import * as _ from 'underscore'
import { soapPost } from '../utils'

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

  async _request(action: string, variables: {[key: string]: string}) {
    const messageAction = `"urn:schemas-upnp-org:service:${this.name}:1#${action}"`
    const messageBody = [
      `<u:${action} xmlns:u="urn:schemas-upnp-org:service:${this.name}:1">`,
      _.map(variables, (value, key) => `<${key}>${value}</${key}>`).join(''),
      `</u:${action}>`,
      ].join('')
    const responseTag = `u:${action}Response`
    const output = await soapPost(this.host, this.port, this.controlURL, messageAction, messageBody, responseTag)
    delete output.$
    _.each(output, (item, key) => {
      output[key] = item[0]
    })
    return output
  }

}
