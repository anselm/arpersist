
export class AREditor extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><button id="editdone" onClick="event.preventDefault(); window.pop(); return 0;"> done</button>
		<br/><button id="nudgemap" onClick="event.preventDefault(); window.push('maps'); return 0;"> map</button>
		<br/><input id="edit_name" placeholder="a name"></input>
		<br/><input id="edit_art" placeholder="url to art OR words to show"></input>
		<br/><label id="xedit_upright"  >   Upright </label><label class="switch">      <input id="edit_upright" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_eyelevel" > Eye Level </label><label class="switch">      <input id="edit_eyelevel" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_billboard"> Billboard </label><label class="switch">      <input id="edit_billboard" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_wall"     >      Wall </label><label class="switch">      <input id="edit_wall" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_floor"    >     Floor </label><label class="switch">      <input id="edit_floor" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_persist"  >   Persist </label><label class="switch">      <input id="edit_persist" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_public"   >    Public </label><label class="switch">      <input id="edit_public" type="checkbox"><span class="slider"></span></label>
		<br/><label id="xedit_priority" >  Priority </label><label class="switch">      <input id="edit_priority" type="checkbox"><span class="slider"></span></label>
		<br/><button id="delete" onClick="event.preventDefault();window.ux.action('delete'); return 0;"> delete</button>
		<br/>
		<br/>
		<div id="edit_uuid">object uid if any</div>
		<div>object location if any</div>
		</center>
		</form>
		`
	}

	constructor(_id,_class,entity_manager) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager
		this.innerHTML = this.content()

	    // this is one way to notice if editor is up
		var observer = new MutationObserver((mutations) => {
			if(mutations[0].target.style.display != 'none') {
				console.log("showing editor")
			}
		})
		observer.observe(this, { attributes: true });
	}

	onshow() {

		// TODO make new if none

		let entity = this.entity_manager.entityGetSelected()
		if(!entity) return

		let dom_element_id = this._id
		this.target = document.getElementById(dom_element_id)
		if(!this.target) {
			this.err("no target page " + dom_element_id)
			return
		}

		// get layout for it - TODO could look inside of target rather than in whole document
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
			this.log("resettting " + tag)
		})

		// bust out the tags from entity and set those to true
		entity.tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			e.checked = true
			this.log("upsettting " + tag)
		})
	}

	onhide() {
		let entity = this.entity_manager.entityGetSelected()

		if(!entity) {
			return 0
		}

		entity.published = 0

		// revise art
		entity.art = document.getElementById("edit_art").value

		// set tags
		let buildset = []
		let tags = "upright eyelevel billboard wall floor persist public priority"
		tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			if(!e.checked) return
			buildset.push(tag)
		})
		this.log("tags set to " + buildset + " on " + entity.uuid )
		entity.tags = buildset.join(" ")
	}
}

customElements.define('ar-editor', AREditor)


				// TODO fix map
				//if(entity && map && map.latitude_longitude_updated && entity.gps) {
				//  UXPage.log("editor updated location of entity to lat="+map.latitude+ " lon="+map.longitude)
				//   entity.gps.latitude = map.latitude
				//   entity.gps.longitude = map.longitude
				//   map.latitude_longitude_updated = 0
				// }

