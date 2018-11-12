

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

	mapMarker(pos) {
		let c = this.map.getCenter()
		if(!this.markerCenter) {
			this.markerCenter = new google.maps.Marker({position: pos, map: this.map})
		} else {
			this.markerCenter.setPosition( pos )
		}
	}

	mapError(message, infoWindow, pos) {
		infoWindow.setPosition(pos)
		infoWindow.setContent(message)
		infoWindow.open(this.map)
	}

	mapInit() {

		let map = this.map = new google.maps.Map(document.getElementById('map'), {
			center: {lat: 45.397, lng: -120.644},
			zoom: 13,
			mapTypeId: 'satellite'
		})

		//### Add a button on Google Maps ...
		var home = document.createElement('button');
		home.className = "uxbutton"
		home.innerHTML = "back"
		home.onclick = function(e) { window.ux.pop() }
		map.controls[google.maps.ControlPosition.LEFT_TOP].push(home);

		let infoWindow = this.infoWindow = new google.maps.InfoWindow

		map.addListener('center_changed', (e) => {
			this.mapMarker(this.map.getCenter())
		})

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition((position) => {
				let pos = { lat: position.coords.latitude, lng: position.coords.longitude }
				this.map.setCenter(pos)
				this.mapMarker(pos)
			}, function() {
				mapError('Error: The Geolocation service failed.', infoWindow, map.getCenter())
			})
		} else {
			mapError('Error: Your browser does not support geolocation.', infoWindow, map.getCenter())
		}
	}
}

