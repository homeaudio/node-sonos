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

  CheckForUpdate(options, callback) { this._request('CheckForUpdate', options, callback) }
  BeginSoftwareUpdate(options, callback) { this._request('BeginSoftwareUpdate', options, callback) }
  ReportUnresponsiveDevice(options, callback) { this._request('ReportUnresponsiveDevice', options, callback) }
  ReportAlarmStartedRunning(options, callback) { this._request('ReportAlarmStartedRunning', options, callback) }
  SubmitDiagnostics(options, callback) { this._request('SubmitDiagnostics', options, callback) }
  RegisterMobileDevice(options, callback) { this._request('RegisterMobileDevice', options, callback) }
  GetZoneGroupAttributes(options, callback) { this._request('GetZoneGroupAttributes', options, callback) }

}
