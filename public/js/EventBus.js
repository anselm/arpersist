
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// An event bus to help decouple components
/// Supports an idea of event callbacks or just shared variable storage
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
class EventBus {
	constructor(){
		this.messages = {} // holds labels and associated arrays of messages pending
		this.listeners = {} // holds labels and associated arrays of unique listeners (which will all be triggered in order if matching a message label)
	}
	listen(label,listener) {
		let listeners = this.listeners[label]
		if(!listeners) {
			listeners = this.listeners[label] = []
		}
		for(let i = 0; i < listeners.length;i++) {
			if(listener === listener[i]) return
		}
		listeners.push(listener)
	}
	unlisten(label,listener) {
		let listeners = this.listeners[label]
		if(!listeners) {
			listeners = this.listeners[label] = []
		}
		for(let i = 0; i < listeners.length;i++) {
			if(listener === listener[i]) listeners.splice(i,1) // TODO may be better to return a unique id on listen() instead of === test here
		}
	}
	set(label,...args) {
		// call listeners if any
		let listeners = this.listeners[label]
		if(listeners) {
			listeners.map((listener)=>{
				listener(args)
			})
		}
		// save value also - always as an array of values
		this.messages[label] = args
	}
	push(label,...args) {
		let m = this.messages[label]
		if(!m) m = this.messages[label] = []
		m.concat(args)
		return m
	}
	get(label,flush=true){
		let args = this.messages[label] || []
		if(flush) this.messages[label]=[]
		return args
	}
	log(message) {
		push("log","log",message)
	}
	err(message) {
		push("log","err",message)
	}
}
const eventbus = window.eventbus = new EventBus();
Object.freeze(eventbus);
*/
