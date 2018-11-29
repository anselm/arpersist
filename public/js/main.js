

import {EntityManager} from '/js/EntityManager.js'

import {UXUrlParams,UXComponent,UXPage,UXLog} from '/js/UXComponents.js'

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

export async function main() {

    // catch logging messages and paint them to a div for debugging

    new UXLog("helper")

    // networked entity state manager used by components

    let entity_manager = await new EntityManager(UXPage.log,UXPage.err)

    // the ui

    let elements = [
      new ARMain("main","page",entity_manager,UXPage.log,UXPage.err),
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


