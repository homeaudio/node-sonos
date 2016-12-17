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

  GetSessionId(options, callback) { this._request('GetSessionId', options, callback) }
  ListAvailableServices(options, callback) { this._request('ListAvailableServices', options, callback) }
  UpdateAvailableServices(options, callback) { this._request('UpdateAvailableServices', options, callback) }

}
