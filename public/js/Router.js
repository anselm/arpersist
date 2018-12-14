// A router

export class Router {

  static pop() {
    window.history.back()
  }
  pop() {
    args.className = this.__proto__.constructor.name
    return this.constructor.pop()
  }

  static hide(name) {
    if(!name) return
    let element = document.getElementById(name)
    if(element) element.style.display = "none"
    if(element.onhide) element.onhide()
  }
  hide(name) {
    args.className = this.__proto__.constructor.name
    return this.constructor.hide(name)
  }

  static show(name) {
    if(this.ux_showing == name ) return
    if(this.ux_showing) this.hide(this.ux_showing)
    this.ux_showing = name
    let element = document.getElementById(name)
    if(element) element.style.display = "block"
    if(element.onshow) element.onshow()
  }
  show(name) {
    args.className = this.__proto__.constructor.name
    return this.constructor.show(name)
  }

  static push(name) {
    window.history.pushState({name:name},name,"#" + name );
    this.show(name)
  }
  push(name) {
    args.className = this.__proto__.constructor.name
    return this.constructor.push(name)
  }

  static onpopstate(e) {
    if(!e || !e.state) {
      console.error(" backbutton - bad input for popstate; or external push state?")
    } else {
      window.history.show(e.state.name)
    }
  }
  onpopstate(e) {
    args.className = this.__proto__.constructor.name
    return this.constructor.onpopstate(e)
  }

  constructor() {
    window.onpopstate = Router.onpopstate
  }

}

