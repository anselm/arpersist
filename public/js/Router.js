
export class Router extends HTMLElement {

  pop() {
    window.history.back()
  }

  hide(name) {
    if(!name) return
    let element = document.getElementById(name)
    if(element) element.style.display = "none"
  }

  show(name) {
    if(this.ux_showing == name ) return
    if(this.ux_showing) this.hide(this.ux_showing)
    this.ux_showing = name
    let element = document.getElementById(name)
    if(element) element.style.display = "block"
  }

  push(name) {
    window.history.pushState({name:name},name,"#" + name );
    this.show(name)
  }

  onpopstate(e) {
    if(!e || !e.state) {
      console.error(" backbutton - bad input for popstate; or external push state?")
    } else {
      this.show(e.state.name)
    }
  }

  constructor() {
    super()
    this.innerHTML = ""
    window.onpopstate = this.onpopstate.bind(this)
    document.body.addEventListener('router_pop', this.pop )
    document.body.addEventListener('router_push', e => { this.push(e.detail) })
    document.body.addEventListener('router_show', e => { this.show(e.detail) })
  }

}

customElements.define('ar-router', Router)

