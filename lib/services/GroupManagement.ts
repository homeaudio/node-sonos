import { Service } from './Service'

export class GroupManagement extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'GroupManagement',
      host,
      port,
      controlURL: '/GroupManagement/Control',
      eventSubURL: '/GroupManagement/Event',
      SCPDURL: '/xml/GroupManagement1.xml',
    })
  }

  AddMember(options) { return this._request('AddMember', options) }
  RemoveMember(options) { return this._request('RemoveMember', options) }
  ReportTrackBufferingResult(options) { return this._request('ReportTrackBufferingResult', options) }

}
