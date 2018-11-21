
import {UXPage} from './UXComponents.js'

export class UXEditor extends UXPage {

	constructor() {
		super()
	}

	edit(dom_element_id,entity) {

		if(!entity) {
			this.err("no entity to edit")
			return
		}

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

	editdone(entity) {

		if(!entity) {
			return 0
		}

		entity.published = 0
		entity.dirty = 1

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

