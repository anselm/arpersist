
// HTMLElements

import {ARLog} from '/js/ARLog.js'
import {ARMain} from '/js/ARMain.js'
import {ARLogin} from '/js/ARLogin.js'
import {ARProfile} from '/js/ARProfile.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'

// State

import {EntityManager} from '/js/EntityManager.js'
import {Messaging} from '/js/Messaging.js'
import {Router} from '/js/Router.js'

// Bootup

export async function main() {

    // anonymous messaging

    let messaging = new Messaging()

    // route page transitions

    let router = new Router()

    // have router listen to these messages

    Messaging.listen("push",(e) => { Router.push(e) } )
    Messaging.listen("show",(e) => { Router.show(e)} )
    Messaging.listen("pop",(e) => { Router.pop()} )

    // as a hack make routing available globally

    window.history.pop = function(e) { Messaging.message("pop") }
    window.history.show = function(e) { Messaging.message("show",e) }
    window.history.push = function(e) { Messaging.message("push",e) }

    // networked entity state manager used by components

    let entity_manager = await new EntityManager()

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

   // window.history.push("main")
   Messaging.message("push","main")
}
