
export class AREditor extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><button id="editdone" onClick="event.preventDefault(); window.pop(); return 0;"> done</button>
		<br/><button id="delete" onClick="event.preventDefault();window.ux.action('delete'); return 0;"> delete</button>
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
		<br/><label>scale x</label><input id="edit_scalex"></input>
		<br/><label>scale y</label><input id="edit_scaley"></input>
		<br/><label>scale z</label><input id="edit_scalez"></input>
		<br/><label>rotat x</label><input id="edit_rotationx"></input>
		<br/><label>rotat y</label><input id="edit_rotationy"></input>
		<br/><label>rotat z</label><input id="edit_rotationz"></input>
		<br/>
		<div id="edit_uuid">object uid if any</div>
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

		// is there a current focus?
		let entity = this.entity_manager.entityGetSelected()

		// if nothing picked then make something - and it will become selected by magicks
		if(!entity) {
			entity = this.entity_manager.entityAddArt()
		}

		// a null entity can occur if there was no intersection to place an anchor against
		if(!entity) {
			this.pop()
			return
		}

		// this is the root of the dom
		this.target = this

		// get layout for it - TODO could look inside of target rather than in whole document
		let elem = 0

		elem = document.getElementById("edit_name") // TODO sloppy
		elem.value = entity.name

		elem = document.getElementById("edit_art") // TODO sloppy
		elem.value = entity.art

		elem = document.getElementById("edit_uuid")
		elem.innerHTML = entity.uuid

		// these are the tags - set all the checkboxes off - TODO could generate the entire checkbox system programmatically later
		let tags = "upright eyelevel billboard wall floor persist public priority"
		tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			e.checked = false				
		})

		// bust out the tags from entity and set those to true
		entity.tags.split(" ").map(tag => {
			let e = document.getElementById("edit_"+tag)
			if(!e)return // weird
			e.checked = true
		})

		// set scale and rotation
		let scale = entity.scale || { x:1,y:1,z:1}
		elem = document.getElementById("edit_scalex")
		elem.value = scale.x
		elem = document.getElementById("edit_scaley")
		elem.value = scale.y
		elem = document.getElementById("edit_scalez")
		elem.value = scale.z

		let quaternion = entity.quaternion || new THREE.Quaternion()
		var euler = new THREE.Euler().setFromQuaternion( quaternion )
		elem = document.getElementById("edit_rotationx")
		elem.value = euler.x
		elem = document.getElementById("edit_rotationy")
		elem.value = euler.y
		elem = document.getElementById("edit_rotationz")
		elem.value = euler.z

	}

	onhide() {

		let entity = this.entity_manager.entityGetSelected()

		if(!entity) {
			return
		}

		// set scale and rotation
		let scale = entity.scale || { x:1,y:1,z:1}
		let elem = 0
		elem = document.getElementById("edit_scalex")
		scale.x = parseFloat(elem.value) || 1
		elem = document.getElementById("edit_scaley")
		scale.y = parseFloat(elem.value) || 1
		elem = document.getElementById("edit_scalez")
		scale.z = parseFloat(elem.value) || 1
		entity.scale = scale

		let quaternion = new THREE.Quaternion()
		var euler = new THREE.Euler().setFromQuaternion( quaternion )
		elem = document.getElementById("edit_rotationx")
		euler.x = parseFloat(elem.value) || 0
		elem = document.getElementById("edit_rotationy")
		euler.y = parseFloat(elem.value) || 0
		elem = document.getElementById("edit_rotationz")
		euler.z = parseFloat(elem.value) || 0
		quaternion.setFromEuler(euler)
		entity.quaternion = quaternion

		// force republication - TODO shouldn't really do this here... especially not gps entities
		entity.published = 0

		// revise art
		entity.name = document.getElementById("edit_name").value
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

