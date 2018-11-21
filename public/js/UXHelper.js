
function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

///
/// UXComponent
/// - a minimalist message bus to send and receive messages between components
/// - to help decouple and de-stress formal relationships between pieces of code
/// - so that code pieces don't have to know about each other in the global namespace
/// - so that code pieces can be notified about events as they happen with less brittle entanglements
///

let ux_listeners = []

class UXComponent {
	constructor() {
		// TODO could have a global instance rather than global variables
	}

	static msg(args) {
		// calls EVERY listener for now - TODO later make it filter here
		ux_listeners.forEach((callback) => {
			callback(args)
		})
	}
	msg(args) {
		args.className = this.__proto__.constructor.name
		return this.constructor.msg(args)
	}

	static listen(args) {
		ux_listeners.push(args)
	}
	listen(args) {
		args.className = this.__proto__.constructor.name
		return this.constructor.listen(args)
	}

	static log(obj) {
		let args = { className: "unknown", kind:"log", value:obj }
		UXComponent.msg(args)
	}
	log(obj) {
		let args = { className: this.__proto__.constructor.name, kind:"log", value:obj }
		UXComponent.msg(args)
	}

	static err(obj) {
		let args = { className: "unknown", kind:"err", value:obj }
		UXComponent.msg(args)
	}
	err(obj) {
		let args = { className: this.__proto__.constructor.name, kind:"err", value:obj }
		UXComponent.msg(args)
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

class UXPages extends UXComponent {

	constructor() {
		super()
		this.pages = {}
		this.showing = 0

		// the push/pop handler provided by javascript seems flakey? some debugging is left here to keep an eye on it
		window.onpopstate = (e) => {
			if(!e || !e.state) {
				this.err("UXPages::popstate: bad input for popstate; or external push state?")
				this.err(e)
				return
			}
			this.err("UXPages::popstate: user browser hit back button")
			this.err("UXPages::popstate: location: " + document.location + ", state: " + JSON.stringify(event.state));
			this.show(e.state.name)
		}

		this.log("Starting up")
	}

	bind(name,component) {
		this.pages[name] = component
	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
		history.back()
	}

	hide(name) {
		if(!name) return
		let element = document.getElementById(name)
		if(element) element.style.display = "none"
		this.msg({kind:"hide",name:name})
	}

	show(name) {
		if(this.showing == name ) return
		this.hide(this.showing)
		this.showing = name
		let element = document.getElementById(name)
		if(element) element.style.display = "block"
		this.msg({kind:"show",name:name})
	}

}

///
/// UXLog
/// - listens to messages and paints errors to a dom element
///

class UXLog extends UXComponent {
	constructor(dom_element_id) {
		super()
		this.display = []
		this.target = document.getElementById(dom_element_id)
		if(!this.target) return
		this.listen((args)=>{ 
			if(args.kind=="log" || args.kind=="err") this.print(args)
		})
	}
	print(args) {
		let buffer = ""
		if (typeof args.value == 'string' || args.value instanceof String) {
			buffer = args.value
		} else if(args.value instanceof Array || Array.isArray(args.value)) {
			buffer = args.value.join(" ")
		}
		console.log(args)
		console.log(args.className + ": " + buffer)
		this.display.unshift(buffer)
		this.target.innerHTML = this.display.slice(0,10).join("<br/>")
	}
}

class UXPick extends UXComponent {
}

class UXEdit extends UXComponent {
}

class UXMap extends UXComponent {
}

class UXAugmentedReality extends UXComponent {
	constructor(dom_element_id) {
		super()
		this.target = document.getElementById(dom_element_id)
	}
}

function bootstrap() {

	// start a logging comnponent that observes log messages and paints to a dom element
	let logging = new UXLog("ux_help")

	// start the augmented reality code which manages network state and paints object to display using 3js and also has a pass through camera
	let ar = new UXAugmentedReality("main_arview_target")

	// start a page manager that will force the main page up
	let ux = window.ux = new UXPages()
	window.ux.push("main")
}




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXHelper
///
/// Provides general support for page management
/// In an engine like React pages would be implicitly associated with logic
/// In this case everything is baked by hand and flows are explicit.
/// Has specialized logic for this particular app to help manage flow
///
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class UXHelper {

	constructor(name) {

		// optional params
		let params = getUrlParams()
		this.zone = params.zone || "ZON"
		this.party = params.party || "BOB"

		// goto this page now (basically a named div in the custom page management scheme this helper implements)
		this.push(name)

		// the push/pop handler provided by javascript seems flakey? some debugging is left here to keep an eye on it
		window.onpopstate = (e) => {
			if(!e || !e.state) {
				console.error("UXHelper::popstate: bad input for popstate; or external push state?")
				console.log(e)
				return
			}
			console.log("UXHelper::popstate: user browser hit back button")
			console.log("UXHelper::popstate: location: " + document.location + ", state: " + JSON.stringify(event.state));
			this.show(e.state.name)
		}

		// start the ux for managing entities as a background camera view ... seems like a nice visual aesthetic and it's handy to have it around
		if(!window.arapp) {
			let target = document.getElementById('main_arview_target')
			this.arapp = window.arapp = new UXEntityComponent(target,this.zone,this.party,uxlog)
		}

	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
		console.log("UXHelper: somebody issued a back event")
		history.back()
	}

	hide(name) {
		if(!name) return
		document.getElementById(name).style.display = "none"
	}

	show(name) {
		if(this.current == name ) {
			return
		}
		this.hide(this.current)
		this.current = name
		let e = document.getElementById(name)
		e.style.display = "block"
	}

	//////////////////////////////////////////////////////////////////////////////////////////////
	// helpers for various control blocks - in some nicer framework like react these would be bound to the layout
	//////////////////////////////////////////////////////////////////////////////////////////////

	login(party) {
		this.party = party
		this.pick()
	}

	async pick() {

		// show picker page
		this.push("pick")

		// get a gps hopefully
		let gps = await XRAnchorCartography.gpsPromise()

		console.log("UXHelper::picker gps results")
		console.log(gps)
		if(!gps) {
			alert("Hmm no gps error")
			return 0
		}

		// restart component - listening for changes near an area (or restart listening)
		await window.arapp.restart({kind:0,gps:gps})

		// are there any maps near here?
		// TODO slightly inelegant to reveal arapp em property
		let results = window.arapp.em.entityQuery({kind:"map",gps:gps})

		// flush
		let dynamic_list = document.getElementById("picker_dynamic_list")
		while (dynamic_list.firstChild) dynamic_list.removeChild(dynamic_list.firstChild);

		// say "a fresh map"
		{
			let element = document.createElement("button")
			element.innerHTML = "a fresh map"
			element.onclick = (e) => {
				e.preventDefault()
				this.main()
				return 0
			}
			dynamic_list.appendChild(element)
		}

		// say other cases - could use a slider etc TODO
		// TODO the mapload method itself could be an action hidden inside of the arapp component rather than naked here
		for(let i = 0; i < results.length; i++) {
			let entity = results[i]
			let element = document.createElement("button")
			element.innerHTML = entity.anchorUID
			dynamic_list.appendChild(element)
			element.onclick = (e) => {
				let filename = e.srcElement.innerText
				this.main()
				window.arapp.em.mapLoad(window.arapp.session,filename)
				return 0
			}
			element = document.createElement("br")
			dynamic_list.appendChild(element)
		}

	}

	main() {

		// take this opportunity to hide 'save map' if your build does not have it
		if(window.arapp && (!window.arapp.session || !window.arapp.session.getWorldMap))
		{
			document.getElementById("save").style.display = "none"
		}

		// go to the main page
		this.push("main")
		return 0
	}

	map_nudge() {
		let entity = this.arapp.selected()
		if(!entity || !entity.gps) {
			return 0
		}
		this.push("map")
		if(!this.uxmap) {
			this.uxmap = new UXMapComponent("map")
		}
		this.uxmap.mapCenter(entity.gps)
		return 0
	}

	map_overview_update() {
		if(!this.uxmap) {
			this.uxmap = new UXMapComponent("map")
		}
		window.arapp.em.entityAll((entity)=>{
			if(entity.gps) {
				let blob  = { latitude: entity.gps.latitude, longitude:entity.gps.longitude, title:entity.uuid }
				entity.marker = this.uxmap.marker(entity.marker,blob)
			}
		})
		return 0
	}

	map_overview() {
		this.push("map")

		// run for some number of seconds - relatively harmless if reinvoked
		let scope = this
		function helper(count) {
			scope.map_overview_update()
			count--
			if(count > 0) setTimeout(helper,1000)
		}
		helper(10)

		return 0
	}

	delete() {
		// TBD
		return 0
	}

	edit() {
		// get entity if any
		let entity = this.arapp.selected()
		if(!entity) {
			return 0
		}
		if(this.uxmap) {
			this.uxmap.latitude_longitude_updated = 0
		}
		// goto this page
		this.push("edit")
		// get layout for it
		let elem = document.getElementById("edit_art")
		elem.value = entity.art
		elem = document.getElementById("edit_uuid")
		elem.innerHTML = entity.uuid

		// these are the tags - set all the checkboxes off - TODO could generate the entire checkbox system programmatically later
		let tags = "upright eyelevel billboard wall floor persist public priority"
		tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			e.checked = false				
			console.log("resettting " + tag)
		})

		// bust out the tags from entity and set those to true
		entity.tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			e.checked = true
			console.log("upsettting " + tag)
		})
		return 0
	}

	editdone() {

		let entity = this.arapp.selected()
		if(!entity) {
			this.main()
			return 0
		}

		if(this.uxmap.latitude_longitude_updated && entity.gps) {
			// the latitude and longitude have been updated... will only affect gps entities since other kinds have this computed from cartesian
			console.log("UXHelper: updated lat lon " + entity.uuid + " lat=" + this.uxmap.latitude + " " + this.uxmap.longitude )
			entity.gps.latitude = this.uxmap.latitude
			entity.gps.longitude = this.uxmap.longitude
		}

		entity.published = 0
		entity.dirty = 1

		// set art and force reload art
		// TODO sanitize - also this isn't the cleanest possible way to do this overall; scope concerns should be managed in scope
		entity.art = document.getElementById("edit_art").value
		if(entity.node) {
			console.log("UXHelper::entity has new art = " + entity.art )
			this.arapp.scene.remove(entity.node)
			entity.node = 0;
		}

		// set tags
		let buildset = []
		let tags = "upright eyelevel billboard wall floor persist public priority"
		tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			if(!e.checked) return
			buildset.push(tag)
		})
		console.log("UXHelper:: entity tags set to " + buildset + " on " + entity.uuid )
		entity.tags = buildset.join(" ")

		this.main() // TODO I should be able to pop but it fails... why?
		return 0
	}

	action(act) {
		switch(act) {
			case 'make': this.arapp.action(act); break
			case 'edit': return this.edit(); break
			case 'move': this.arapp.action(act); break
			case 'del':  alert("tbd"); break
			case 'gps':  this.arapp.action(act); break
			case 'save': this.arapp.action(act); break
			case 'maps': this.map_overview(); break
			case 'maps_update': this.map_overview_update(); break
			case 'nudg': this.map_nudge(); break
			default: break
		}
		return 0
	}

}


//////////////////////////////////////////////////////////////////////////////
/// bootstrap
//////////////////////////////////////////////////////////////////////////////

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		bootstrap()
//		window.ux = new UXHelper("login")
	}, 100)
})
