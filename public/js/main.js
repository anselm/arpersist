
import {EntityManager} from '/js/EntityManager.js'

// extend HTMLElement with some custom helpers - TODO eventually remove and do a nicer way
import {UXPage} from '/js/UXComponents.js'
HTMLElement.prototype.listen = UXPage.listen
HTMLElement.prototype.log  = UXPage.log
HTMLElement.prototype.err  = UXPage.err
HTMLElement.prototype.show = UXPage.show
HTMLElement.prototype.push = UXPage.push
HTMLElement.prototype.pop = UXPage.pop

// HTMLElements

import {ARLog} from '/js/ARLog.js'
import {ARMain} from '/js/ARMain.js'
import {ARLogin} from '/js/ARLogin.js'
import {ARProfile} from '/js/ARProfile.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'

export async function main() {

    // catch logging messages and paint them to a div for debugging

    // networked entity state manager used by components

    let entity_manager = await new EntityManager(UXPage.log,UXPage.err)

    // the ui

    let elements = [
      new ARLog("debug_logging","debug_logging"),
      new ARMain("main","page",entity_manager),
      new ARLogin("login","page",entity_manager),
      new ARProfile("profile","page",entity_manager),
      new ARZones("zones","page",entity_manager),
      new AREditor("editor","page_overflow",entity_manager),
      new ARMap("maps","page",entity_manager)
    ]

    elements.forEach(elem => { document.body.appendChild(elem) } )

    // goto main page

    UXPage.push("main")
}


