
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
		this.innerHTML = this.content()
	    let form = this.children[0]
	    let input_name = form.elements[0]
	    let input_pass = form.elements[1]
	    input_name.placeholder = window.chance.first() + " " + window.chance.last() + " " + window.chance.animal()
	    input_pass.placeholder = sovereign.mnemonic()
	    form.onsubmit = async (e) => {
			e.preventDefault()
			// back out
			if(e.srcElement.id == "login_back") {
				this.pop()
				return false
			}
			// valid name and pass?
			let name = input_name.value || input_name.placeholder
			let pass = input_pass.value
			if(!name || name.length <3 ) {
				document.getElementById("login_message").innerHTML = "<font color=red>please enter a longer name</font>"
				return false
			}
			if(!pass || pass.length <3 ) {
				document.getElementById("login_message").innerHTML = "<font color=red>please enter a longer pass phrase</font>"
				return false
			}

			// do not force create unless asked to
			let force = e.srcElement.id == "login_signup"

			// given an identity - always preferentially look for it on server

			let results = this.entity_manager.entityRebindToParty({
				name:name,
				mnemonic:pass,
				force:force
			})

			// if there is an entity then I guess we are good...

			if(results) {
				this.pop()
				return false
			}

			// for a sign in request, if a party was not rebound, then that's an error... tell the user

			document.getElementById("login_message").innerHTML = "<font color=red>hmm cannot find name/pass - try again?</font>"
			return false
	    }
	}

}

customElements.define('ar-login', ARLogin)

