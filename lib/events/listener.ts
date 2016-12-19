import * as request from 'request'
import * as http from 'http'
import * as ip from 'ip'
import * as xml2js from 'xml2js'
import * as _ from 'underscore'
import { EventEmitter } from 'events'
import { Sonos } from '../sonos'


interface ListnerOptions {
  port?: number,
  interface?: string
}

export class Listener extends EventEmitter {

  device: Sonos
  parser: xml2js.Parser
  services
  interface: string
  port: number
  server: http.Server

  /**
   * @param options If you want to use a different interface for listening, specify the name in options.interface
   */
  constructor(device: Sonos, options: ListnerOptions = {}) {
    super()
    this.device = device
    this.parser = new xml2js.Parser()
    this.services = {}
    this.port = options.port || 0
    this.interface = options.interface || 'public'
  }

  _startInternalServer(callback) {

    this.server = http.createServer((req, res) => {
      let buffer = ''

      req.on('data',  d => buffer += d)

      req.on('end', () => {
        req.body = buffer
        this._messageHandler(req, res)
      })

    })

    this.server.listen(this.port, () => {
      if (this.port === 0) {
        this.port = this.server.address().port
      }
      callback(null, this.port)

      setInterval(this._renewServices.bind(this), 1 * 1000)
    })
  }

  _messageHandler(req, res) {
    if (req.method.toUpperCase() === 'NOTIFY' && req.url.toLowerCase() === '/notify') {
      if (!this.services[req.headers.sid]) {
        return
      }

      const thisService = this.services[req.headers.sid]

      const items = thisService.data || {}
      this.parser.parseString(req.body.toString(), (error, data) => {
        if (error) {
          res.end(500)
        }
        _.each(data['e:propertyset']['e:property'], (element) => {
          _.each(_.keys(element), key => {
            items[key] = element[key][0]
          })
        })

        this.emit('serviceEvent', thisService.endpoint, req.headers.sid, thisService.data)
        res.end()
      })
    }
  }

  _renewServices() {

    const now = new Date().getTime()

    const renew = (sid) => (err, response) => {
        const serviceEndpoint = this.services[sid].endpoint

        if (err || ((response.statusCode !== 200) && (response.statusCode !== 412))) {
          this.emit('error', err || response.statusMessage, serviceEndpoint, sid)
        } else if (response.statusCode === 412) {
          // restarted, this is why renewal is at most 300sec
          delete this.services[sid]
          this.addService(serviceEndpoint, (err, sid) => {
            if (err) {
              this.emit('error', err, serviceEndpoint, sid)
            }
          })
        } else {
          this.services[sid].renew = this.renew_at(response.headers.timeout)
        }
    }

    for (const sid in this.services) {
      const thisService = this.services[sid]

      if (now < thisService.renew) {
        continue
      }

      const opt = {
        url: 'http://' + this.device.host + ':' + this.device.port + thisService.endpoint,
        method: 'SUBSCRIBE',
        headers: {
          SID: sid,
          Timeout: 'Second-3600',
        },
      }

      request(opt, renew(sid))
    }
  }

  addService(serviceEndpoint, callback) {
    if (!this.server) {
      throw new Error('Service endpoints can only be added after listen() is called')
    } else {
      const opt = {
        url: 'http://' + this.device.host + ':' + this.device.port + serviceEndpoint,
        method: 'SUBSCRIBE',
        headers: {
          callback: '<http://' + ip.address(this.interface) + ':' + this.port + '/notify>',
          NT: 'upnp:event',
          Timeout: 'Second-3600',
        },
      }

      request(opt, (err, response) => {
        if (err || response.statusCode !== 200) {
          if (!callback) {
            return console.log(err || response.message || response.statusCode)
          }
          callback(err || response.statusMessage)
        } else {
          callback(null, response.headers.sid)

          this.services[response.headers.sid] = {
            renew: this.renew_at(response.headers.timeout),
            endpoint: serviceEndpoint,
            data: {},
          }
        }
      })
    }
  }

  renew_at(timeout) {

    if ((!!timeout) && (timeout.indexOf('Second-') === 0)) {
      timeout = timeout.substr(7)
    }
    let seconds = (((!!timeout) && (!isNaN(timeout))) ? parseInt(timeout, 10) : 3600) - 15
    if (seconds < 0) {
      seconds = 15
    } else if (seconds > 300) {
      seconds = 300
    }

    return (new Date().getTime() + (seconds * 1000))
  }

  listen(callback) {
    if (!this.server) {
      this._startInternalServer(callback)
    } else {
      throw new Error('Service listener is already listening')
    }
  }

  removeService(sid, callback) {
    if (!this.server) {
      throw new Error('Service endpoints can only be modified after listen() is called')
    } else if (!this.services[sid]) {
      throw new Error('Service with sid ' + sid + ' is not registered')
    } else {
      const opt = {
        url: 'http://' + this.device.host + ':' + this.device.port + this.services[sid].endpoint,
        method: 'UNSUBSCRIBE',
        headers: {
          sid,
        },
      }

      request(opt, (err, response) => {
        if (err || response.statusCode !== 200) {
          callback(err || response.statusCode)
        } else {
          callback(null, true)
        }
      })
    }
  }

}
