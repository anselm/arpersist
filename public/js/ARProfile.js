
export class ARProfile extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><label>Your name is </label>
		<br/><input readonly></input>
		<br/><button onclick="event.preventDefault(); window.push('login');return 0;"> Logout </button>
		<br/><button> Back </button>
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
	    let form = this.children[0]
	    form.onsubmit = (e) => {
	      e.preventDefault()
	      this.pop()
	      return false
	    }
	}

	onshow() {
		if(!this.entity_manager.party || this.entity_manager.party.name.length < 1) {
			window.push("login")
			return
		}
		this.children[0].elements[0].value = this.entity_manager.party.name
	}

}

customElements.define('ar-profile', ARProfile)




