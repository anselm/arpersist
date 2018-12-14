
export class AREditor extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><button id="editor_done1"> done</button>
		<br/><button id="editor_delete"> delete</button>
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
		<br/><label>pitch  </label><input id="edit_rotationx"></input>
		<br/><label>yaw    </label><input id="edit_rotationy"></input>
		<br/><label>roll   </label><input id="edit_rotationz"></input>
		<br/><label>scale x</label><input id="edit_scalex"></input>
		<br/><label>scale y</label><input id="edit_scaley"></input>
		<br/><label>scale z</label><input id="edit_scalez"></input>
		<br/><button id="editor_done2"> done</button>
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

		let callback = (e) => {
			e.preventDefault()
			switch(e.currentTarget.id) {
				case "editor_done1":
				case "editor_done2":
					window.history.back()
					break
				case "editor_delete":
					// delete TBD
					window.history.back()
					break
			}
			return 0
		}

		// observe buttons
	    this.querySelectorAll("button").forEach(element => { element.onclick = callback })

	    // observe hide/show
		new MutationObserver(() => {
			this.style.display != "block" ? this.onhide() : this.onshow()
		}).observe(this, { attributes: true })
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
			window.history.back()
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
		elem.value = scale.x.toFixed(4)
		elem = document.getElementById("edit_scaley")
		elem.value = scale.y.toFixed(4)
		elem = document.getElementById("edit_scalez")
		elem.value = scale.z.toFixed(4)

		//let quaternion = entity.quaternion || new THREE.Quaternion()
		//let euler = new THREE.Euler().setFromQuaternion( quaternion )
		let euler = entity.euler || new THREE.Euler()
		elem = document.getElementById("edit_rotationx")
		elem.value = THREE.Math.radToDeg( euler._x ).toFixed(0)
		elem = document.getElementById("edit_rotationy")
		elem.value = THREE.Math.radToDeg( euler._y ).toFixed(0)
		elem = document.getElementById("edit_rotationz")
		elem.value = THREE.Math.radToDeg( euler._z ).toFixed(0)

	}

	onhide() {

		let entity = this.entity_manager.entityGetSelected()

		if(!entity) {
			return
		}

		let elem = 0

		// set scale and rotation
		let scale = entity.scale || { x:1,y:1,z:1}
		elem = document.getElementById("edit_scalex")
		scale.x = parseFloat(elem.value) || 1
		elem = document.getElementById("edit_scaley")
		scale.y = parseFloat(elem.value) || 1
		elem = document.getElementById("edit_scalez")
		scale.z = parseFloat(elem.value) || 1
		entity.scale = scale

		//let quaternion = new THREE.Quaternion()
		//var euler = new THREE.Euler().setFromQuaternion( quaternion )
		let euler = {}
		elem = document.getElementById("edit_rotationx")
		euler.x = THREE.Math.degToRad( parseFloat(elem.value) ) || 0
		elem = document.getElementById("edit_rotationy")
		euler.y = THREE.Math.degToRad( parseFloat(elem.value) ) || 0
		elem = document.getElementById("edit_rotationz")
		euler.z = THREE.Math.degToRad( parseFloat(elem.value) ) || 0
		//quaternion.setFromEuler(euler)
		//entity.quaternion = quaternion
		entity.euler = new THREE.Euler(euler.x,euler.y,euler.z)

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
		console.log("tags set to " + buildset + " on " + entity.uuid )
		entity.tags = buildset.join(" ")
	}
}

customElements.define('ar-editor', AREditor)

