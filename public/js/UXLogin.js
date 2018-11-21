
import {UXPage} from './UXComponents.js'

export class UXLogin extends UXPage {
  constructor(dom_element_id) {
    super()
    this.layout(dom_element_id)
  }
  layout(dom_element_id) {
    let form = document.getElementById(dom_element_id)
    form.elements[0].placeholder = window.chance.first() + " " + window.chance.last() + " " + window.chance.animal()
    form.onsubmit = (e) => {
      e.preventDefault()
      let moniker = e.srcElement.elements[0].value || e.srcElement.elements[0].placeholder; // or form.elements[0]
      this.action("logindone",moniker)
      return false
    }
  }
}

