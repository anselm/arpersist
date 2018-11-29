
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
		<br/><button> Sign-in </button>
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
	    form.onsubmit = (e) => {
	      e.preventDefault()
	      let name = input_name.value || input_name.placeholder
	      let pass = input_pass.value

	      // TODO improve - should talk to server
		  this.entity_manager.party = {
		  	name:name,
		  	pass:pass,
		  	admin: name == "anselm" ? 9 : 0
		  }
		  console.log(this.entity_manager.party)

	      this.pop()
	      return false
	    }
	}

}

customElements.define('ar-login', ARLogin)

