
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
		<br/><input placeholder="Pick a handle"></input>
		<br/><button> Join </button>
		<!-- this was a hassle - it is now done inline below -->
		<!-- <br/><button id="logindone" onClick="alert(1); event.preventDefault(); window.ux.action('logindone'); return 0;"> Join </button> -->
		</center>
		</form>
		`
	}

	constructor(_id=0,_class=0) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
	}

	connectedCallback() {

		// this approach works as well
		//let node = document.createElement('template')
		//node.innerHTML = this.content()
		//this.appendChild(node.content)

		this.innerHTML = this.content()

	    let form = this.children[0]
	    let input = form.elements[0]
	    input.placeholder = window.chance.first() + " " + window.chance.last() + " " + window.chance.animal()
	    form.onsubmit = (e) => {
	      e.preventDefault()
	      let moniker = input.value || input.placeholder
	      this.action("logindone",moniker)
	      return false
	    }
	}

}

customElements.define('ar-login', ARLogin)

