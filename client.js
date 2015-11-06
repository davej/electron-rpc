var events = require('events')
var ipc = require('ipc')

function Client (name, options) {
  this.methods = {}
  this.requests = {}
  this.clientName = name
  this.remoteEventEmitter = ipc
  this.localEventEmitter = new events.EventEmitter()
  this._responseMessageHandler = responseMessageHandler.bind(this)
  this._requestMessageHandler = requestMessageHandler.bind(this)
  this._eventMessageHandler = eventMessageHandler.bind(this)


  ipc.on('response-message', this._responseMessageHandler)
  ipc.on('request-message', this._requestMessageHandler)
  ipc.on('send-event', this._eventMessageHandler)
  ipc.send('register-client', name, options)
}

Client.prototype.request = function (action, body, callback) {
  if (typeof body === 'function') {
    callback = body
    body = undefined
  }

  var id = Math.random().toString(16).slice(2)
  var request = {id: id, action: action, body: body, sender: this.clientName}
  this.remoteEventEmitter.send('request-message', request)

  // We can only handle requests with a callback
  if (callback) {
    this.requests[request.id] = request
    this.requests[request.id].callback = callback
  }
}

Client.prototype.on = function (action, callback) {
  // if (data.sender === this.clientName) {
  //   this.localEventEmitter.on('response-message:' + action, callback)
  // } else {
    this.methods[action] = callback
    return this
  // }
}

Client.prototype.removeListener = function (action, callback) {
  this.localEventEmitter.removeListener('response-message:' + action, callback)
}

Client.prototype.destroy = function () {
  this.localEventEmitter.removeAllListeners()
  this.remoteEventEmitter.removeListener('response-message', this._responseMessageHandler)
}

Client.prototype.send = function (action, body) {
  var params = {action: action, body: body, sender: this.clientName}
  this.remoteEventEmitter.send('send-event', params)
}

function convertErrorResponse (err) {
  var error = new Error(err.message);
  error.type = err.type;
  error.name = err.name;
  error.arguments = err.arguments;
  error.stack = err.stack;
  return error;
}

function convertErrorRequest (err) {
  err = JSON.parse(JSON.stringify(err, ["message", "arguments", "type", "name", "stack"]))
  err.isError = true;
  return err
}

function eventMessageHandler (params) {
  // console.log(this.clientName, 'resp', response)
  // Ignore if the request comes from itself
  if (params.sender === this.clientName) return
  var actionHandler = this.methods[params.action]
  if (actionHandler) {
    actionHandler(params.body)
  }
}

function responseMessageHandler (response) {
  // console.log(this.clientName, 'resp', response)
  // Ignore if the request comes from itself
  if (response.sender === this.clientName) return;

  if (response.error && typeof(response.error) === 'object' && response.error.isError && response.error.message) {
    response.error = convertErrorResponse(response.error)
  }

  this.localEventEmitter.emit('response-message:' + response.action, response.error, response.body)
  if (response.id) {
    var request = this.requests[response.id]
    if (request && request.callback) request.callback(response.error, response.body)
    this.requests[response.id] = undefined
  }
}

function requestMessageHandler (data) {
  // console.log(this.clientName, 'req', data)
  // Ignore if the request comes from itself
  if (data.sender === this.clientName) return

  var self = this
  var response = {id: data.id, action: data.action, sender: this.clientName}
  var request = {id: data.id, action: data.action, body: data.body, sender: data.sender}
  var actionHandler = self.methods[request.action]
  if (!actionHandler) {
    response.error = {message: 'Route not found', statusCode: 404}
    return sendResponse.call(self, response)
  } else {
    actionHandler(data.body, function (error, body) {
      if (error instanceof Error) {
        error = convertErrorRequest(error)
      }
      response.error = error
      response.body = body
      ipc.send('response-message', response)
    })
  }
}

module.exports = Client
