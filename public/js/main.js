
// HTMLElements

import {ARLog} from '/js/ARLog.js'
import {ARMain} from '/js/ARMain.js'
import {ARLogin} from '/js/ARLogin.js'
import {ARProfile} from '/js/ARProfile.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'
import {Router} from '/js/Router.js'

// State

import {EntityManager} from '/js/EntityManager.js'

// Bootup

export async function main() {

    // networked entity state manager used by components

    let entity_manager = await new EntityManager()

    // other elements

    let elements = [
      new Router(),
      new ARLog("debug_logging","debug_logging"),
      new ARMain("main","page",entity_manager),
      new ARLogin("login","page",entity_manager),
      new ARProfile("profile","page",entity_manager),
      new ARZones("zones","page",entity_manager),
      new AREditor("editor","page_overflow",entity_manager),
      new ARMap("maps","page",entity_manager)
    ]

    elements.forEach(elem => { document.body.appendChild(elem) } )

    // go to home page by issuing a custom event that the Router catches

    document.body.dispatchEvent( new CustomEvent('router_push', { bubbles: true, detail: "main"  })  )
}
