
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
		<br/><button> Join </button>
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
		this.innerHTML = this.content()
	    let form = this.children[0]
	    let input = form.elements[0]
	    input.placeholder = window.chance.first() + " " + window.chance.last() + " " + window.chance.animal()
	    form.onsubmit = (e) => {
	      e.preventDefault()
	      let moniker = input.value || input.placeholder
	      this.pop()
	      return false
	    }
	}

}

customElements.define('ar-login', ARLogin)

