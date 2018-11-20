

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXMapComponent
///
/// Controls the view for the map page
/// This is a google maps page used in several ways
/// One way it is used is to help fine tine the position of an arkit anchor
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class UXMapComponent {

	constructor() {
		this.map = 0
		this.infoWindow = 0
		this.markerCenter = 0
		this.mapInit()
	}

	marker(marker,pos) {
		pos = {lat:parseFloat(pos.latitude),lng:parseFloat(pos.longitude)}
		if(marker) {
			marker.setPosition(pos)
		} else {
			marker = new google.maps.Marker({title: pos.title, position: pos, map: this.map})
		}
		return marker
	}

	mapError(message, infoWindow, pos) {
		infoWindow.setPosition(pos)
		infoWindow.setContent(message)
		infoWindow.open(this.map)
	}

	_mapMarker(pos) {
		if(!this.markerCenter) {
			this.markerCenter = new google.maps.Marker({position: pos, map: this.map})
		} else {
			this.markerCenter.setPosition( pos )
		}
		this.latitude = pos.lat
		this.longitude = pos.lng
		this.latitude_longitude_updated = 1
	}

	mapCenter(pos) {
		if(!this.map) return
		pos = {lat:parseFloat(pos.latitude),lng:parseFloat(pos.longitude)}
		this.map.setCenter(pos)
		this._mapMarker(pos)
	}

	mapInit() {

		let map = this.map = new google.maps.Map(document.getElementById('map'), {
			center: {lat: 45.397, lng: -120.644},
			zoom: 13,
			mapTypeId: 'satellite'
		})

		//### Add a button on Google Maps ...
		var button = document.createElement('button');
		button.className = "uxbutton"
		button.innerHTML = "back"
		button.onclick = function(e) { window.ux.pop() } // TODO a message bus would prevent this component knowing about other stuff
		map.controls[google.maps.ControlPosition.LEFT_TOP].push(button);

		button = document.createElement('button');
		button.className = "uxbutton"
		button.innerHTML = "refresh"
		button.onclick = function(e) { window.ux.map_overview_update() } // TODO a message bus would prevent this component knowing about other stuff
		map.controls[google.maps.ControlPosition.LEFT_TOP].push(button);

		let infoWindow = this.infoWindow = new google.maps.InfoWindow

		// listen for change events for an entity placement
		map.addListener('center_changed', (e) => {
			let pos = this.map.getCenter()
			pos = { lat: pos.lat(), lng: pos.lng() }
			this._mapMarker(pos)
		})

		// establish initial map position
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition((position) => {
				this.mapCenter(position.coords)
			}, () => {
				//this.mapError('Error: The Geolocation service failed.', infoWindow, map.getCenter())
			})
		} else {
			//this.mapError('Error: Your browser does not support geolocation.', infoWindow, map.getCenter())
		}
	}
}

