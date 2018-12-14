
///
/// UXComponent
///
///	- a base class for components
///	- provides inter component messaging
///	- doesn't support an observables pattern yet - wouldn't be hard to add
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
		if(element.onhide) element.onhide()
	}
	hide(name) { return this.constructor.hide(name) }

	static show(name) {
		if(ux_showing == name ) return
		UXPage.hide(ux_showing)
		ux_showing = name
		let element = document.getElementById(name)
		if(element) element.style.display = "block"
		if(element.onshow) element.onshow()
	}
	show(name) { return this.constructor.show(name) }
}

// TODO - having a hard coded router is kind of coercive

window.onpopstate = (e) => {
	if(!e || !e.state) {
		UXPage.err(" backbutton - bad input for popstate; or external push state?")
	} else {
		UXPage.show(e.state.name)
	}
}


