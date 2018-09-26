
function postDataHelper(url,data) {
    return fetch(url, {
        method: "POST",
        mode: "cors", // no-cors, cors, *same-origin
        cache: "no-cache",
        credentials: "same-origin", // include, same-origin, *omit
        headers: { "Content-Type": "application/json; charset=utf-8", },
        referrer: "no-referrer", // no-referrer, *client
        body: JSON.stringify(data),
    }).then(response => response.json())
}



class ARAnchorGPSTest extends XRExampleBase {

	constructor(args) {

		super(args, false)

		// begin capturing gps information
		this.gpsInitialize();

		// begin a system for managing a concept of persistent entities / features / objects
		this.entityInitialize();

		// tap to indicate that user wants to interact (make an object etc)
		this._tapEventData = null 
		this.el.addEventListener('touchstart', this._onTouchStart.bind(this), false)

	}

	_onTouchStart(ev){
		// Save screen taps as normalized coordinates for use in this.updateScene
		if (!ev.touches || ev.touches.length === 0) {
			console.error('No touches on touch event', ev)
			return
		}
		//save screen coordinates normalized to -1..1 (0,0 is at center and 1,1 is at top right)
		this._tapEventData = [
			ev.touches[0].clientX / window.innerWidth,
			ev.touches[0].clientY / window.innerHeight
		]
	}

	///////////////////////////////////////////////
	// scene support
	///////////////////////////////////////////////

	initializeScene() {
		// Called during construction by parent scope
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)
	}

	// Called once per frame, before render, to give the app a chance to update this.scene
	updateScene(frame) {

		// If we have tap data, attempt a hit test for a surface
		if(this._tapEventData !== null){
			const x = this._tapEventData[0]
			const y = this._tapEventData[1]
			this._tapEventData = null
			this.entitiesAdd(frame,x,y)
		}

		// give entity system a chance to finalize network traffic - will finalize addition
		this.entitiesUpdate(frame)
	}

	createSceneGraphNode(args = 0) {
		let geometry = 0
		switch(args) {
			default: geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
			case "cylinder": geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.1, 32 ); break;
			case "sphere": geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); break;
			case "box": geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;

		}
		let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
		return new THREE.Mesh(geometry, material)
	}

	///////////////////////////////////////////////
	// gps glue
	///////////////////////////////////////////////

	gpsInitialize() {
		this.gps = 0;
		navigator.geolocation.watchPosition((position) => {
			this.gps = position;
		});
	}

	gpsGet() {
		return { latitude: 0, longitude: 0, altitude: 0 }
		let scratch = this.gps;
		this.gps = 0;
		return scratch;
	}

	///////////////////////////////////////////////
	// entity concept of server managed entities
	///////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.entityBusyPoll()
	}

	entityBusyPoll() {
		var d = new Date()
		var n = d.getTime()
		console.log("Busy polling server at time " + n )
		let scope = this
		postDataHelper('/api/entity/sync',{time:n}).then(results => {
			for(let uuid in results) {
				let entity = results[uuid]
				if(entity.uuid && !scope.entities[entity.uuid]) {
					scope.entities[entity.uuid] = entity
				}
			}
			setTimeout( function() { scope.entityBusyPoll() },1000)
		})
	}

	entityUpdate(frame,entity) {

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		let trackerCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)

		if(!entity.node && entity.cartesian && this.worldAnchor && entity.uuid != "world") {

			// get the entity ECEF cartesian coordinates
			let v = new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z)
			console.log("absolutely from ");
			console.log(v)

			// get a matrix that can transform from ECEF to ARkit
			let m = Cesium.Transforms.eastNorthUpToFixedFrame(this.worldAnchor.cartesian)
			let inv = Cesium.Matrix4.inverseTransformation(m, new Cesium.Matrix4())

			// transform the vector from ECEF back to current ARKit
			let v2 = Cesium.Matrix4.multiplyByPoint(inv, v, new Cesium.Cartesian3());
			console.log("relatively locally at")
			console.log(v2)

			// fix up axes for arkit space - and re-add world
			let v3 = {
				x:    v2.x + this.worldAnchor.trans[12],
				y:    v2.z + this.worldAnchor.trans[13],
				z:  -(v2.y + this.worldAnchor.trans[14]),
			}
			console.log("entityUpdate thinks it is finally at")
			console.log(v3)

			// one way to place an entity is to give it an anchor
			entity.anchorUID = frame.addAnchor(trackerCoordinateSystem, [v3.x, v3.y, v3.z])
			entity.anchorOffset = new XRAnchorOffset(entity.anchorUID)
			entity.anchor = frame.getAnchor(entity.anchorOffset.anchorUID)

		}

		// add a node if there is sufficient data
		if(!entity.node) {
			console.log("adding entity to display using trans")
			entity.node = this.createSceneGraphNode(entity.style)
			this.scene.add(entity.node)
		}

		// if entity has an anchor keep it constantly pinned to anchor
		if(entity.anchor) {
			entity.node.matrixAutoUpdate = false
			entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem))
			entity.node.updateMatrixWorld(true)
		}

		// a hack - fallback to use trans itself
		if(!entity.anchor && entity.trans && entity.node) {
			entity.node.matrixAutoUpdate = false
			entity.node.matrix.fromArray(entity.trans)
			entity.node.updateMatrixWorld(true)
		}

	}

	entityWorldAnchor(frame) {

		// right now just fetches one once only
		// call this in order to get a world anchor - ideally not all the time and ideally after the system has stabilized
		// A 'world anchor' is an anchor with both a local coordinate position and a gps position
		// TODO some kind of better strategy should go here as to how frequently to update the world anchor...

		// for now fetch once only
		if(this.worldAnchor) {
			return this.worldAnchor;
		}

		// given a frame pose attempt to associate this with an anchor to bind an arkit pose to a gps coordinate

		let gps = this.gpsGet();

		if(!gps) {
			return this.worldAnchor;
		}

		console.log("worldAnchorGet: has a fresh GPS");
		console.log(gps);

		// world anchor could be periodically updated - but for now just remove and re-added the fresh one
		if(this.worldAnchor && this.worldAnchor.anchor) {
			frame.removeAnchor(this.worldAnchor.anchor);
		}

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		// add a special world anchor which ostensibly binds the virtual to the real
		let entity = {}
		entity.uuid = "world"
		entity.style = "cylinder"
		entity.gps = gps
		entity.cartesian = Cesium.Cartesian3.fromDegrees(gps.longitude, gps.latitude, gps.altitude )
		entity.worldMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(entity.cartesian)
		entity.anchorUID = frame.addAnchor(headCoordinateSystem, [0,0,0])
		entity.anchorOffset = new XRAnchorOffset(entity.anchorUID)
		entity.anchor = frame.getAnchor(entity.anchorOffset.anchorUID)
		entity.trans = entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem)
		console.log("worldAnchorGet: created new at: ");
		console.log(entity);

		// does not *have* to be tracked but it's useful to do so if we want to update and paint it
		this.entities[entity.uuid] = entity;

		// remember
		this.worldAnchor = entity;

		return this.worldAnchor;
	}

	entitiesUpdate(frame) {
		for(let uuid in this.entities) {
			this.entityUpdate(frame, this.entities[uuid])
		}
	}

	entitiesAdd(frame,x,y) {

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		// get a special gps associated anchor or fail - this will be used as a starting point for all subsequent objects
		let worldAnchor = this.entityWorldAnchor(frame);
		if(!worldAnchor) {
			console.error("entityAdd: No camera pose + gps yet");
			// TODO be more helpful for end user
			return;
		}

		////////////////////////

		// paranoia - reget the matrix just in case arkit updated it
		this.worldAnchor.trans = this.worldAnchor.anchorOffset.getOffsetTransform(this.worldAnchor.anchor.coordinateSystem)

		// convenience handle
		let wt = worldAnchor.trans
		console.log("world is at ")
		console.log(wt)

		// inverse
//		let wti = MatrixMath.mat4_generateIdentity()
//		MatrixMath.mat4_invert(wt,wit)

		////////////////////////

		let entity = {}
		entity.uuid = 0
		entity.style = "box"
		entity.cartesian = 0
		entity.anchorUID = frame.addAnchor(headCoordinateSystem, [0,0,-1])
		entity.anchorOffset = new XRAnchorOffset(entity.anchorUID)
		entity.anchor = frame.getAnchor(entity.anchorOffset.anchorUID)

		// arkit world coordinates
		let t = entity.trans = entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem)
		console.log("entity in arkit is at")
		console.log(t)

		// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
		// ARKit aligns with the world. If you are anywhere on earth facing north then:
		//		+ x+ values always point towards larger longitudes (or always to the right)
		//		+ y+ values point towards space
		//		+ z+ values point *south* towards smaller latitudes (which is slightly unexpected)

		// https://en.wikipedia.org/wiki/ECEF
		// If you are in box defined by an arkit local coordinate system at any point on earth facing north then:
		//		+ x+ values point towards the right or increasing longitude
		//		+ y+ values point towards space (away from earth center)
		//		+ z+ values point south (or decreasing longitude)

		// features are arranged in EUS so this is relative meters in (almost) ECEF cartesian coordinates effectively from worldAnchor
		let v = { x: t[12]-wt[12], y: t[13]-wt[13], z: t[14]-wt[14] }
		console.log("entity relative to world anchor in arkit is at ")
		console.log(v)

		// ARKit has axes organized differently than ECEF - also take the opportunity to express the vector as a cartesian vector
		let v2 = new Cesium.Cartesian3(v.x,-v.z,v.y)
		console.log("flipped axes")
		console.log(v2)

		// Then transform to actual ECEF absolutely - as a vector from this longitude, latitude on Earth at some orientation
		entity.cartesian = Cesium.Matrix4.multiplyByPoint( worldAnchor.worldMatrix, v2, new Cesium.Cartesian3() )
		console.log("absolutely in ecef at")
		console.log(entity.cartesian)

		// TODO It would be nice to transform the entire matrix to represent the rotation as well

		if(true) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(entity.cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			console.log("entityAdd: Anchor is at lon="+worldAnchor.gps.longitude+" lat="+worldAnchor.gps.latitude );
			console.log("entityAdd: Entity is at lon"+lon + " lat"+lat)
		}

		// publish only a few properties
		if(true) {
			this.entityBroadcast({
				style:entity.style,
				trans:entity.trans,
				cartesian:entity.cartesian
			})
		}

		// hack - force a second copy of the entity here right now for local immediate feedback
		if(false) {
			if(!this.entitycounter) this.entitycounter = 1; else this.entitycounter++;
			entity.style = "sphere"
			entity.uuid = this.entitycounter
			this.entities[entity.uuid] = entity
		}

	}

	entityBroadcast(entity) {
		postDataHelper('/api/entity/save',entity).then(result => {
			if(!result || !result.uuid) {
				console.error("entityBroadcast: failed to save to server")
			} else {
				// could save locally if network returns it to us ( we don't need to do this here but can wait for busy poll for now )
				// this.entities[result.uuid] = result
			}
		})
	}


}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		try {
			window.pageApp = new ARAnchorGPSTest(document.getElementById('target'))
		} catch(e) {
			console.error('page error', e)
		}
	}, 1000)
})
