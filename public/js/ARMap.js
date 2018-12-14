

///
/// ARMap
///
/// Controls the view for the map page
/// This is a google maps page used in several ways
/// One way it is used is to help fine tine the position of an arkit anchor
///

export class ARMap extends HTMLElement {

	constructor(_id=0,_class=0,entity_manager) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager
		this.map = 0
		this.infoWindow = 0
		this.markerCenter = 0
		this.markers = {}
		this.centerlatlng = { lat:37.7749, lng:-122.4194, altitude:0 }

		new MutationObserver(() => {
			console.log("map hideshow " + this.style.display)
			if(this.style.display != "block") {
				this.onhide()
				return
			}
			this.onshow()
		}).observe(this, { attributes: true });

	}

	onshow() {

		// google maps present?
		if(typeof google === 'undefined') {
			this.err("cannot find google maps")
			return
		}

		// center on selected entity to be nice
		let entity = this.entity_manager.entityGetSelected()
		if(entity && entity.gps) {
			this.centerlatlng = {lat:entity.gps.latitude, lng:entity.gps.longitude, altitude:entity.gps.altitude }
			this._mapShow()
		}

		// get browser position and center map - TODO duplicate code
		else if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(async (position) => {
				let latitude = position.coords.latitude
				let longitude = position.coords.longitude
				let response = 0
				let altitude = 0
				try {
					let key = "AIzaSyBrirea7OVV4aKJ9Y0UAp6Nbr6-fXtr-50"
					let url = "https://maps.googleapis.com/maps/api/elevation/json?locations="+latitude+","+longitude+"&key="+key
	                response = await fetch(url)
	                let json = await response.json()
	                console.log("fetched json")
	                console.log(json)
	                console.log(json.results.elevation)
	                let altitude = json.results.elevation
	            } catch(e) {
	            	this.err(e)
	            }
				this.centerlatlng = { lat:position.coords.latitude, lng:position.coords.longitude, altitude:altitude }
				this._mapShow()
			}, () => {
				this._mapShow()
				this._mapError('Error: The Geolocation service failed.')
			})
		} else {
			this._mapShow()
			this._mapError('Error: Your browser does not support geolocation.')
		}
	}

	_mapShow() {

		if(!this.map) {

			this.mapElement = document.createElement("div")
			this.mapElement.style = "width:100%;height:100%;background:blue"
			this.appendChild(this.mapElement)

			// a map
			this.map = new google.maps.Map(this.mapElement, {
				center: this.centerlatlng,
				zoom: 15,
				mapTypeId: 'satellite'
			})

			// add a back button to go to the previous page
			var button = document.createElement('button');
			button.className = "uxbutton"
			button.innerHTML = "back"
			button.style.backgroundColor = "white"
			button.onclick = this.pop
			this.map.controls[google.maps.ControlPosition.LEFT_TOP].push(button);

		}

		// recenter
		this.map.setCenter(this.centerlatlng);

		// watch for entity updates while active
		if(!this.interval && this.map) {
			this.interval = setInterval( this._markerUpdateEntities.bind(this), 100 )
		}
	}

	_mapError(message) {
		this.err(message)
		return
		if(!this.map) return
		if(!this.infoWindow) this.infoWindow = new google.maps.InfoWindow
		this.this.infoWindow.setPosition(this.centerlatlng)
		this.infoWindow.setContent(message)
		this.infoWindow.open(this.map)
	}

	_markerUpdateEntities() {
		// wait for map
		if(!this.map) {
			return
		}
		// get all entities matching criteria
        let results = this.entity_manager.entityQuery()
		if(!results || !results.length) {
			return
		}
		// mark all markers as not surviving
		for(let uuid in this.markers) { this.markers[uuid].survivor = 0 }
		// paint all entities
		results.forEach((entity) => {
			if(!entity.gps) return
	        let latlng  = { lat: entity.gps.latitude, lng:entity.gps.longitude }
	    	let marker = this.markers[entity.uuid]
	    	if(!marker) {
				marker = this.mapEntityMarker(entity,latlng)
    	    } else if(!marker.dragging) {
    	    	marker.setPosition(latlng)
    	    }
	    	marker.survivor = 1
		})
		// wipe old markers
		for(let uuid in this.markers) {
			let marker = this.markers[uuid]
			if(marker && !marker.survivor) {
				marker.setMap(null)
				google.maps.event.clearInstanceListeners(marker)
				delete this.markers[uuid]
			}
		}
	}

	 mapEntityMarker(entity,latlng) {

	 	let uuid = entity.uuid

		let label = entity.kind == "gps" ? 'x' : 'o'

		let marker = this.markers[entity.uuid] = new google.maps.Marker({
			title:uuid,
			position:latlng,
			map:this.map,
			label:label,
			draggable:true
		})

		marker.addListener('click', () => {
			this.err("marker selected " + uuid)
			this.entity_manager.entitySetSelectedByUUID(uuid)
		})

	    marker.addListener('drag', () => {
	    	let ll = marker.getPosition()
			let entity = this.entity_manager.entitySetSelectedByUUID(uuid)
			if(!entity || !entity.gps) return
			this.entity_manager.entityUpdateLatLng(entity,ll.lat(),ll.lng(),entity.gps.altitude)
			entity.published = 0
			marker.dragging = 1
	    })

	    marker.addListener('dragend', (e) => {
			marker.dragging = 0
	    })

	    return marker
	}

	onhide() {
		if(this.interval) {
			clearInterval(this.interval)
			this.interval = 0
		}
	}

}

customElements.define('ar-map', ARMap)
