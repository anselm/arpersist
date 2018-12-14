
///
/// ARLog
///

export class ARLog extends HTMLElement {

  constructor(_id=0,_class=0) {
    super()
    if(_id) this.id = _id
    if(_class) this.className = _class
    this.display = []
    this.innerHTML = "debugging"
    this.listen("log",this.print.bind(this))
    this.listen("err",this.print.bind(this))
  }

  print(args) {
    let buffer = ""
    if (typeof args.value == 'string' || args.value instanceof String) {
      buffer = args.value
    } else if(args.value instanceof Array || Array.isArray(args.value)) {
      buffer = args.value.join(" ")
    }
    let cname = args.className || ""
    if(args.kind=="err") {
      console.error(cname + " message: " + buffer)      
      buffer = "<font color=red> " + buffer + "</font>"
    } else {
      console.log(cname + " message: " + buffer)      
    }
    this.display.unshift(buffer)
    this.display = this.display.slice(0,10)
    this.innerHTML = this.display.join("<br/>")
  }
}

customElements.define('ux-log', ARLog)

