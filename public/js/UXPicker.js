import {UXPage} from './UXComponents.js'

export class UXPicker extends UXPage {

  layout(picker_dynamic_list,results) {

    let elements = document.getElementById(picker_dynamic_list)

    // flush just in case this is re-run
    while (elements.firstChild) elements.removeChild(elements.firstChild);

    // say "a fresh map"
    {
      let element = document.createElement("button")
      element.innerHTML = "a fresh map"
      element.onclick = (e) => {
        e.preventDefault()
        this.log("Picked fresh map")
        this.action("pickerdone",0)
        return false
      }
      elements.appendChild(element)
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
        this.action("pickerdone",choice)
        return false
      }
      elements.appendChild(document.createElement("br"))
    }
  }
}

