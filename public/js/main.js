

import {EntityManager} from '/js/EntityManager.js'

import {UXUrlParams,UXComponent,UXPage,UXLog} from '/js/UXComponents.js'

import {ARMain} from '/js/ARMain.js'
import {ARProfile} from '/js/ARProfile.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'

// extend htmlelement with some custom helpers - TODO eventually remove and do a nicer way
HTMLElement.prototype.action  = UXPage.action
HTMLElement.prototype.log  = UXPage.log
HTMLElement.prototype.err  = UXPage.err
HTMLElement.prototype.pop = UXPage.pop // used by map
window.ux = new UXPage()
window.route = UXPage.push
window.pop = UXPage.pop

export async function main() {

  // catch logging messages and paint them to a div for debugging

  new UXLog("helper")

  // networked entity state manager used by components

  let entity_manager = await new EntityManager(UXPage.log,UXPage.err)

  // components describing the ui

  let main = new ARMain("main","page",entity_manager,UXPage.log,UXPage.err)
  let profile = new ARProfile("profile","page",entity_manager)
  let zones = new ARZones("zones","page",entity_manager)
  let editor = new AREditor("editor","page")
  let map = new ARMap("maps","page",entity_manager)

  // add components to DOM

  let scene = [
    main,
    profile,
    zones,
    editor,
    map
  ]
  scene.forEach(node => { document.body.appendChild(node) } )

  // goto main page

  window.route("main")

  // Messaging - will probably remove this - TODO

  UXPage.listen("action",(args)=> {
    UXPage.log("handling an action " + args.value)
    map.markerSource(0)
    switch(args.value) {
      case "edit":
        if( entity_manager.entityGetSelected() ) {
          editor.edit("editor",entity_manager.entityGetSelected())
          UXPage.push("editor")
        }
        break
      case "nudgemap":
        UXPage.push("maps")
        break
      case "editdone":
        {
          let entity = entity_manager.entityGetSelected()
          if(entity && map && map.latitude_longitude_updated && entity.gps) {
            UXPage.log("editor updated location of entity to lat="+map.latitude+ " lon="+map.longitude)
            entity.gps.latitude = map.latitude
            entity.gps.longitude = map.longitude
            map.latitude_longitude_updated = 0
          }
          editor.editdone(entity)
          UXPage.pop()
        }
        break
      case "make":
        entity_manager.entityAddArt()
        break
      case "delete":
        // TBD
        UXPage.err("Not written yet")
        break
    }
  })

}


