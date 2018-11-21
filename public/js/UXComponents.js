

// helper to get url params
export function UXUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}


///
/// UXComponent
/// - a minimalist message bus to send and receive messages between components
/// - to help decouple and de-stress formal relationships between pieces of code
/// - so that code pieces don't have to know about each other in the global namespace
/// - so that code pieces can be notified about events as they happen with less brittle entanglements
///

let ux_listeners = {}
let ux_state = {}

export class UXComponent {
	constructor() {
		// TODO could have a global instance rather than global variables
	}

	static msg(args) {
		// calls EVERY listener for now with a raw hash of args - TODO later make it filter based on listener matching 'kind' prop
		let listeners = ux_listeners[args.kind] || []
		listeners.forEach((callback) => {
			callback(args)
		})
	}
	msg(args) {
		args.className = this.__proto__.constructor.name
		return this.constructor.msg(args)
	}

	static listen(kind,callback) {
		let listeners = ux_listeners[kind] || []
		listeners.push(callback)
		ux_listeners[kind] = listeners
	}
	listen(kind,callback) {
		return this.constructor.listen(kind,callback)
	}

	static log(obj) {
		// add a log convenience method that actually just talks to msg
		let args = { kind:"log", value:obj }
		UXComponent.msg(args)
	}
	log(obj) {
		let args = { kind:"log", value:obj, className: this.__proto__.constructor.name }
		UXComponent.msg(args)
	}

	static err(obj) {
		// add a log convenience method that actually just talks to msg
		let args = { kind:"err", value:obj }
		UXComponent.msg(args)
	}
	err(obj) {
		let args = { kind:"err", value:obj, className: this.__proto__.constructor.name }
		UXComponent.msg(args)
	}

	static action(name,subvalue=0) {
		// add an action (post a string to everybody) convenience method that actually just talks to msg
		let args = {kind:'action',value:name,subvalue:subvalue}
		UXPage.msg(args)
	}
	action(name,subvalue=0) {
		let args = {kind:'action',value:name,subvalue:subvalue,className:this.__proto__.constructor.name}
		return this.constructor.msg(args)
	}

	static save(name,value) {
		// save and load global variables
		ux_state[name] = value
	}
	save(name,value) {
		return this.constructor.save(name,value)
	}

	static load(name) {
		return ux_state[name];
	}
	load(name) {
		return this.constructor.load(name)
	}

}

///
/// UXPages
/// - a way to relate a dom element to a component
/// - each div or dom element has a one to one relationship with a single component
///	- manage hiding and showing html dom components in relationship with the browsers built in navigator page stack
/// - the name of the div id is equal to the name of the navigator path hash
/// - notifies components when shown or hidden using the message bus
/// - could be used as a top level page management construct for an app
///

let ux_pages = {}
let ux_showing = 0

export class UXPage extends UXComponent {

	constructor() {
		super()
		window.onpopstate = (e) => {
			// sets onpopstate handler over and over but that should be ok - another option would be to make this static
			if(!e || !e.state) {
				this.err(" backbutton - bad input for popstate; or external push state?")
			} else {
				this.log(" user hit back button " + document.location + ", state: " + JSON.stringify(event.state) )
				this.show(e.state.name)
			}
		}
	}

	static bind(name,component) {
		ux_pages[name] = component
	}
	bind(name,component) { return this.constructor.bind(name,component) }

	static push(name) {
		history.pushState({name:name},name,"#" + name );
		UXPage.show(name)
	}
	push(name) { return this.constructor.push(name) }

	static pop() {
		history.back()
	}
	pop() { return this.constructor.pop() }

	static hide(name) {
		if(!name) return
		let element = document.getElementById(name)
		if(element) element.style.display = "none"
		UXComponent.msg({kind:"hide",name:name})
	}
	hide(name) { return this.constructor.hide(name) }

	static show(name) {
		if(ux_showing == name ) return
		UXPage.hide(ux_showing)
		ux_showing = name
		let element = document.getElementById(name)
		if(element) element.style.display = "block"
		UXComponent.msg({kind:"show",name:name})
	}
	show(name) { return this.constructor.show(name) }
}

///
/// UXLog
/// - listens to messages and paints errors to a dom element (as well as to console)
///

export class UXLog extends UXComponent {
	constructor(dom_element_id) {
		super()
		this.display = []
		this.target = document.getElementById(dom_element_id)
		if(!this.target) return
		this.listen("log",this.print.bind(this))
		this.listen("err",this.print.bind(this))
	}
	print(args) {
		let buffer = ""
		if (typeof args.value == 'string' || args.value instanceof String) {
			buffer = args.value
		} else if(args.value instanceof Array || Array.isArray(args.value)) {
			buffer = args.value.join(" ")
		}
		if(args.kind=="err") {
			console.error("className log: " + args.className + " message: " + buffer)			
			buffer = "<font color=red> " + buffer + "</font>"
		} else {
			console.log("className log: " + args.className + " message: " + buffer)			
		}
		this.display.unshift(buffer)
		this.display = this.display.slice(0,10)
		this.target.innerHTML = this.display.join("<br/>")
	}
}
