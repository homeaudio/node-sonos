import { Service } from './Service'

export interface ContentDirectoryBrowseOptions {
      BrowseFlag: string
      Filter: string
      StartingIndex: string
      RequestedCount: string
      SortCriteria: string
      ObjectID: string
}

export class ContentDirectory extends Service {

  constructor(host: string, port?: number) {
    super({
      name: 'ContentDirectory',
      host,
      port,
      controlURL: '/MediaServer/ContentDirectory/Control',
      eventSubURL: '/MediaServer/ContentDirectory/Event',
      SCPDURL: '/xml/ContentDirectory1.xml',
    })
  }

  Browse(options: ContentDirectoryBrowseOptions) { return this._request('Browse', options) }

}
