
///
/// ARLog
///

export class ARLog extends HTMLElement {

  constructor(_id=0,_class=0) {
    super()
    let scope = this
    if(_id) this.id = _id
    if(_class) this.className = _class
    let display = this.display = []
    let innerHTML = this.innerHTML = "[Debugging will go here]"

    this.onclick = (e) => {
      this.style.display = "none"
    }

    let oldlog = this.oldlog = window.console.log
    let olderr = this.olderr = window.console.error

    let log = function(args) {
      let stack = "Log called from around : " + ("" + new Error().stack).split("at ")[2] // + " With " + [...arguments].join(" ")
      oldlog.apply(window,[stack])
      oldlog.apply(window,[...arguments])
      //oldlog.apply(window,[args]) // [...arguments] or  Array.prototype.slice.call(arguments)) also work
      let buffer = ""
      if (typeof args == 'string' || args instanceof String) {
        buffer = args
      } else if(args instanceof Array || Array.isArray(args)) {
        buffer = args.join(" ")
      }
      display.unshift(buffer)
      display = display.slice(0,10)
      scope.innerHTML = display.join("<br/>")
    }

    let err = function (args) {
      olderr.apply(window,[...arguments]) // [...arguments] or  Array.prototype.slice.call(arguments)) also work
      let buffer = ""
      if (typeof args == 'string' || args instanceof String) {
        buffer = args
      } else if(args instanceof Array || Array.isArray(args)) {
        buffer = args.join(" ")
      }
      buffer = "<font color=red> " + buffer + "</font>"
      display.unshift(buffer)
      display = display.slice(0,10)
      scope.innerHTML = display.join("<br/>")
    }

    window.console.log = log
    window.console.error = err

  }
}

customElements.define('ux-log', ARLog)
