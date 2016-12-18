import { Service } from './Service'

export class SystemProperties extends Service {
  
  constructor(host: string, port?: number) {
    super({
      name: 'SystemProperties',
      host,
      port,
      controlURL: '/SystemProperties/Control',
      eventSubURL: '/SystemProperties/Event',
      SCPDURL: '/xml/SystemProperties1.xml'
    })
  }

  SetString(options) { return this._request('SetString', options) }
  SetStringX(options) { return this._request('SetStringX', options) }
  GetString(options) { return this._request('GetString', options) }
  GetStringX(options) { return this._request('GetStringX', options) }
  Remove(options) { return this._request('Remove', options) }
  RemoveX(options) { return this._request('RemoveX', options) }
  GetWebCode(options) { return this._request('GetWebCode', options) }
  ProvisionTrialAccount(options) { return this._request('ProvisionTrialAccount', options) }
  ProvisionCredentialedTrialAccountX(options) { return this._request('ProvisionCredentialedTrialAccountX', options) }
  MigrateTrialAccountX(options) { return this._request('MigrateTrialAccountX', options) }
  AddAccountX(options) { return this._request('AddAccountX', options) }
  AddAccountWithCredentialsX(options) { return this._request('AddAccountWithCredentialsX', options) }
  RemoveAccount(options) { return this._request('RemoveAccount', options) }
  EditAccountPasswordX(options) { return this._request('EditAccountPasswordX', options) }
  EditAccountMd(options) { return this._request('EditAccountMd', options) }
  DoPostUpdateTasks(options) { return this._request('DoPostUpdateTasks', options) }
  ResetThirdPartyCredentials(options) { return this._request('ResetThirdPartyCredentials', options) }

}
