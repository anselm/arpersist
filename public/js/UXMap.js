

///
/// UXMap
///
/// Controls the view for the map page
/// This is a google maps page used in several ways
/// One way it is used is to help fine tine the position of an arkit anchor
///


import {UXPage} from './UXComponents.js'

export class UXMap {

	constructor(dom_element_id) {
		this.map = 0
		this.infoWindow = 0
		this.markerCenter = 0
		this.latitude_longitude_updated = 0
		this.mapInit(dom_element_id)
		this.markers = {}
		this.markerCallback = 0
		setInterval( this._markerUpdate.bind(this), 1000 )
	}

	markerSource(callback) { this.markerCallback = callback }

	_markerUpdate() {
		if(!this.markerCallback) {
			return
		}
		let results = this.markerCallback()
		if(!results || !results.length) {
			return
		}
		// TODO mark all markers as not surviving
		results.forEach((entity) => {
			if(!entity.gps) return
	        let pos  = { latitude: entity.gps.latitude, longitude:entity.gps.longitude, title:entity.uuid }
	    	let marker = this.markers[entity.uuid]
	    	marker = this._marker(marker,pos)
	    	this.markers[entity.uuid] = marker
		})
		// sweep
		// TODO do this every few frames while this display is up
	}

	_marker(marker,pos) {
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

	mapInit(dom_element_id) {
		let element = document.getElementById(dom_element_id)
		if(!element) {
			this.err("No map div")
			return
		}
		let map = this.map = new google.maps.Map(element, {
			center: {lat: 45.5577417, lng: -122.6758163, altitude: 100 },
			zoom: 15,
			mapTypeId: 'satellite'
		})

		//### Add a button on Google Maps ...
		var button = document.createElement('button');
		button.className = "uxbutton"
		button.innerHTML = "back"
		button.onclick = function(e) { UXPage.pop() }
		map.controls[google.maps.ControlPosition.LEFT_TOP].push(button);

		// listen for change events for an entity placement
		map.addListener('center_changed', (e) => {
			let pos = this.map.getCenter()
			pos = { lat: pos.lat(), lng: pos.lng() }
			this._mapMarker(pos)
		})

		// establish initial map position

		let infoWindow = this.infoWindow = new google.maps.InfoWindow
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

