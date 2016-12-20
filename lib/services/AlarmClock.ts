import { Service } from './Service'

export class AlarmClock extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'AlarmClock',
      host,
      port,
      controlURL: '/AlarmClock/Control',
      eventSubURL: '/AlarmClock/Event',
      SCPDURL: '/xml/AlarmClock1.xml',
    })
  }

  SetFormat(options) { return this._request('SetFormat', options) }
  GetFormat(options) { return this._request('GetFormat', options) }
  SetTimeZone(options) { return this._request('SetTimeZone', options) }
  GetTimeZone(options) { return this._request('GetTimeZone', options) }
  GetTimeZoneAndRule(options) { return this._request('GetTimeZoneAndRule', options) }
  GetTimeZoneRule(options) { return this._request('GetTimeZoneRule', options) }
  SetTimeServer(options) { return this._request('SetTimeServer', options) }
  GetTimeServer(options) { return this._request('GetTimeServer', options) }
  SetTimeNow(options) { return this._request('SetTimeNow', options) }
  GetHouseholdTimeAtStamp(options) { return this._request('GetHouseholdTimeAtStamp', options) }
  GetTimeNow(options) { return this._request('GetTimeNow', options) }
  CreateAlarm(options) { return this._request('CreateAlarm', options) }
  UpdateAlarm(options) { return this._request('UpdateAlarm', options) }
  DestroyAlarm(options) { return this._request('DestroyAlarm', options) }
  ListAlarms(options) { return this._request('ListAlarms', options) }
  SetDailyIndexRefreshTime(options) { return this._request('SetDailyIndexRefreshTime', options) }
  GetDailyIndexRefreshTime(options) { return this._request('GetDailyIndexRefreshTime', options) }

}
