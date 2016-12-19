import { Service } from './Service'

export class AVTransport extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'AVTransport',
      host,
      port,
      controlURL: '/MediaRenderer/AVTransport/Control',
      eventSubURL: '/MediaRenderer/AVTransport/Event',
      SCPDURL: '/xml/AVTransport1.xml',
    })
  }

  SetAVTransportURI(options) { return this._request('SetAVTransportURI', options) }
  AddURIToQueue(options) { return this._request('AddURIToQueue', options) }
  AddMultipleURIsToQueue(options) { return this._request('AddMultipleURIsToQueue', options) }
  ReorderTracksInQueue(options) { return this._request('ReorderTracksInQueue', options) }
  RemoveTrackFromQueue(options) { return this._request('RemoveTrackFromQueue', options) }
  RemoveTrackRangeFromQueue(options) { return this._request('RemoveTrackRangeFromQueue', options) }
  RemoveAllTracksFromQueue(options) { return this._request('RemoveAllTracksFromQueue', options) }
  SaveQueue(options) { return this._request('SaveQueue', options) }
  BackupQueue(options) { return this._request('BackupQueue', options) }
  GetMediaInfo(options) { return this._request('GetMediaInfo', options) }
  GetTransportInfo(options) { return this._request('GetTransportInfo', options) }
  GetPositionInfo(options) { return this._request('GetPositionInfo', options) }
  GetDeviceCapabilities(options) { return this._request('GetDeviceCapabilities', options) }
  GetTransportSettings(options) { return this._request('GetTransportSettings', options) }
  GetCrossfadeMode(options) { return this._request('GetCrossfadeMode', options) }
  Stop(options) { return this._request('Stop', options) }
  Play(options) { return this._request('Play', options) }
  Pause(options) { return this._request('Pause', options) }
  Seek(options) { return this._request('Seek', options) }
  Next(options) { return this._request('Next', options) }
  NextProgrammedRadioTracks(options) { return this._request('NextProgrammedRadioTracks', options) }
  Previous(options) { return this._request('Previous', options) }
  NextSection(options) { return this._request('NextSection', options) }
  PreviousSection(options) { return this._request('PreviousSection', options) }
  SetPlayMode(options) { return this._request('SetPlayMode', options) }
  SetCrossfadeMode(options) { return this._request('SetCrossfadeMode', options) }
  NotifyDeletedURI(options) { return this._request('NotifyDeletedURI', options) }
  GetCurrentTransportActions(options) { return this._request('GetCurrentTransportActions', options) }
  BecomeCoordinatorOfStandaloneGroup(options) { return this._request('BecomeCoordinatorOfStandaloneGroup', options) }
  DelegateGroupCoordinationTo(options) { return this._request('DelegateGroupCoordinationTo', options) }
  BecomeGroupCoordinator(options) { return this._request('BecomeGroupCoordinator', options) }
  BecomeGroupCoordinatorAndSource(options) { return this._request('BecomeGroupCoordinatorAndSource', options) }

}
