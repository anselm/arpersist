
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

	///
	/// Get an anchor
	///
	/// The caller has an abstract concept of a point in space they either want to get information about or update their understanding of.
	/// (In caller terms this can be a point at the camera, or a ray test, or other undefined queries yet to be implemented.)
	///
	/// ARKit itself formalizes this shared understanding as an 'anchor' - and anchors can move as ground truth updates.
	///
	/// As well, this engine introduces another concept on top of that of a gpsAnchor which associates an arkit anchor with a gps.
	///

	static async manufacture(args) {

		let frame           = args.frame
		let session         = args.session
		let focus           = args.focus || {}
		let get_location    = args.get_location
		let get_raytest     = args.get_raytest
		let screenx         = args.screenx || 0.5
		let screeny         = args.screeny || 0.5

		// get a gps reading?

		if(get_location) {
			focus.kind = "gps"
			focus.gps = await this.gpsPromise()
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
				focus.anchorUID = 0
			}
		}

		// get an anchor at camera?

		if(!get_raytest) {

			// get an anchorUID at the camera pose
			let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
			focus.anchorUID = await frame.addAnchor(headCoordinateSystem,[0,0,0])
			console.log("built new anchor at camera " + focus.anchorUID )

		}

		// get an anchor at probe?

		else {

			// probe the world and find an anchor(y kinda wrappery thing) that intersects a plane (using a ray shot from screen space)
			let offset = await frame.findAnchor(screenx,screeny)  // [ !actually returns an anchor offset! ]
			//let offset = await session.hitTest(screenx,screeny)
			if(!offset) {
				return 0
			}

			let anchor = await frame.getAnchor(offset.anchorUID)
			if(!anchor) {
				return 0
			}

			// pull a 3js transform out of temporary anchor and delete temporary anchor(y kinda wrapper thingie)
			let m = new THREE.Matrix4()
			let s = new THREE.Vector3()
			let xyz = new THREE.Vector3()
			let q = new THREE.Quaternion()
			m.fromArray(offset.getOffsetTransform(anchor.coordinateSystem))
			m.decompose(xyz,q,s);
			frame.removeAnchor(offset.anchorUID);

			// get an anchorUID at the target point
			const wc = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
			focus.anchorUID = await frame.addAnchor(wc, [xyz.x, xyz.y, xyz.z], [q.x, q.y, q.z, q.w]) // [ !actually returns an anchorUID! ]
			console.log("built ordinary anchor at " + focus.anchorUID)
			console.log(xyz)
			console.log(q)
		}

		// grant a uuid once only

		if(!focus.uuid) focus.uuid = focus.anchorUID

		return focus
	}

	static relocalize(args) {

		let frame           = args.frame
		let session         = args.session
		let focus           = args.focus || {}
		let parent			= args.parent || 0

		// try recover local anchor

		focus.anchor = focus.anchorUID ? frame.getAnchor(focus.anchorUID) : 0

		// try recover a fresh local arkit transform, xyz position and orientation

		if(focus.anchor) {

			focus.offset = new XRAnchorOffset(focus.anchorUID)
			focus.transform = focus.offset.getOffsetTransform(focus.anchor.coordinateSystem)

			let m = new THREE.Matrix4()
			let s = new THREE.Vector3()
			let xyz = new THREE.Vector3()
			let q = new THREE.Quaternion()
			m.fromArray(focus.transform)
			m.decompose(xyz,q,s)
			focus.quaternion = q
			focus.xyz = xyz

			// try recover cartesian facts for local objects that are not gps anchors

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

				// also back compute the GPS because the network uses it

				let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(focus.cartesian)
				focus.gps = { latitude: Cesium.Math.toDegrees(carto.latitude), longitude: Cesium.Math.toDegrees(carto.longitude), altitude: 0}
			}

			// try recover local facts fixed and inverse for convenience (for both gps and non gps)

			if(focus.cartesian) {
				focus.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(focus.cartesian)
				focus.inverse = Cesium.Matrix4.inverseTransformation(focus.fixed, new Cesium.Matrix4())
			}

			// effectively completely relocalized at this point

			focus.relocalized = 1
		}

		// try recover transform for non local non gps objects that do have cartesian details

		if(focus.cartesian && !focus.anchor && focus.kind != "gps" && parent && parent.inverse) {

			if(!parent.xyz) {
				// weird
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

			// TODO orientation isn't being transformed by latitude and longitude sadly (fix later)

			// generate transform

			let m = new THREE.Matrix4()
			let s = new THREE.Vector3(1,1,1)
			let q = focus.quaternion ? new THREE.Quaternion(
				parseFloat(focus.quaternion.x),
				parseFloat(focus.quaternion.y),
				parseFloat(focus.quaternion.z),
				parseFloat(focus.quaternion.w) ) : new THREE.Quaternion()
			m.fromArray(focus.transform)
			m.compose(focus.xyz,q,s)
			focus.transform = m

			// mark as relocalized

			focus.relocalized = 1
		}
	}
}

