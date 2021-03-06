import { soapPost } from '../utils'

interface ServiceOptions {
  name: string
  host: string
  port?: number
  controlURL: string
  eventSubURL: string
  SCPDURL: string
}

export abstract class Service {

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

  abstract get bodyExtras()

  _request(action: string, body: {[key: string]: any} = {}) {
    return soapPost(this.host, this.port, this.controlURL, this.name, action, {...this.bodyExtras, ...body})
  }

}
