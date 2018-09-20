
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

	constructor(domElement) {

		super(domElement, false)

		// begin capturing gps information
		this.gpsInitialize();

		// begin a system for managing a concept of persistent entities / features / objects
		this.entityInitialize();

		// tap to stick something to wall
		this._tapEventData = null 
		this.el.addEventListener('touchstart', this._onTouchStart.bind(this), false)

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
			this.entityAdd(frame,x,y)
		}

		// give entity system a chance to finalize network traffic - will finalize addition
		this.entityUpdate(frame)
	}

	createSceneGraphNode() {
		// helper to make geometry
		let geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1)
		let material = new THREE.MeshPhongMaterial({ color: '#FF9999' })
		return new THREE.Mesh(geometry, material)
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
	// gps glue
	///////////////////////////////////////////////

	gpsInitialize() {
		this.gps = 0;
		navigator.geolocation.watchPosition((position) => {
			this.gps = position;
		});
	}

	gpsGet() {
		let scratch = this.gps;
		this.gps = 0;
		return scratch;
	}

	/////////////////////////////////////////////////////////////////////
	// world or geographic anchor concept
	/////////////////////////////////////////////////////////////////////

	worldAnchorGet(frame,headCoordinateSystem) {

		// right now just fetches one once only

		// call this in order to get a world anchor - ideally not all the time and ideally after the system has stabilized

		// A 'world anchor' is an anchor with both a local coordinate position and a gps position

		// TODO some kind of better strategy should go here as to how frequently to update the world anchor...

		if(!this.worldAnchor) {

			// given a frame pose attempt to associate this with an anchor to bind an arkit pose to a gps coordinate

			let gps = this.gpsGet();

			if(gps) {

				console.log("worldAnchorGet: has a fresh GPS");
				console.log(gps);

				if(this.worldAnchor && this.worldAnchor.anchor) {
					// for now just remove it rather than having a queue
					frame.removeAnchor(this.worldAnchor.anchor);
				}

				// add a new anchor which ostensibly binds the virtual to the real
				this.worldAnchor = {}
				this.worldAnchor.anchorUID = frame.addAnchor(headCoordinateSystem, [0,0,0])
				this.worldAnchor.cartesian = Cesium.Cartesian3.fromDegrees(gps.longitude, gps.latitude, gps.elevation ); //,  Ellipsoid.WGS84 );
			}

		}

		return this.worldAnchor;
	}

	///////////////////////////////////////////////
	// entity concept of server managed entities
	///////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.entityBusyPoll()
	}

	entityBusyPoll() {

		// busy poll server to retrieve any server state

		var d = new Date()
		var n = d.getTime()
		console.log("Busy polling server at time " + n )

		postDataHelper('/api/entity/sync',{time:n}).then(results => {

			for(let uuid in results) {
				let entity = results[uuid]
				if(entity.uuid && !this.entities[entity.uuid]) {
					this.entities[entity.uuid] = entity
					console.log("Added entity to local set")
					console.log(entity)
				}
			}

			setTimeout(this.entityBusyPoll,1000)

		})
	}

	entityUpdate(frame) {

		// every frame visit our entities and do anything we want

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		// get a gps associated anchor or fail
		let worldAnchor = this.worldAnchorGet(frame,headCoordinateSystem);
		if(!worldAnchor) {
			console.error("entityAdd: No camera pose + gps yet");
			// TODO be more helpful for end user
			return;
		}

		for(let uuid in this.entities) {
			if(!uuid) continue;
			let entity = this.entities[uuid]

			if(!entity.node) {

				// entity does not have a scene representation - add one
				entity.node = this.createSceneGraphNode()

				// get absolute position
				let v = new Cesium.Cartesian3(entity.x,entity.y,entity.z)

				// get world transform for where we are now
				let m = Cesium.Transforms.eastNorthUpToFixedFrame(worldAnchor.cartesian)
				let inv = Cesium.Matrix4.inverseTransformation(m, new Cesium.Matrix4())

				// inverse transform the vector relative to us
				let xyz = Cesium.Matrix4.multiplyByPoint(inv, v, new Cesium.Cartesian3());

				entity.anchorUID = frame.addAnchor(headCoordinateSystem, [xyz.x, xyz.y, xyz.z])
				this.addAnchoredNode(new XRAnchorOffset(entity.anchorUID), entity.node)
 
			}

		}
	}

	entityAdd(frame,x,y) {

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		// get a gps associated anchor or fail
		let worldAnchor = this.worldAnchorGet(frame,headCoordinateSystem);
		if(!worldAnchor) {
			console.error("entityAdd: No camera pose + gps yet");
			// TODO be more helpful for end user
			return;
		}

		// Get an anchoroffset object (has an anchor by uid) by attempting a hit test using the normalized screen coordinates
		frame.findAnchor(x, y).then(anchorOffset => {
			if(anchorOffset === null){
				console.log('miss')
				return
			}
			console.log('hit')
			console.log(anchorOffset)

			// where is this in local coordinates? (in 3d in arkit local frame of reference)
			let xyz = anchorOffset.getPosition()

			// where is world anchor in local coordinates? (in 3d in arkit local frame of reference)
			let worldAnchorOffset = new XRAnchorOffset(worldAnchor.anchorUID)
			let wxyz = worldAnchorOffset.getPosition()

			// get a cartesian representation of the local vector displacement relative to world anchor (in meters???)

			xyz[0] = xyz[0] - worldAnchor.xyz[0]
			xyz[1] = xyz[1] - worldAnchor.xyz[1]
			xyz[2] = xyz[2] - worldAnchor.xyz[2]

			// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
			// The y-axis matches the direction of gravity as detected by the device's motion sensing hardware; that is,
			// the vector (0,-1,0) points downward.
			// The x- and z-axes match the longitude and latitude directions as measured by Location Services.
			// The vector (0,0,-1) points to true north and the vector (-1,0,0) points west.
			// (That is, the positive x-, y-, and z-axes point east, up, and south, respectively.)

			let v = new Cesium.Cartesian3(xyz[0],xyz[2],xyz[1])

			// convert the world anchor cartesian coordinates to a 3d transform in space
			let m = Cesium.Transforms.eastNorthUpToFixedFrame(worldAnchor.cartesian)

			// transform the vector to an absolute position on earth (presumably this is meters??)
			let result = Cesium.Matrix4.multiplyByPoint(m, v, new Cesium.Cartesian3());

			// could go back to degrees but why bother
			//var carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(result);
			// var lon = Cesium.Math.toDegrees(carto.longitude); 
			// var lat = Cesium.Math.toDegrees(carto.latitude); 

			let entity = { x: result.x , y: result.y , z: result.z }
			this.entityBroadcast(entity)

		}).catch(err => {
			console.error('Error in hit test', err)
		})

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


// let handler = Cesium.Transforms.localFrameToFixedFrameGenerator( "east", "north")



console.log(cartesian)
console.log(matrix)

console.log("lon="+lon + " " + " lat=" + lat)



//var position = Cesium.Cartesian3.fromDegrees(-106.690647, 36.806761, 0);
//Cesium.Cartesian3.add(position, offset, position);
//var p = new Cesium.Cartesian3(100, 0, 0);
//console.log(result)



// 
// TODO - multiply my vector above by the transform - getting a new point in space
// 		- convert this point in 3 space back to cartesian

// 
//var pos = Cesium.Cartesian3.fromDegrees(61.296382224724795,35.628536117000692); 
//var carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);     
//var lon = Cesium.Math.toDegrees(carto.longitude); 
//var lat = Cesium.Math.toDegrees(carto.latitude); 

// ok, given a point on a unit sphere - representing effectively some rotation
// rotate the vector by an imaginary x axis by its latitude
// rotate the vector by an imaginary rotation axis
// now i have a point in space - convert that point back to an xyz

// rotate a vector by the spin axis
// then by the x axis



