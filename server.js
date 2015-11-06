var ipc = require('ipc')

function Server (webContents) {
  this.methods = {}
  this.clients = {}
  this.clientMap = {}
  this.webContents = webContents

  // ipc.removeAllListeners('request-message')
  this._requestMessageHandler = requestMessageHandler.bind(this)
  this._responseMessageHandler = responseMessageHandler.bind(this)
  this._eventMessageHandler = eventMessageHandler.bind(this)
  this._registerClient = registerClient.bind(this)
  ipc.on('response-message', this._responseMessageHandler)
  ipc.on('request-message', this._requestMessageHandler)
  ipc.on('send-event', this._eventMessageHandler)
  ipc.on('register-client', this._registerClient)
}

Server.prototype.send = function (action, body) {
  var response = {action: action, body: body}
  sendResponse.call(this, response)
}

function sendResponse (response) {
  if (!this.webContents) return console.error(new Error("The electron-rpc Server isn't configured. Please use server.configure(eventEmitter)"))
  this.webContents.send('response-message', response)
}

Server.prototype.configure = function (webContents) {
  this.webContents = webContents
  return this
}

Server.prototype.on = function (action, callback) {
  this.methods[action] = callback
  return this
}

Server.prototype.destroy = function () {
  this.methods = {}
  this.webContents = undefined
  ipc.removeListener('request-message', this._requestMessageHandler)
}

function registerClient (ev, name, options) {
  this.clients[name] = ev.sender
  this.clientMap[name] = options.peer
  // console.log(this.clientMap)
}

function eventMessageHandler (ev, data) {
  var sender = this.clients[this.clientMap[data.sender]]
  sender.send('send-event', data)
}

function requestMessageHandler (ev, data) {
  var sender = this.clients[this.clientMap[data.sender]]
  sender.send('request-message', data)
}

function responseMessageHandler (ev, data) {
  var sender = this.clients[this.clientMap[data.sender]]
  sender.send('response-message', data)
}

// function requestMessageHandler (ev, data) {
//   var self = this
//   var response = {id: data.id, action: data.action}
//   var request = {id: data.id, action: data.action, body: data.body}
//   var actionHandler = self.methods[request.action]
//   if (!actionHandler) {
//     response.error = {message: 'Route not found', statusCode: 404}
//     return sendResponse.call(self, response)
//   } else {
//     actionHandler(request, function (error, body) {
//       response.error = error
//       response.body = body
//       sendResponse.call(self, response)
//     })
//   }
// }

module.exports = Server
