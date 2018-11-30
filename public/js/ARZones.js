
export class ARZones extends HTMLElement {

  content() {
    return `
    <form>
    <center>
    <br/><label>Please pick a map </label>
    <div id="picker_dynamic_list"><label>...loading...</label></div>
    </center>
    </form>
    `
  }

  constructor(_id,_class,entity_manager) {
    super()
      if(_id) this.id = _id
      if(_class) this.className = _class
      this.entity_manager = entity_manager
  }

  connectedCallback() {
    this.innerHTML = this.content()
    let entities = this.entity_manager.entityQuery({kind:"gps"})
    this.layout(entities)
  }

  layout(results) {

    let picker_dynamic_list = 'picker_dynamic_list' // TODO clearly terrible
    let elements = document.getElementById(picker_dynamic_list)
    if(!elements) {
      this.err("No picker")
      return
    }

    // flush just in case this is re-run
    while (elements.firstChild) elements.removeChild(elements.firstChild);

    // exit
    {
      let element = document.createElement("button")
      element.innerHTML = "back"
      element.style.color = "green"
      element.onclick = (e) => {
        e.preventDefault()
        this.pop()
        return false
      }
      elements.appendChild(element)
    }

    // save a map file
    {
      let element = document.createElement("button")
      element.id = "login_show_save"
      element.innerHTML = "zone"
      element.onclick = (e) => {
        e.preventDefault()
        this.entity_manager.mapSave()
        this.pop()
        return false
      }
      elements.appendChild(element)
    }

    // make a gps anchor
    {
      let element = document.createElement("button")
      element.innerHTML = "anchor"
      element.onclick = (e) => {
        e.preventDefault()
        this.entity_manager.mapSave()
        this.pop()
        return false
      }
      elements.appendChild(element)
    }

    // reset and wipe everything
    {
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


    // say other cases - could use a slider and limit etc TODO
    for(let i = 0; i < results.length; i++) {
      let entity = results[i]
      let element = document.createElement("button")
      element.innerHTML = entity.anchorUID
      elements.appendChild(element)
      element.onclick = (e) => {
        e.preventDefault()
        let choice = e.srcElement.innerText
        this.log("Picked map " + choice)
        //this.action("pickerdone",choice)
        this.entity_manager.mapLoad(choice)
        this.pop()
        return false
      }
      elements.appendChild(document.createElement("br"))
    }
  }

  onshow() {
    if(this.entity_manager.party.admin)
      document.getElementById("login_show_save").style.display = "block"
    else 
      document.getElementById("login_show_save").style.display = "none"
  }
}

customElements.define('ar-zones', ARZones)

