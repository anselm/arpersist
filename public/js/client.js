
class ARAnchorGPSTest extends XRExampleBase {

	constructor(args,params) {

		super(args, false)

		// a couple of hacks - a zone concept to separate traffic out, and a participant id concept - improve later
		this.zone = params.zone
		this.participant = params.participant
		if(!this.participant) this.participant = "noname" + Math.random()

		// begin capturing gps information
		this.gpsInitialize();

		// begin a system for managing a concept of persistent entities / features / objects
		this.entityInitialize();

		// user input handlers
	    document.getElementById("ux_save").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_load").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_wipe").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_make").onclick = (ev) => { this.command = ev.srcElement.id }

		// tap to indicate that user wants to interact (make an object etc) - disabled for now - will reactivate with edit/manipulate operations
		// this._tapEventData = null 
		//	this.el.addEventListener('touchstart', this._onTouchStart.bind(this), false)

		// begin a timer to try place the player themselves and establish a world anchor in a few seconds from now
		setTimeout( this.entityParticipantUpdate.bind(this) }, 5000 )
	}

	/*
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
		console.log(ev.touches)
	}
	*/

	///////////////////////////////////////////////
	// scene geometry and update callback
	///////////////////////////////////////////////

	initializeScene() {
		// called from parent scope - draw some visual cues

		let box = new THREE.Mesh(
			new THREE.BoxBufferGeometry(0.1, 0.1, 0.1),
			new THREE.MeshPhongMaterial({ color: '#DDFFDD' })
		)
		box.position.set(0, 0.05, 0)
        this.floorGroup.add( this.AxesHelper( 0.2 ) );
		this.floorGroup.add(box)

		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)
	}

	updateScene(frame) {

		// Called once per frame, before render, to give the app a chance to update this.scene

		// resolve frame related chores
		let command = this.command
		this.command = 0
		switch(command) {
			case "ux_save": this.mapSave(this.zone); break
			case "ux_load": this.mapLoad(this.zone); break
			case "ux_wipe": console.log("wipe server for this room todo"); break
			case "ux_make": this.entityAdd(frame); break
			default: break
		}

		// resolve changes in arkit frame of reference
		this.entityUpdateAll(frame)
	}

	AxesHelper( size ) {
		size = size || 1;
			var vertices = [
			0, 0, 0,	size, 0, 0,
			0, 0, 0,	0, size, 0,
			0, 0, 0,	0, 0, size
		];
			var colors = [
			1, 0, 0,	1, 0.6, 0,
			0, 1, 0,	0.6, 1, 0,
			0, 0, 1,	0, 0.6, 1
		];
		var geometry = new THREE.BufferGeometry();
		geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
		var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
		return new THREE.LineSegments(geometry, material);
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

		if ("geolocation" in navigator) {
			try {
				navigator.geolocation.watchPosition((position) => {
					this.gps = position;
				});
			} catch(e) {
				console.error(e)
			}
		}
	}

	gpsGet() {
return { latitude: 0, longitude: 0, altitude: 0 } // localhost debugging

		let scratch = this.gps;
		this.gps = 0;
		return scratch;
	}

	//////////////////////////////////////////////////
	// 3d reconstruction maps
	/////////////////////////////////////////////////

	mapCallbackAnchor(event) {
		let anchor = event.detail
		console.log("got an event")
		console.log(event)
		if (anchor.uid.startsWith('anchor-')) {
			// it's an anchor we created last time
			//this.addAnchoredNode(new XRAnchorOffset(anchor.uid), this._createSceneGraphNode())
			console.log("Handle World Anchor callback : saw an anchor again named " + anchor.uid )
		}
	}

	mapLoad(zone="azurevidian") {

		//	const worldCoordinates = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)

		if (!this.mapListenerSetupLatch) {
			console.log("latched listener")
			this.mapListenerSetupLatch = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR, this.mapCallbackAnchor.bind(this))
		}

		fetch("uploads/"+zone).then((response) => { return response.text() }).then( (data) => {
			console.log("got a file " + zone)
			this.session.setWorldMap({worldMap:data}).then(results => {
				console.log("results status from loading is good")
			})
		})
	}

	mapSave(zone="azurevidian") {

		this.session.getWorldMap().then(results => {
			console.log(results)
			const data = new FormData()
			let blob = new Blob([results.worldMap], { type: "text/html"} );
			data.append('blob',blob)
			data.append('zone',zone)
			fetch('/api/map/save', { method: 'POST', body: data }).then(r => r.json()).then(status => {
				console.log("results status from saving a map was")
				console.log(status)
			})
		})

		/* async way
		(async () => {
		  const rawResponse = await fetch('/api/save', {
		    method: 'POST',
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    body: JSON.stringify(hash)
		  });
		  const content = await rawResponse.json();

		  console.log(content);
		})();
		*/

		/*
		// as a form field for multipart
		var data = new FormData();
		data.append( "json", JSON.stringify(json) );
		fetch("/api/save", {
		    method: "POST",
		    body: data
		})
		.then(function(res){ return res.json(); })
		.then(function(data){ alert( JSON.stringify( data ) ) })
		*/

		/*

		let data = JSON.stringify(hash)
		console.log("saving")
		console.log(data)
		postDataHelper('/api/map/save',data).then(result => {
			console.log("got result")
			console.log(result)
			if(!result || !result.uuid) {
				console.error("entityBroadcast: failed to save to server")
			} else {
				// could save locally if network returns it to us ( we don't need to do this here but can wait for busy poll for now )
				// this.entities[result.uuid] = result
			}
		})
		*/

	}

	//////////////////////////////////////////////////////////
	// entities - managing local cache and network and state
	//////////////////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.socket = io()
		this.socket.on('publish', this.entityCRUD.bind(this) )
	}

	entityPublish(entity) {
		if(this.socket) {
			let blob = {
				uuid:entity.anchorUID,
				style:entity.style,
				cartesian:entity.cartesian,
				zone:this.zone
			}
			this.socket.emit('publish',blob);
			console.log("entityAdd: published to network")
			console.log(blob)
		}
	}

	entityCRUD(entity) {
		// TODO handle local cache CRUD
		console.log("entitySave: got entity to CRUD locally")
		console.log(entity)
		if(!entity.uuid) {
			console.error("Invalid entity no uuid")
			return 0
		}
		let previous = this.entities[entity.uuid]
		if(previous) {
			// TODO must merge carefully
			previous.clean = 0
			return previous
		}
		this.entities[entity.uuid] = entity
		entity.clean = 0
		return entity
	}

	entityDiscard(entity) {
		// discard locally
		// TODO delete anchor
	}

	entityClone(entity) {
		// this is a hack
		// as a test the object can be made immediately - the approach is is to move it out of the colliding uuid
		// the network will return a second copy of the same object in a moment
		// (in the entitiesupdate this object will get a visible scene graph node if it doesn't have one yet)
		entity.uuid = this.entitycounter = this.entityCounter ? this.entityCounter + 1 : 1
		entity.style = "sphere"
		this.entityCRUD(entity)
	}

	entityUpdateAll(frame) {
		for(let uuid in this.entities) {
			this.entityUpdate(frame, this.entities[uuid])
		}
	}

	entityUpdate(frame,entity) {

		if(!entity.clean) {
			this.entityToLocal(frame,entity)

			// TODO update anchor also? because it could have moved?
			// TODO examine this overall
		}

		// add a visual scene node if needed and it doesn't have one
		if(!entity.node) {
			console.log("entityUpdate: adding entity to display")
			entity.node = this.createSceneGraphNode(entity.style)
			this.scene.add(entity.node)
		}

		// constantly pin entity to anchor
		// TODO it's arguable that remote entities shouldn't be pinned to the local reference frame - either recompute above or don't attach to an anchor?
		if(entity.anchor) {
			entity.node.matrixAutoUpdate = false
			entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem))
			entity.node.updateMatrixWorld(true)
		}
	}

	entityAnchorUpdate(frame,entity={},projection=[0,0,0],gps=0) {

		////////////////////////

		if(entity.anchor) {
			frame.removeAnchor(entity.anchor);
		}

		// TODO I'd like the actual anchorUID to be what I choose - how can that be set?
		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		entity.gps = gps
		if(gps)entity.cartesian = Cesium.Cartesian3.fromDegrees(gps.longitude, gps.latitude, gps.altitude )
		entity.worldMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(entity.cartesian)
		entity.anchorUID = frame.addAnchor(headCoordinateSystem,projection)
		entity.anchorOffset = new XRAnchorOffset(entity.anchorUID)
		entity.anchor = frame.getAnchor(entity.anchorOffset.anchorUID)

		return		// accepts x,y screen space coordinates and z as arkit camera pose relative projection forward of camera
		// TODO currenty x,y are ignored - but the idea is that entities could be manufactured at a projection through screen space - ray intersecting nearest plane

	}

	entityToECEF(entity) {

		// get arkit relative transform for world anchor
		let wt = this.entityWorld.anchorOffset.getOffsetTransform(this.entityWorld.anchor.coordinateSystem)
		console.log("entityAdd: we believe the arkit pose for the entityWorld is at: ")
		console.log(wt)

		// inverse
		//		let wti = MatrixMath.mat4_generateIdentity()
		//		MatrixMath.mat4_invert(wt,wit)


		// arkit world coordinates
		let t = entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem)
		console.log("entityAdd: entity in arkit freame of reference is at : ")
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

		// arkit created features are in EUS - so this is relative meters in ECEF cartesian coordinates already (relative to from entityWorld)
		let v = { x: t[12]-wt[12], y: t[13]-wt[13], z: t[14]-wt[14] }
		console.log("entity relative to world anchor in arkit is at ")
		console.log(v)

		// But ARKit has axes swapped relative to ECEF - swap those and also take the opportunity to express the relative vector as a cartesian vector
		let v2 = new Cesium.Cartesian3(v.x,-v.z,v.y)
		console.log("flipped axes")
		console.log(v2)

		// Then transform to actual ECEF absolutely - as a vector from this longitude, latitude on Earth at some orientation
		entity.cartesian = Cesium.Matrix4.multiplyByPoint( entityWorld.worldMatrix, v2, new Cesium.Cartesian3() )
		console.log("absolutely in ecef at")
		console.log(entity.cartesian)

		// TODO transform the local orientation matrix from arkit coordinates to ECEF - so transform to entityWorld and then transform to ECEF ...

		if(true) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(entity.cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			console.log("entityAdd: Anchor is at lon="+entityWorld.gps.longitude+" lat="+entityWorld.gps.latitude );
			console.log("entityAdd: Entity is at lon"+lon + " lat"+lat)
		}		
	}

	entityToLocal(frame,entity) {

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		let trackerCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)

		// TODO delete anchor

		// get the entity ECEF cartesian coordinates
		let v = new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z)
		console.log("entityUpdate: new entity is at cartesian : ");
		console.log(v)

		// get a matrix that can transform from ECEF to ARkit
		let m = Cesium.Transforms.eastNorthUpToFixedFrame(this.entityWorld.cartesian)
		let inv = Cesium.Matrix4.inverseTransformation(m, new Cesium.Matrix4())

		// transform the vector from ECEF back to current ARKit
		let v2 = Cesium.Matrix4.multiplyByPoint(inv, v, new Cesium.Cartesian3());
		console.log("entityUpdate: relatively locally at : ")
		console.log(v2)

		// fix up axes for arkit space - and re-add world
		// TODO should transform instead not just add
		let v3 = {
			x:    v2.x + this.entityWorld.trans[12],
			y:    v2.z + this.entityWorld.trans[13],
			z:  -(v2.y + this.entityWorld.trans[14]),
		}
		console.log("entityUpdate: entity thinks it has arkit pose : ")
		console.log(v3)

		entity.anchorUID = frame.addAnchor(trackerCoordinateSystem, [v3.x, v3.y, v3.z])
		entity.anchorOffset = new XRAnchorOffset(entity.anchorUID)
		entity.anchor = frame.getAnchor(entity.anchorOffset.anchorUID)		
	}

	entityWorldUpdate(frame) {

		// right now just fetches one once only
		// call this in order to get a world anchor - ideally not all the time and ideally after the system has stabilized
		// A 'world anchor' is an anchor with both a local coordinate position and a gps position
		// TODO some kind of better strategy should go here as to how frequently to update the world anchor...

		// for now just return any valid entityWorld I ever got - never try get it again - arguably this could be refetched if a nice gps reading flys past
		if(this.entityWorld) {
			return this.entityWorld;
		}

		// given a frame pose attempt to associate this with an anchor to bind an arkit pose to a gps coordinate
		let gps = this.gpsGet();
		if(!gps) {
			return this.entityWorld;
		}

		console.log("entityWorldUpdate: has a fresh GPS");
		console.log(gps);

		// make a special world anchor in darkness to bind them
		let entity = this.entityWorld = {
			uuid:"world",
			style: "cylinder"
		}

		// anchor it in arkit nomenclature
		this.entityAnchorUpdate(frame,entity,[0,0,0],gps)

		// store it locally right now - don't network it
		this.entityCRUD(entity)

		return entity;
	}

	entityParticipantUpdate(frame) {

		// get a special gps associated anchor or fail - this will be used as a starting point for all subsequent objects
		if(!this.entityWorldUpdate(frame)) {
			console.error("entityAdd: No world anchor (camera pose + gps) yet");
			// TODO could provide better messaging such as on screen pop ups to be more helpful for end user
			return;
		}

		let entity = this.entityParticipant
		if(!entity) {
			entity = this.entityParticipant = {
				uuid:this.participant,
				style: "cylinder"
			}
		}

		// update the pose
		this.entityAnchorUpdate(frame,entity)

		// update ecef
		this.entityToECEF(frame,entity)

		// publish to network... 
		this.entityPublish(entity)

		// also save it locally ... anyway even though network will send us a copy
		this.entityCRUD(entity)
	}

	entityAdd(frame,projection=[0,0,0]) {

		// get a special gps associated anchor or fail - this will be used as a starting point for all subsequent objects
		if(!this.entityWorldUpdate(frame)) {
			console.error("entityAdd: No world anchor (camera pose + gps) yet");
			// TODO could provide better messaging such as on screen pop ups to be more helpful for end user
			return;
		}

		// a fresh entity
		let entity = {
			uuid: 0,
			style: "box"
		}

		// grant entity an anchor based on current camera pose and a projection
		this.entityAnchorUpdate(frame,entity,projection,0)

		// transform to ecef explicitly
		this.entityToECEF(entity)

		// publish an extract of the entity to the network
		this.entityPublish(entity)

		// throw away local copy (wait for network confirmation)
		// this.entityDiscard(entity)

		// debug - clone an entity to the local cache not to network
		this.entityClone(entity)
	}

	/*

	entityBusyPoll() {

		function postDataHelper(url,data) {
		    return fetch(url, {
		        method: "POST",
		        mode: "cors", // no-cors, cors, *same-origin
		        cache: "no-cache",
		        credentials: "same-origin", // include, same-origin, *omit
		        headers: { "Content-Type": "application/json; charset=utf-8", },
		        referrer: "no-referrer", // no-referrer, *client
		        body: data,
		    }).then(response => response.json())
		}

		var d = new Date()
		var n = d.getTime()
		console.log("Busy polling server at time " + n )
		let scope = this
		let data = JSON.stringify({time:n})
		postDataHelper('/api/entity/sync',data).then(results => {
			for(let uuid in results) {
				let entity = results[uuid]
				if(entity.uuid && !scope.entities[entity.uuid]) {
					scope.entities[entity.uuid] = entity
				}
			}
			setTimeout( function() { scope.entityBusyPoll() },1000)
		})
	}

	*/

}

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.myapp = new ARAnchorGPSTest(document.getElementById('target'),getUrlParams())
	}, 1000)
})


