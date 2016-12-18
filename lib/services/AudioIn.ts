import { Service } from './Service'

export class AudioIn extends Service {
  
  constructor(host: string, port?: number) {
    super({
      name: 'AudioIn',
      host,
      port,
      controlURL: '/AudioIn/Control',
      eventSubURL: '/AudioIn/Event',
      SCPDURL: '/xml/AudioIn1.xml'
    })
  }

  StartTransmissionToGroup(options) { return this._request('StartTransmissionToGroup', options) }
  StopTransmissionToGroup(options) { return this._request('StopTransmissionToGroup', options) }
  SetAudioInputAttributes(options) { return this._request('SetAudioInputAttributes', options) }
  GetAudioInputAttributes(options) { return this._request('GetAudioInputAttributes', options) }
  SetLineInLevel(options) { return this._request('SetLineInLevel', options) }
  GetLineInLevel(options) { return this._request('GetLineInLevel', options) }
  SelectAudio(options) { return this._request('SelectAudio', options) }

}