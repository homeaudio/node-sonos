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

  get bodyExtras() {
    return { InstanceID: 0 }
  }

  SetAVTransportURI(opts: {
    CurrentURI: string,
    CurrentURIMetaData: string,
    InstanceID?: number,
  }) { return this._request('SetAVTransportURI', opts) }
  AddURIToQueue(opts: {
    EnqueuedURI: string,
    EnqueuedURIMetaData: string,
    DesiredFirstTrackNumberEnqueued: number,
    EnqueueAsNext: 1 | 0,
    InstanceID?: number,
  }) { return this._request('AddURIToQueue', opts) }
  AddMultipleURIsToQueue(options) { return this._request('AddMultipleURIsToQueue', options) }
  ReorderTracksInQueue(options) { return this._request('ReorderTracksInQueue', options) }
  RemoveTrackFromQueue(options) { return this._request('RemoveTrackFromQueue', options) }
  RemoveTrackRangeFromQueue(options) { return this._request('RemoveTrackRangeFromQueue', options) }
  RemoveAllTracksFromQueue() { return this._request('RemoveAllTracksFromQueue') }
  SaveQueue(options) { return this._request('SaveQueue', options) }
  BackupQueue(options) { return this._request('BackupQueue', options) }
  GetMediaInfo(options) { return this._request('GetMediaInfo', options) }
  GetTransportInfo(opts?: { InstanceID?: number }): Promise<{
    CurrentTransportState: 'STOPPED' | 'PLAYING' | 'PAUSED_PLAYBACK' | 'TRANSITIONING' | 'NO_MEDIA_PRESENT'
    CurrentTransportStatus: string,
    CurrentSpeed: '1',
  }> { return this._request('GetTransportInfo', opts) }
  GetPositionInfo(opts?: { InstanceID?: number}) { return this._request('GetPositionInfo', opts) }
  GetDeviceCapabilities(options) { return this._request('GetDeviceCapabilities', options) }
  GetTransportSettings(options) { return this._request('GetTransportSettings', options) }
  GetCrossfadeMode(options) { return this._request('GetCrossfadeMode', options) }
  Stop(opts: { Speed: number, InstanceID?: number }) { return this._request('Stop', opts) }
  Play(opts: { Speed: number, InstanceID?: number }) { return this._request('Play', opts) }
  Pause(opts: { Speed: number, InstanceID?: number }) { return this._request('Pause', opts) }
  Seek(opts: { Unit: 'TRACK_NR' | 'REL_TIME', Target: string | number }) { return this._request('Seek', opts) }
  Next(opts: { Speed: number, InstanceID?: number }) { return this._request('Next', opts) }
  NextProgrammedRadioTracks(options) { return this._request('NextProgrammedRadioTracks', options) }
  Previous(opts: { Speed: number, InstanceID?: number }) { return this._request('Previous', opts) }
  NextSection(options) { return this._request('NextSection', options) }
  PreviousSection(options) { return this._request('PreviousSection', options) }
  SetPlayMode(opts: {
    NewPlayMode: 'NORMAL' | 'REPEAT_ALL' | 'SHUFFLE' | 'SHUFFLE_NOREPEAT',
    InstanceID?: number,
  }) { return this._request('SetPlayMode', opts) }
  SetCrossfadeMode(options) { return this._request('SetCrossfadeMode', options) }
  NotifyDeletedURI(options) { return this._request('NotifyDeletedURI', options) }
  GetCurrentTransportActions(options) { return this._request('GetCurrentTransportActions', options) }
  BecomeCoordinatorOfStandaloneGroup(opts?: {InstanceID?: number}) { return this._request('BecomeCoordinatorOfStandaloneGroup', opts) }
  DelegateGroupCoordinationTo(options) { return this._request('DelegateGroupCoordinationTo', options) }
  BecomeGroupCoordinator(options) { return this._request('BecomeGroupCoordinator', options) }
  BecomeGroupCoordinatorAndSource(options) { return this._request('BecomeGroupCoordinatorAndSource', options) }

}
