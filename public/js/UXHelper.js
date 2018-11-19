
function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

///////////////////////////////////////////////
///
/// A zero weight logger that stays out of the way - kind of hack
///
///////////////////////////////////////////////

function uxlog(...args) {
	let blob = args.join(' ')
	console.log(blob)
	let scope = window.mygloballogger
	if(!scope) {
		scope = window.mygloballogger = {}
		window.mygloballogger.msgs = []
		window.mygloballogger.target = document.getElementById("ux_help")
	}
	if(!scope.target) return
	scope.msgs.unshift(blob)
	scope.target.innerHTML = scope.msgs.slice(0,10).join("<br/>")
}

/*

let previous_console = window.console
window.console = {
	log: function(...args) {
		//previous_console.log(args[0])
		//if(args.length > 0 && args[0].startsWith("UX")) {
			uxlog(args)
		//}
		previous_console.log(args)
	},
	warn: function(...args) {
		//if(args.length > 0 && args[0].startsWith("UX")) {
		//	uxlog(args)
		//}
		previous_console.warn(args)
	},
	error: function(...args) {
		//if(args.length > 0 && args[0].startsWith("UX")) {
		//	uxlog(args)
		//}
		previous_console.error(args)
	}
}
*/


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
		this.zone = "azurevidian"
		this.party = "King Tut"
		this.push(name)

		window.onpopstate = (e) => {
			if(!e || !e.state) {
				console.error("popstate: bad input for popstate; or external push state?")
				console.log(e)
				return
			}
			console.log("popstate: user browser hit back button")
			console.log("popstate: location: " + document.location + ", state: " + JSON.stringify(event.state));
			this.show(e.state.name)
		}

		// start ar app in general in background for now
		if(!window.arapp) {
			let target = document.getElementById('main_arview_target')
			console.log(target)
			this.arapp = window.arapp = new UXEntityComponent(target,this.zone,this.party,uxlog)
		}

	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
		console.log("some code has a back event")
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

		console.log("picker gps results")
		console.log(gps)
		if(!gps) {
			alert("Hmm no gps error")
			return 0
		}

		// restart component - listening for changes near an area (or restart listening)
		await window.arapp.restart({kind:0,zone:this.zone,gps:gps})

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
				window.arapp.em.mapLoad(window.arapp.session,filename)
				this.main()
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
		this.push("map")
		if(!this.uxmap) {
			this.uxmap = new UXMapComponent("map")
		}
		return 0
	}

	map_overview() {
		this.push("map")
		if(!this.uxmap) {
			this.uxmap = new UXMapComponent("map")
		}
		window.arapp.em.entityAll((entity)=>{
			if(entity.mapped) return
			if(!entity.cartesian) return
			let blob  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(entity.cartesian);
			blob.lat = blob.latitude
			blob.lng = blob.longitude
			blob.uuid = entity.uuid
			entity.mapped = this.uxmap.add(blob)
			console.log("mapped")
			console.log(blob)
		})
		return 0
	}

	delete() {
		// TBD
		return 0
	}

	edit() {
		this.push("edit")
		let entity = this.arapp.selected()
		if(entity) {
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

		}
		return 0
	}

	editdone() {

		let entity = this.arapp.selected()
		if(entity) {

			entity.published = 0
			entity.dirty = 1

			// set art and force reload art
			// TODO sanitize
			entity.art = document.getElementById("edit_art").value
			if(entity.node) {
				// TODO this should be in the above component not here
				this.arapp.scene.remove(entity.node)
				entity.node = 0;
			}
			console.log("entity has new art = " + entity.art )

			// set tags
			let buildset = []
			let tags = "upright eyelevel billboard wall floor persist public priority"
			tags.split(" ").map(tag => {
				let e = document.getElementById("edit_"+tag)
				if(!e)return // weird
				if(!e.checked) return
				buildset.push(tag)
			})
			console.log("entity tags set to " + buildset + " on " + entity.uuid )
			entity.tags = buildset.join(" ")
		}

		this.main() // TODO I should be able to pop... study
		return 0
	}

	action(act) {
		switch(act) {
			case 'make': this.arapp.action(act); break
			case 'edit': return this.ux.exit()
			case 'move': this.arapp.action(act); break
			case 'del':  alert("tbd"); break
			case 'gps':  this.arapp.action(act); break
			case 'save': this.arapp.action(act); break
			case 'maps': this.map_overview(); break
			case 'nudg': this.map_nudge(); break
		}
		return 0
	}

}


//////////////////////////////////////////////////////////////////////////////
/// bootstrap
//////////////////////////////////////////////////////////////////////////////

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.ux = new UXHelper("login")
	}, 100)
})

//
// bugs
//
//  - validate that math is correct; i see recoveries that move things around
//  - i notice glitch is not saving maps - why

//	- i notice i get a lot of other maps and anchors that i am not actually that interested in... debate the wisdom of this or how to prune better...
//
///	- edit page to write
//		[done] populate based on current entity
//		[done] save changes
//		[done] mark as dirty and refetch art
//		- wire up map widget
//		- add a thing picker
//		- put a halo around current picked thing
//		- maybe support some built in primitives
//
//  - glitch support
//		- sqlite
//		- flush
//		- area constraints
//
// - prettier
//		- show a map of everything
//		- a globe or world map view or something
//




