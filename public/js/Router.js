
export class Router extends HTMLElement {

  pop() {
    window.history.back()
  }

  hide(name) {
    if(!name) return
    let element = this.querySelector("#"+name)
    if(element) element.style.display = "none"
  }

  show(name) {
    if(this.ux_showing == name ) return
    if(this.ux_showing) this.hide(this.ux_showing)
    this.ux_showing = name
    let element = this.querySelector("#"+name)
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

  constructor(...elements) {
    super()
    //this.innerHTML = ""

    // watch navigator history events

    window.onpopstate = this.onpopstate.bind(this)

    // watch for custom navigation events to bubble up

    this.addEventListener('router_pop', this.pop )
    this.addEventListener('router_push', e => { this.push(e.detail) })
    this.addEventListener('router_show', e => { this.show(e.detail) })

    // add children that this router switches between

    elements.forEach(elem => { this.appendChild(elem) } )

    // goto the first child

    this.push(elements[0].id)

    // add self to dom

    document.body.appendChild(this)

  }

}

customElements.define('ar-router', Router)

