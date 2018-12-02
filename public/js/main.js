

import {EntityManager} from '/js/EntityManager.js'

import {UXComponent,UXPage} from '/js/UXComponents.js'

import {ARMain} from '/js/ARMain.js'
import {ARLogin} from '/js/ARLogin.js'
import {ARProfile} from '/js/ARProfile.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'

// extend htmlelement with some custom helpers - TODO eventually remove and do a nicer way
HTMLElement.prototype.action  = UXPage.action
HTMLElement.prototype.log  = UXPage.log
HTMLElement.prototype.err  = UXPage.err
HTMLElement.prototype.pop = UXPage.pop
window.ux = new UXPage()
window.push = UXPage.push
window.pop = UXPage.pop


///
/// UXLog
///
/*
export class UXLog extends HTMLElement {
  constructor(_id=0,_class=0) {
    super()
    if(_id) this.id = _id
    if(_class) this.className = _class
    this.display = []
    UXComponent.listen("log",this.print.bind(this))
    UXComponent.listen("err",this.print.bind(this))
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
*/

export async function main() {

    // catch logging messages and paint them to a div for debugging

//    let log = new UXLog("debug_logging","debug_logging")
//    document.body.appendChild()

    // networked entity state manager used by components

    let entity_manager = await new EntityManager(UXPage.log,UXPage.err)

    // the ui

    let elements = [
      new ARMain("main","page",entity_manager),
      new ARLogin("login","page",entity_manager),
      new ARProfile("profile","page",entity_manager),
      new ARZones("zones","page",entity_manager),
      new AREditor("editor","page",entity_manager),
      new ARMap("maps","page",entity_manager)
    ]

    elements.forEach(elem => { document.body.appendChild(elem) } )

    // goto main page

    window.push("main")
}


