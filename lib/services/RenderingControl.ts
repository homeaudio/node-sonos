import { Service } from './Service'

export class RenderingControl extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'RenderingControl',
      host,
      port,
      controlURL: '/MediaRenderer/RenderingControl/Control',
      eventSubURL: '/MediaRenderer/RenderingControl/Event',
      SCPDURL: '/xml/RenderingControl1.xml'
    })
  }

  GetVolume(options, callback) { this._request('GetVolume', options, callback) }
  SetVolume(options, callback) { this._request('SetVolume', options, callback) }

}
