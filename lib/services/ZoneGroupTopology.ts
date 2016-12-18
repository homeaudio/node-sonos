import { Service } from './Service'

export class ZoneGroupTopology extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'ZoneGroupTopology',
      host,
      port,
      controlURL: '/ZoneGroupTopology/Control',
      eventSubURL: '/ZoneGroupTopology/Event',
      SCPDURL: '/xml/ZoneGroupTopology1.xml'
    })
  }

  CheckForUpdate(options) { return this._request('CheckForUpdate', options) }
  BeginSoftwareUpdate(options) { return this._request('BeginSoftwareUpdate', options) }
  ReportUnresponsiveDevice(options) { return this._request('ReportUnresponsiveDevice', options) }
  ReportAlarmStartedRunning(options) { return this._request('ReportAlarmStartedRunning', options) }
  SubmitDiagnostics(options) { return this._request('SubmitDiagnostics', options) }
  RegisterMobileDevice(options) { return this._request('RegisterMobileDevice', options) }
  GetZoneGroupAttributes(options) { return this._request('GetZoneGroupAttributes', options) }

}
