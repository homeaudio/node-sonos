import { Service } from './Service'

export class ContentDirectory extends Service {
  
  constructor(host: string, port?: number) {
    super({
      name: 'ContentDirectory',
      host,
      port,
      controlURL: '/MediaServer/ContentDirectory/Control',
      eventSubURL: '/MediaServer/ContentDirectory/Event',
      SCPDURL: '/xml/ContentDirectory1.xml'
    })
  }

  Browse(options, callback) { this._request('Browse', options, callback) }

}
