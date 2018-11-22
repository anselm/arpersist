
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Wrapper for WebXR-Polyfill that has a pile of static utilty methods to add geographic support to anchors
///
/// Given a map and one anchor on that map at a known gps location - provide gps coordinates for other anchors on the same map
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class XRAnchorCartography {

	//gpsPromise() { return this.constructor.gpsPromise() }
	static gpsPromise() {

	    return new Promise((resolve, reject)=>{

			if (!("geolocation" in navigator)) {
				// fake it for now
				let gps = { latitude: 45.5577417, longitude: -122.6758163, altitude: 100 }
				resolve(gps)
			}

			function success(pos) {
				var crd = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, altitude: pos.coords.altitude, accuracy: pos.coords.accuracy }
				resolve(crd)
			}

			function error(err) {
				// fake it
				let gps = { latitude: 45.5577417, longitude: -122.6758163, altitude: 100 }
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

	async featureAtPose(frame) { return this.constructor.featureAtPose(frame) }
	static async featureAtPose(frame) {
		// TODO does the final anchor that is created end up with XRCoordinateSystem.TRACKER??
		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		let anchorUID = frame.addAnchor(headCoordinateSystem,[0,0,0])
		return {
			  anchorUID: anchorUID,
			       kind: "local",
			  transform: 0,
		    translation: 0,
			orientation: 0,
			relocalized: false
		}
	}

	static removeAnchor(frame,anchorUID) {
		frame.removeAnchor(anchorUID)
	}

	async featureAtIntersection(frame,x=0.5,y=0.5) { return featureAtIntersection(frame,x,y) }
	static async featureAtIntersection(frame,x=0.5,y=0.5) {

		//let anchorOffset = await frame.findAnchor(x,y) // this way is broken and both seem similar - whats what? TODO and then remove _session hack
		let anchorOffset = await frame._session.hitTest(x,y)
		if(!anchorOffset) {
			return 0
		}

		let anchor = frame.getAnchor(anchorOffset.anchorUID)
		if(!anchor) {
			console.error("featureAtIntersection: just had an anchor but no longer? " + anchorUID )
			return 0
		}

		let m = new THREE.Matrix4()
		let s = new THREE.Vector3()
		let xyz = new THREE.Vector3()
		let q = new THREE.Quaternion()

		// get a new anchor without the offset
		m.fromArray(anchorOffset.getOffsetTransform(anchor.coordinateSystem))
		m.decompose(xyz,q,s);
		const wc = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
		const anchorUID = frame.addAnchor(wc, [xyz.x, xyz.y, xyz.z], [q.x, q.y, q.z, q.w])

		// TODO is it ok to to delete unused anchor? does it make sense / save any memory / have any impact?
		frame.removeAnchor(anchor.anchorUID); anchor = 0
		console.log("*** will ignore this anchor from now on " + anchorOffset.anchorUID)

		return {
			  anchorUID: anchorUID,
			       kind: "local",
			  transform: 0,
		    translation: 0,
			orientation: 0,
			relocalized: false
		}
	}

	async featureAtGPS(frame) { return this.constructor.featureAtGPS(frame) }
	static async featureAtGPS(frame) {
		let gps = await this.gpsPromise()
		if(!gps) {
			return 0
		}
		let feature = await this.featureAtPose(frame)
		feature.gps = gps
		return feature
	}

	async featureRelocalize(frame,feature,gpsfeature=0) { return this.constructor.featureAtGPS(frame,feature,gpsfeature) }
	static featureRelocalize(frame,feature,gpsfeature=0) {
		if(feature.kind == "gps") {
			// only features of the kind gps can be relocalized using their gps...
			if(!feature.gps) {
				console.error("featureRelocalize: corrupt feature")
				return
			}
			feature.cartesian = Cesium.Cartesian3.fromDegrees(feature.gps.longitude, feature.gps.latitude, feature.gps.altitude)
			feature.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(feature.cartesian)
			feature.inverse = Cesium.Matrix4.inverseTransformation(feature.fixed, new Cesium.Matrix4())
			feature.anchor = frame.getAnchor(feature.anchorUID)
			if(feature.anchor) {
				// this can change every frame
				feature.offset = new XRAnchorOffset(feature.anchorUID)
				feature.transform = feature.offset.getOffsetTransform(feature.anchor.coordinateSystem)
				// only mark as relocalized after an anchor appears since there's a higher expectation on an initial gpsfeature to have an anchor AND a gps
				feature.pose = this._toLocal(feature.cartesian,feature.inverse,feature.transform) // kind of redundant way to achieve this but...
				feature.relocalized = true
				return
			}
		} else {
			// cannot do much with other features if there is no context
			if(!gpsfeature || !gpsfeature.relocalized) {
				console.error("featureRelocalize: invalid gps feature passed")
				return
			}
			feature.anchor = frame.getAnchor(feature.anchorUID)
			if(feature.anchor) {
				// if a feature has an anchor then the cartesian can be recomputed over and over (and it can change every frame)
				feature.offset = new XRAnchorOffset(feature.anchorUID)
				feature.transform = feature.offset.getOffsetTransform(feature.anchor.coordinateSystem)
				feature.cartesian = this._toCartesian(feature.transform,gpsfeature.transform,gpsfeature.fixed)
				feature.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(feature.cartesian)
				feature.inverse = Cesium.Matrix4.inverseTransformation(feature.fixed, new Cesium.Matrix4())

				// may as well also remember gps coordinates (so server needs to think less) - TODO calculate elevation
				let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(feature.cartesian);
				feature.gps = { latitude: Cesium.Math.toDegrees(carto.latitude), longitude: Cesium.Math.toDegrees(carto.longitude), altitude: 0}
			}
		}
		// can compute screen pose of any feature (gps or otherwise) that has cartesian coordinates (if there is a local gps+anchor available as a reference)
		if(feature.cartesian && gpsfeature && gpsfeature.relocalized) {
			feature.pose = this._toLocal(feature.cartesian,gpsfeature.inverse,gpsfeature.transform)
			feature.relocalized = true
		}
	}

	///
	/// Generate cartesian coordinates from relative transforms
	/// TODO could preserve rotation also
	///

	static _toCartesian(et,wt,gpsFixed) {

		// if a gps coordinate is supplied then this is a gps related anchor and it's a good time to save a few properties

		// where is the gps point?
		//console.log("toCartesian: we believe the arkit pose for the gps anchor is at: ")
		//console.log(wt)

		// where is the feature?
		//console.log("toCartesian: point in arkit frame of reference is at : ")
		//console.log(et)

		// relative to gps anchor?
		// (subtract rather than transform because as far as concerned is in EUS and do not want any orientation to mar that)
		let ev = { x: et[12]-wt[12], y: et[13]-wt[13], z: et[14]-wt[14] }
		//console.log("toCartesian: relative to gps anchor in arkit is at ")
		//console.log(ev)

		//
		// form a relative vector to the gps anchor - in cartesian coordinates - this only works for points "NEAR" the gps anchor
		//
		// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
		// ARKit relative EUS coordinates are "kinda like" polar coordinates with +x to the right, +y towards space, -z towards the north pole
		//
		// ECEF is a cartesian space centered on the earth with +x pointing towards 0,0 long,lat and +y coming out in china, and +z pointing north
		// https://en.wikipedia.org/wiki/ECEF
		//
		// Cesium is default ENU so we have to swap axes (or else order Cesium around a bit more)
		// https://groups.google.com/forum/#!topic/cesium-dev/NSen9Z04NEo
		//

		let ev2 = new Cesium.Cartesian3(
			ev.x,							// in ARKit, ECEF and Cesium smaller X values are to the east.
			-ev.z,							// in ARKit smaller Z values are to the north... and in Cesium by default vertices are East, North, Up
			ev.y 							// in ARKit larger Y values point into space... and in Cesium "up" is the third field by default
			)

		// Get a matrix that describes the orientation and displacement of a place on earth and multiply the relative cartesian ray by it
		let cartesian = Cesium.Matrix4.multiplyByPoint( gpsFixed, ev2, new Cesium.Cartesian3() )

		//console.log("debug - absolutely in ecef at")
		//console.log(cartesian)
		//console.log(ev2)

		return cartesian
	}

	static _toLocal(cartesian,inv,wt) {

		// TODO full orientation

		// transform from ECEF to be relative to gps anchor
		let v = Cesium.Matrix4.multiplyByPoint(inv, cartesian, new Cesium.Cartesian3());

		// although is now in arkit relative space, there is still a displacement to correct relative to the actual arkit origin, also fix axes
		v = {
			x:    v.x + wt[12],
			y:    v.z + wt[13],
			z:  -(v.y + wt[14]),
		}

		return v
	}

}

