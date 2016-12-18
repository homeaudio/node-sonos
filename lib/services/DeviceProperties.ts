import { Service } from './Service'

export class DeviceProperties extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'DeviceProperties',
      host,
      port,
      controlURL: '/DeviceProperties/Control',
      eventSubURL: '/DeviceProperties/Event',
      SCPDURL: '/xml/DeviceProperties1.xml'
    })
  }

  SetLEDState(options) { return this._request('SetLEDState', options) }
  GetLEDState(options) { return this._request('GetLEDState', options) }
  SetInvisible(options) { return this._request('SetInvisible', options) }
  GetInvisible(options) { return this._request('GetInvisible', options) }
  AddBondedZones(options) { return this._request('AddBondedZones', options) }
  RemoveBondedZones(options) { return this._request('RemoveBondedZones', options) }
  CreateStereoPair(options) { return this._request('CreateStereoPair', options) }
  SeparateStereoPair(options) { return this._request('SeparateStereoPair', options) }
  SetZoneAttributes(options) { return this._request('SetZoneAttributes', options) }
  GetZoneAttributes(options) { return this._request('GetZoneAttributes', options) }
  GetHouseholdID(options) { return this._request('GetHouseholdID', options) }
  GetZoneInfo(options) { return this._request('GetZoneInfo', options) }
  SetAutoplayLinkedZones(options) { return this._request('SetAutoplayLinkedZones', options) }
  GetAutoplayLinkedZones(options) { return this._request('GetAutoplayLinkedZones', options) }
  SetAutoplayRoomUUID(options) { return this._request('SetAutoplayRoomUUID', options) }
  GetAutoplayRoomUUID(options) { return this._request('GetAutoplayRoomUUID', options) }
  SetAutoplayVolume(options) { return this._request('SetAutoplayVolume', options) }
  GetAutoplayVolume(options) { return this._request('GetAutoplayVolume', options) }
  ImportSetting(options) { return this._request('ImportSetting', options) }
  SetUseAutoplayVolume(options) { return this._request('SetUseAutoplayVolume', options) }
  GetUseAutoplayVolume(options) { return this._request('GetUseAutoplayVolume', options) }
  AddHTSatellite(options) { return this._request('AddHTSatellite', options) }
  RemoveHTSatellite(options) { return this._request('RemoveHTSatellite', options) }

}
