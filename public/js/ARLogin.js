
export class ARLogin extends HTMLElement {

	content() {
		return `
		<form>
		<center>
		<br/><label>Please pick a name </label>
		<br/><label>Por favor elige un nombre</label>
		<br/><label>请选择一个名字</label>
		<br/><label>يرجى اختيار الاسم</label>
		<br/><label>בחר שם</label> 
		<br/><input placeholder="name"></input>
		<br/><input placeholder="pass phrase"></input>
		<br/><button id="login_signin"> Sign In </button>
		<br/><button id="login_signup"> Sign Up </button>
		<br/><button id="login_back"> Back </button>
		<div id="login_message"></div
		</center>
		</form>
		`
	}

	constructor(_id=0,_class=0,entity_manager) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager

  		// wipe keys

		window.localStorage.setItem("priv",0)
		window.localStorage.setItem("pub",0)
		window.localStorage.setItem("master",0)

		new MutationObserver(() => {
			console.log("login hideshow " + this.style.display)
			if(this.style.display != "block") return
			this.onshow()
		}).observe(this, { attributes: true })

  	}

  	onshow() {
		this.innerHTML = this.content()
	    let form = this.children[0]
	    let input_name = form.elements[0]
	    let input_pass = form.elements[1]
	    input_name.placeholder = window.chance.first() + " " + window.chance.last() + " " + window.chance.animal()
	    input_pass.placeholder = sovereign.mnemonic()
	    let msg = document.getElementById("login_message")
	    let callback = async (e) => {
			e.preventDefault()
			// back out
			if(e.target.id == "login_back") {
			    this.dispatchEvent(new Event('router_pop',{bubbles:true}))
				return false
			}
			// valid name and pass?
			let name = input_name.value || input_name.placeholder
			let pass = input_pass.value || input_pass.placeholder
			if(!name || name.length <3 ) {
				msg.innerHTML = "<font color=red>please enter a longer name</font>"
				return false
			}
			if(!pass || pass.length <3 ) {
				msg.innerHTML = "<font color=red>please enter a longer pass phrase</font>"
				return false
			}

			// do not force create unless asked to

			let force = e.target.id == "login_signup" ? 1 : 0

			// given an identity - always preferentially look for it on server

			let results = await this.entity_manager.entityRebindToParty(name,pass,force)

			// if there is an entity everything worked out - can exit

			if(results) {
			    this.dispatchEvent(new Event('router_pop',{bubbles:true}))
				return false
			}

			// for a sign in request, if a party was not rebound, then that's an error... tell the user

			msg.innerHTML = "<font color=red>hmm cannot find name/pass - try again?</font>"
			return false
	    }

	    this.querySelectorAll("button").forEach(element => {
	    	element.onclick = callback
	    })

	}

}

customElements.define('ar-login', ARLogin)

