import { Service } from './Service'

export class MusicServices extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'MusicServices',
      host,
      port,
      controlURL: '/MusicServices/Control',
      eventSubURL: '/MusicServices/Event',
      SCPDURL: '/xml/MusicServices1.xml'
    })
  }

  GetSessionId(options) { return this._request('GetSessionId', options) }
  ListAvailableServices(options) { return this._request('ListAvailableServices', options) }
  UpdateAvailableServices(options) { return this._request('UpdateAvailableServices', options) }

}
