
///
/// Allow senders and receivers to be totally decoupled
///

export class Messaging {
  static message(kind,args=0) {
    if(!this.listeners) this.listeners = {}
    let topic = this.listeners[kind] || []
    if(topic && topic.length) topic.forEach((callback) => { if(callback)callback(args) })
  }
  message(kind,args=0) {
    args.className = this.__proto__.constructor.name
    return this.constructor.message(kind,args)
  }
  static listen(kind,callback) {
    if(!this.listeners) this.listeners = {}
    let topic = this.listeners[kind] || []
    if(topic && callback)topic.push(callback)
    this.listeners[kind] = topic
  }
  listen(kind,callback) {
    args.className = this.__proto__.constructor.name
    return this.constructor.message(kind,callback)
  }
}

