

// helper to get url params
export function UXUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}


///
/// UXComponent
///
///	- a base class for components
///	- provides inter component messaging
///	- doesn't support an observables pattern yet - wouldn't be hard to add
///	- does have some sugar with log() and action() wrappers for msg()
///	- right now msg takes a single hash and the 'kind' attribute is the message target; arguably this could be two params but thats bulkier
///	- does have a state storage system to allow state to be shared between things easily; may remove?
///

let ux_listeners = {}
let ux_state = {}

export class UXComponent {


	static msg(args) {
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
		// for convenience - just forwards as a message
		let args = { kind:"log", value:obj }
		UXComponent.msg(args)
	}
	log(obj) {
		let args = { kind:"log", value:obj, className: this.__proto__.constructor.name }
		UXComponent.msg(args)
	}

	static err(obj) {
		// for convenience - just forwards as a message
		let args = { kind:"err", value:obj }
		UXComponent.msg(args)
	}
	err(obj) {
		let args = { kind:"err", value:obj, className: this.__proto__.constructor.name }
		UXComponent.msg(args)
	}


	static action(name,subvalue=0) {
		// for convenienve - send a message called action
		let args = {kind:'action',value:name,subvalue:subvalue}
		UXPage.msg(args)
	}
	action(name,subvalue=0) {
		let args = {kind:'action',value:name,subvalue:subvalue,className:this.__proto__.constructor.name}
		return this.constructor.msg(args)
	}


	static save(name,value) {
		// save and load shared state variables visible to component subclasses
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
/// A concept of a dom painter that lets a developer build up a dom with some minimal help
///

export class UXDOM {

	constructor() {
		this.buffer = "";
	}

	raw(str) {
		this.buffer += str + "\n";
	}
	div(contents,_class="",style="") {
		this.buffer += "<div class='"+_class+"' style='"+style+"'>"+contents+"</div>";
	}
	h1(contents,_class="",style="") {
		this.buffer += "<h1 class='"+_class+"' style='"+style+"'>"+contents+"</h1>";
	}
	finish() {
		//document.getElementById("root").innerHTML = buffer;
	}

}

///
/// UXPage
///
/// - a base class to support an idea of components to render a display
/// - uses push/pop navigation (but routing page transitions is outside of local scope here)
/// - builds on top of a messaging bus to let components ostensibly talk to each other
/// - doesn't really have any idea of a shared state kind of automatic refreshing thing (but there is a message bus one can listen to)
///
///

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
		let cname = args.className || ""
		if(args.kind=="err") {
			console.error(cname + " message: " + buffer)			
			buffer = "<font color=red> " + buffer + "</font>"
		} else {
			console.log(cname + " message: " + buffer)			
		}
		this.display.unshift(buffer)
		this.display = this.display.slice(0,10)
		this.target.innerHTML = this.display.join("<br/>")
	}
}
