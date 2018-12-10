
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
		<br/><input placeholder="password"></input>
		<br/><button id="login_signin"> Sign-in </button>
		<br/><button id="login_signup"> Sign-up </button>
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
				document.getElementById("login_message").innerHTML = "<font color="red">please enter a longer name</font>"
				return false
			}
			if(!pass || pass.length <3 ) {
				document.getElementById("login_message").innerHTML = "<font color="red">please enter a longer password</font>"
				return false
			}
			// if signing in then look for a match or fail
			if(e.srcElement.id == "login_signin") {
				let results = await this.entity_manager.entityQueryRemote({name:name, _pass:pass})
				// success
				if(results || results.length) {
					this.entity_manager.party = results[0]
					this.pop()
					return false
				}
				// failed to match - report error
				document.getElementById("login_message").innerHTML = "<font color="red">hmm cannot find name/pass - try again?</font>"
				return false
			}

			// - make sure party does not exist

			// - just make a new entity
			this.entity_manager.entityParty = this.entity_manager.entityAddParty("")


			// otherwise we must be signing up so it's ok to just add that entry - but we want the entry to be unique
			// - todo - ask the server to generate a user uuid in this case i guess - or reseparate uuid generation from the entity
			// - todo - i think we have to separate out uuid again and generate it from a local hash or have the server generate it
			// - 

			return false
	    }
	}

}

customElements.define('ar-login', ARLogin)

/*

changes to do here for user logins

	- this form will ask for a phrase, make one - as well as name
	- and it will print out public,privatekey for you to save
	- and save as webobjects

	- anything you publish should be signed by your key please - publish [obj,sig,publickey]

	- at startup you can search for your profile with your publickey also - if you want to rebind to that one
	- i want your profile to hold a list of your friends

changes elsewhere

	- i would like a filter blob of code, i would like it to be kind of stand alone; i want an idea that you can query multiple servers
		- i kinda think that scrapers would scrape and aggregate rss feeds into a more centralized location rather than you doing all the work?
		- but in a sense this has to act like that; it has to be multi-server

	- any server can store whatever you send it right now - but i imagine at some point you have a home server

*

there are many or at least one "server" or area that collects content - entities, maps, representations of people:
	[ map, publickey, signature ]
	[ object, publickey, signature ]
	[ self object, publickey, list of friends, signature ]


*/





