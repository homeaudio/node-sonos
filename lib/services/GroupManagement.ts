import { Service } from './Service'

export class GroupManagement extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'GroupManagement',
      host,
      port,
      controlURL: '/GroupManagement/Control',
      eventSubURL: '/GroupManagement/Event',
      SCPDURL: '/xml/GroupManagement1.xml'
    })
  }

  AddMember(options, callback) { this._request('AddMember', options, callback) }
  RemoveMember(options, callback) { this._request('RemoveMember', options, callback) }
  ReportTrackBufferingResult(options, callback) { this._request('ReportTrackBufferingResult', options, callback) }

}
