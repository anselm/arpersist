
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Wrapper for WebXR-Polyfill that has a pile of static utilty methods to add geographic support to anchors
///
/// Given a map and one anchor on that map at a known gps location - provide gps coordinates for other anchors on the same map
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class XRAnchorCartography {

	static _gps() {
	    return new Promise((resolve, reject)=>{

			let gps = { latitude:37.7749, longitude:-122.4194, altitude: 0 }

			if (!("geolocation" in navigator)) {
				// fake it for now
				resolve(gps)
			}

			function success(pos) {
				let gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, altitude: pos.coords.altitude, accuracy: pos.coords.accuracy }
				resolve(gps)
			}

			function error(err) {
				// fake it
				resolve(gps)
				//reject(err)
			}

			try {
				let options = {
				  enableHighAccuracy: true,
				  timeout: 5000,
				  maximumAge: 0
				};
				navigator.geolocation.getCurrentPosition(success, error, options);
			} catch(err) {
				// unusual error - just return it
				reject(err)
			}
		})
	}

	static async _altitude(latitude,longitude) {
		let elevation = 0
		try {
			let key = "AIzaSyBrirea7OVV4aKJ9Y0UAp6Nbr6-fXtr-50"
			let url = "https://maps.googleapis.com/maps/api/elevation/json?locations="+latitude+","+longitude+"&key="+key
	        let response = await fetch(url)
	        let json = await response.json()
	        console.log("altitude query was")
	        console.log(json)
	        if(json && json.results) elevation = json.results.elevation
	    } catch(e) {
	    	console.error(e)
	    }
	    return elevation
	}

	static async gps() {
		let gps = await XRAnchorCartography._gps()
		let altitude = await XRAnchorCartography._altitude(gps.latitude,gps.longitude)
		if(altitude) gps.altitude = altitude
		return gps
	}

	static async move(frame,focus,xyz,q) {

		// TODO this is so much easier than projecting through arkit and rebuilding anchors - maybe I should just make anchors this way in general

		if(focus.anchorUID) {
			let anchor = frame.getAnchor(focus.anchorUID)
			if(anchor) {
				frame.removeAnchor(focus.anchorUID)
				console.log("removing anchor due to moving in space " + focus.anchorUID )
				focus.anchorUID = 0
			}
		}

		// get an anchorUID at the target point
		const wc = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
		focus.anchorUID = await frame.addAnchor(wc, [xyz.x, xyz.y, xyz.z], [q.x, q.y, q.z, q.w]) // [ !actually returns an anchorUID! ]

		focus.relocalized = 0
	}

	///
	/// Get a new anchor
	///
	/// The caller has an abstract concept of a point in space they either want to get information about or update their understanding of.
	/// (In caller terms this can be a point at the camera, or a ray test, or other undefined queries yet to be implemented.)
	///
	/// ARKit itself formalizes this shared understanding as an 'anchor' - and anchors can move as ground truth updates.
	///
	/// As well, this engine introduces another concept on top of that of a gpsAnchor which associates an arkit anchor with a gps.
	///

	static async attach(frame,focus,get_location,get_raytest,screenx=0.5,screeny=0.5) {

		// get a gps reading?

		if(get_location) {
			focus.kind = "gps"
			focus.gps = await this.gps()
			if(!focus.gps) {
				return 0
			}
			focus.cartesian = Cesium.Cartesian3.fromDegrees(focus.gps.longitude, focus.gps.latitude, focus.gps.altitude)
		}

		// flush old anchor just to reduce memory usage in arkit

		if(focus.anchorUID) {
			let anchor = frame.getAnchor(focus.anchorUID)
			if(anchor) {
				frame.removeAnchor(focus.anchorUID)
				console.log("removing anchor due to moving in space " + focus.anchorUID )
				focus.anchorUID = 0
			}
		}

		// get an anchor at camera?

		if(!get_raytest) {
			let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
			focus.anchorUID = await frame.addAnchor(headCoordinateSystem,[0,0,0])
		}

		// get an anchor at probe?

		else {

			// probe the world and find an anchor(y kinda wrappery thing) that intersects a plane (using a ray shot from screen space)
			let offset = await frame.findAnchor(screenx,screeny)  // [ !actually returns an anchor offset! ]
			if(!offset) {
				return 0
			}

			// get this anchor - which is not the final one
			let anchor = frame.getAnchor(offset.anchorUID)
			if(!anchor) {
				return 0
			}

			// pull a 3js transform out of temporary anchor and delete temporary anchor(y kinda wrapper thingie)
			let m = new THREE.Matrix4()
			let xr_transform = offset.getOffsetTransform(anchor.coordinateSystem)
			m.fromArray(xr_transform)

			let s = new THREE.Vector3()
			let xyz = new THREE.Vector3()
			let q = new THREE.Quaternion()
			m.decompose(xyz,q,s);
			frame.removeAnchor(offset.anchorUID);
			console.log("throwing away temporary anchor " + offset.anchorUID )

			// get an anchorUID at the target point
			const wc = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
			focus.anchorUID = await frame.addAnchor(wc, [xyz.x, xyz.y, xyz.z], [q.x, q.y, q.z, q.w]) // [ !actually returns an anchorUID! ]
			//console.log("built ordinary anchor at " + focus.anchorUID)
			//console.log(xyz)
			//console.log(q)
			// there is enough information here to relocalize immediately but allow the relocalization step to do the work below
		}

		// grant a uuid once only

		if(!focus.uuid) focus.uuid = focus.anchorUID

		return focus
	}

	static relocalize(frame,focus,parent) {

		// try recover local anchor

		focus.anchor = focus.anchorUID ? frame.getAnchor(focus.anchorUID) : 0

		// relocalize from anchor if desired

		if(focus.anchor && (focus.kind == "gps" || !focus.relocalized) ) {

			focus.offset = new XRAnchorOffset(focus.anchorUID)
			focus.xr_transform = focus.offset.getOffsetTransform(focus.anchor.coordinateSystem)
			let m = new THREE.Matrix4()
			m.fromArray(focus.xr_transform)

			let s = new THREE.Vector3()
			let xyz = new THREE.Vector3()
			let q = new THREE.Quaternion()
			m.decompose(xyz,q,s)
			focus.quaternion = new THREE.Quaternion(q._x,q._y,q._z,q._w) // TODO huh?
			focus.xyz = xyz


			// (decided not to store transform in object but to always rebuild from parts)
			//m.compose(focus.xyz,q, new THREE.Vector3(1,1,1) )
			//focus.transform = m

			// non gps objects get their cartesian coordinates set relative to the gps anchor (gps objects already have it set)

			if(focus.kind != "gps" && parent && parent.xyz) {

				// get position relative to parent gps object (in arkit space)

				let temp = {
					x: focus.xyz.x-parent.xyz.x,
					y: focus.xyz.y-parent.xyz.y,
					z: focus.xyz.z-parent.xyz.z
				}

				// treat this as a cartesian3 vector - but flip the axes (ARKit is East Up(outerspace) South and Cesium (by default) is East North Up(outerspace) )

				let temp2 = new Cesium.Cartesian3(temp.x, -temp.z, temp.y )

				// given magical cartesian fixed frame reference, tack on the vector segment

				focus.cartesian = Cesium.Matrix4.multiplyByPoint( parent.fixed, temp2, new Cesium.Cartesian3() )

				// also back compute the GPS - right now either cartesian or gps are used interchangeably and both should be identical

				let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(focus.cartesian)
				let latitude = Cesium.Math.toDegrees(carto.latitude)
				let longitude = Cesium.Math.toDegrees(carto.longitude)
				let altitude = carto.height
				focus.gps = { latitude:latitude, longitude:longitude, altitude:altitude }
			}

			// also recover local facts fixed and inverse for convenience

			if(focus.cartesian) {
				focus.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(focus.cartesian)
				focus.inverse = Cesium.Matrix4.inverseTransformation(focus.fixed, new Cesium.Matrix4())
			}

			// effectively completely relocalized at this point

			focus.relocalized = 1
		}

		// for entities without an anchor, as long as they have cartesian coordinates they should be recoverable relative to gps anchor

		else if(focus.cartesian && parent && parent.inverse) {

			// could forward compute the gps from the cartesian ... but no real point in doing so... it was done once earlier
			//let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(focus.cartesian)
			//focus.gps = { latitude: Cesium.Math.toDegrees(carto.latitude), longitude: Cesium.Math.toDegrees(carto.longitude), altitude: 0}

			if(!parent.xyz) {
				// weird TODO remove if it stops showing up
				console.error("xranchorcarto parent bad - this is not excellent")
				return
			}

			// get a vector that is relative to the gps anchor (transform from ECEF to be relative to gps anchor)

			let temp = Cesium.Matrix4.multiplyByPoint(parent.inverse, focus.cartesian, new Cesium.Cartesian3());

			// flip axes from ENU to EUS (from cesium to arkit)

			let temp2 = {
				x:temp.x,
				y:temp.z,
				z:-temp.y
			}

			// and also add on the gps anchor arkit offset to regenerate xyz

			focus.xyz = new THREE.Vector3(
				parent.xyz.x + temp2.x,
				parent.xyz.y + temp2.y,
				parent.xyz.z + temp2.z
			)


			// (decided not to store transform in object but to always rebuild from parts)
			// generate transform
			//let m = new THREE.Matrix4()
			//let s = new THREE.Vector3(1,1,1)
			//let q = focus.quaternion || new THREE.Quaternion()
			//m.compose(focus.xyz,q,s)
			//focus.transform = m

			// mark as relocalized

			focus.relocalized = 1
		}
	}

	static updateLatLng(focus,latitude,longitude,altitude) {
		// a helper to allow external moving of a feature - since cartesian coordinates are used internally but gps used for ease of use
		focus.gps.latitude = latitude
		focus.gps.longitude = longitude
		focus.gps.altitude = altitude
		focus.cartesian = Cesium.Cartesian3.fromDegrees(focus.gps.longitude, focus.gps.latitude, focus.gps.altitude)
	}
}

