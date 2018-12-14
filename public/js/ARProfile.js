
export class ARProfile extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><label>Your name is </label>
		<br/><input readonly></input>
		<br/><button id="profile_logout"> Logout </button>
		<br/><button id="provile_backup"> Back </button>
		</center>
		</form>
		`
	}

	constructor(_id=0,_class=0,entity_manager) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager
		this.innerHTML = this.content()

    	// observe buttons
		let callback = (e) => {
    		e.preventDefault()
			switch(e.target.id) {
				case "profile_backup":
					window.history.back()
					break
				case "profile_logout":
					entity_manager.entityLogout()
					window.history.back()
					break
			}
			return false
    	}
	    this.querySelectorAll("button").forEach(element => { element.onclick = callback })

	    // observe hide show
		new MutationObserver(() => {
			console.log("profile hideshow " + this.style.display)
			if(this.style.display != "block") return
			if(!this.entity_manager.entityParty) {
				window.history.show("login")
				return
			}
			this.children[0].elements[0].value = this.entity_manager.entityParty.name
		}).observe(this,{attributes:true})

	}

}

customElements.define('ar-profile', ARProfile)




