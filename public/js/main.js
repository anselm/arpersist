import {EntityManager} from '/js/EntityManager.js'

import {UXUrlParams,UXComponent,UXPage,UXLog} from '/js/UXComponents.js'

import {ARLogin} from '/js/ARLogin.js'
import {ARMain} from '/js/ARMain.js'
import {ARZones} from '/js/ARZones.js'
import {AREditor} from '/js/AREditor.js'
import {ARMap} from '/js/ARMap.js'

export async function main() {

  // fetch browser url params
  let params = UXUrlParams()

  // start an entity network state manager
  let entity_manager = await new EntityManager(params.zone || "ZZZ",params.party || "ME",UXPage.log,UXPage.err)

// extend html element
HTMLElement.prototype.action  = UXPage.action
HTMLElement.prototype.log  = UXPage.log
HTMLElement.prototype.err  = UXPage.err
HTMLElement.prototype.pop = UXPage.pop // used by map

  // connect ux control logic to existing html
  new UXLog("helper")
  let main = new ARMain("main","page",entity_manager,"arview_target",UXPage.log,UXPage.err)
  let login =  new ARLogin("login","page")
  let zones = new ARZones("zones","page")
  let editor = new AREditor("editor","page")
  let map = new ARMap("maps","page")

  // add these pages to dom
  let scene = [
    main,
    login,
    zones,
    editor,
    map
  ]
  scene.forEach(node => { document.body.appendChild(node) } )

// expose messaging to the html to allow inline onclick handlers in html for convenience
// TODO I would like to remove this and use the method injection technique above - zones picker uses it for example

  window.ux = new UXPage()

  // make login page visible now
  UXPage.push("login")

  // connect buttons to actions
  UXPage.listen("action",(args)=> {
    UXPage.log("handling an action " + args.value)
    map.markerSource(0)
    switch(args.value) {
      case "logindone":
        // TODO do something with name
        UXPage.push("zones")
        zones.layout(entity_manager.entityQuery({kind:"map"}))
        break
      case "pickerdone":
        UXPage.push("main")
        if(args.subvalue) {
          UXPage.log("loading map " + args.subvalue )
          entity_manager.mapLoad(args.subvalue)
        }
        break
      case "maps":
        map.markerSource( entity_manager.entityQuery.bind(entity_manager) )
        UXPage.push("maps")
        break
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
      case "save":
        entity_manager.mapSave()
        break
    }
  })

}


