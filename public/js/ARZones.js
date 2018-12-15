
export class ARZones extends HTMLElement {

  constructor(_id,_class,entity_manager) {
    super()
      if(_id) this.id = _id
      if(_class) this.className = _class
      this.entity_manager = entity_manager

      new MutationObserver(() => {
        console.log("zones hideshow " + this.style.display)
        if(this.style.display != "block") return
        this.onshow()
      }).observe(this, { attributes: true });

  }

  onshow() {

    // rebuild picker from scratch every time 

    let entities = this.entity_manager.entityQuery({kind:"gps"})

    this.innerHTML = "<br/><br/><br/>"

    let form = document.createElement("form")
    this.appendChild(form)

    let center = document.createElement("center")
    form.appendChild(center)

    let label = document.createElement("label"); label.innerHTML = "Please pick a map"
    center.appendChild(label)
    center.appendChild(document.createElement("br"))

    let elements = document.createElement("div")
    center.appendChild(elements)

    // exit button
    if(true) {
      let element = document.createElement("button")
      element.innerHTML = "back"
      element.style.color = "green"
      element.onclick = (e) => {
        e.preventDefault()
          this.dispatchEvent(new Event('router_pop',{bubbles:true}))
        return false
      }
      elements.appendChild(element)
      elements.appendChild(document.createElement("br"))
    }

    // make a gps anchor - TODO may remove this again - it's just helpful to anchor other content prior to loading a map
    if(true) {
      let element = document.createElement("button")
      element.innerHTML = "anchor"
      element.onclick = (e) => {
        e.preventDefault()
        this.entity_manager.entityAddGPS()
        this.dispatchEvent(new Event('router_pop',{bubbles:true}))
        return false
      }
      elements.appendChild(element)
      elements.appendChild(document.createElement("br"))
    }

    // debug
    if(true) {
      let element = document.createElement("button")
      element.innerHTML = "debug"
      element.onclick = (e) => {
        e.preventDefault()
        this.debugging = document.getElementById("debug_logging")
        this.debugging.style.display = (this.debugging.style.display == 'none') ? 'block' : 'none'
        return false
      }
      elements.appendChild(element)
      elements.appendChild(document.createElement("br"))
    }

    // reset and wipe everything - disabled for now - no point can just refresh app
    if(false) {
      let element = document.createElement("button")
      element.innerHTML = "reset"
      element.style.color = "red"
      element.onclick = (e) => {
        e.preventDefault()
        this.entity_manager.entityNetworkRestart()
        return false
      }
      elements.appendChild(element)
      elements.appendChild(document.createElement("br"))
    }

    // save a map file - for admins only ideally but exposed for now
    if(true) {
      let element = document.createElement("button")
      element.id = "login_show_save"
      element.innerHTML = "save zone"
      element.onclick = (e) => {
        e.preventDefault()
        this.entity_manager.mapSave()
        this.dispatchEvent(new Event('router_pop',{bubbles:true}))
        return false
      }
      elements.appendChild(element)
      elements.appendChild(document.createElement("br"))
    }

    // say other cases - could use a slider and limit etc TODO
    for(let i = 0; i < entities.length; i++) {
      let entity = entities[i]
      let element = document.createElement("button")
      element.anchorUID = entity.anchorUID
      element.innerHTML = entity.name
      elements.appendChild(element)
      element.onclick = (e) => {
        e.preventDefault()
        let choice = e.srcElement.anchorUID
        console.log("Picked map " + choice)
        this.entity_manager.mapLoad(choice)
        this.dispatchEvent(new Event('router_pop',{bubbles:true}))
        return false
      }
      elements.appendChild(document.createElement("br"))
    }
  }

}

customElements.define('ar-zones', ARZones)

