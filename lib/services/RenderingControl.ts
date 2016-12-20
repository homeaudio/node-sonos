import { Service } from './Service'

interface DefaultOptions {
  InstanceID: number,
  Channel: string
}

export class RenderingControl extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'RenderingControl',
      host,
      port,
      controlURL: '/MediaRenderer/RenderingControl/Control',
      eventSubURL: '/MediaRenderer/RenderingControl/Event',
      SCPDURL: '/xml/RenderingControl1.xml',
    })
  }

  get bodyExtras(): DefaultOptions {
    return { InstanceID: 0, Channel: 'Master' }
  }

  GetVolume(opts?: { InstanceID?: number, Channel?: string }): Promise<{ CurrentVolume: string}> { return this._request('GetVolume', opts) }
  SetVolume(opts: { InstanceID?: number, Channel?: string , DesiredVolume: number}) { return this._request('SetVolume', opts) }

}
