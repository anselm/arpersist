

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXPersistComponent
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class UXPersistComponent extends XRAnchorCartography {

	constructor(element,zone,party) {

        super({
            domElement:element,
        	createVirtualReality:false,
        	shouldStartPresenting:true,
        	useComputerVision:false,
        	worldSensing:true,
        	alignEUS:true
	        })

		// zone concept - TODO this may go away or be improved
		this.zone = zone

		// party - this may be improved - used to distinguish players right now but is not non-collidant
		this.party = party

		// tags - default props per entity
		this.tags = "aesthetic"
	}

	///////////////////////////////////////////////
	// support for externally driven command messages
	///////////////////////////////////////////////

	action(command,args) {
		// some commands can be done now... of which none exist at the moment in the current app design
		// some must be deferred
		this.command = command
	}

	async actionResolve(frame) {
		// resolve frame related chores synchronously with access to 'frame'
		// TODO I'm not happy with this approach - see EventBus above for something more flexible
		let command = this.command
		this.command = 0
		if(!command) return 0
		console.log("doing command="+command)
		switch(command) {
			case "gps": await this.entityAddGPS(frame); break
			case "make": await this.entityAddArt(frame); break
			case "move": await this.entityAddParty(frame); break
			case "save": await this.mapSave(frame); break
			default: break
		}
		return 1
	}

	///////////////////////////////////////////////
	// scene geometry and update callback helpers
	///////////////////////////////////////////////

	initializeScene() {
		this.listenerSetup = false

		// add some light
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)

		// attach something to 0,0,0 (although 0,0,0 doesn't mean a lot since arkit can update anchor positions)
        this.scene.add( this.AxesHelper( 0.2 ) );
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	async updateScene(frame) {
		await this.actionResolve(frame)
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

		// test

		if(args.startsWith("duck")) {
			let group = new THREE.Group()
			let path = "/raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
			loadGLTF(path).then(gltf => {
				group.add(gltf.scene)
			}).catch((...params) =>{
				console.error('could not load gltf', ...params)
			})
			return group
		}

		// examine the string and decide what the content is - TODO this needs a real proxy such as moz hubs

		if(args.startsWith("http")) {
			let group = new THREE.Group()
			let path = args // "/raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
			loadGLTF(path).then(gltf => {
				group.add(gltf.scene)
			}).catch((...params) =>{
				console.error('could not load gltf', ...params)
			})
			return group
		}

		switch(args) {
			default: geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
			case "cylinder": geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.1, 32 ); break;
			case "sphere":   geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); break;
			case "box":      geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
		}
		let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
		let mesh = new THREE.Mesh(geometry, material)
		return mesh
	}

	//////////////////////////////////////////////////////////
	/// entities - a wrapper for a concept of a game object
	//////////////////////////////////////////////////////////

	entityUUID(id) {
		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		return this.zone + "_" + this.party + "_" + id
	}

	entitySystemReset() {
		// local flush - not network
		this.entitySelected = 0
		if(this.entities) {
			for(let uuid in this.entities) {
				let entity = this.entities[uuid]
				if(entity.node) {
					this.scene.remove(entity.node)
					entity.node = 0
				}
				// TODO delete anchors?
			}
		}
		this.entities = {}
	}

	entityQuery(args) {
		// local query only - not network
		let results = []
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			if(args.kind && entity.kind == args.kind) results.push(entity)
			// TODO add gps filtering
		}
		return results
	}

	entityUpdateAll(frame) {
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			this.entityUpdateOne(frame,entity)
			this.entityDebugging(entity)
		}
	}

	entityUpdateOne(frame,entity) {

		// ignore maps for now
		if(entity.kind=="map") return

		// ignore things that are not gps until a entityGPS exists
		if(entity.kind != "gps" && !this.entityGPS) {
			return
		}

		// attempt to relocalize
		this.featureRelocalize(frame,entity,this.entityGPS)

		// attempt to set an entityGPS
		if(entity.kind == "gps" && entity.relocalized && !this.entityGPS) {
			this.entityGPS = entity
		}

		// update art
		this.entityArt(entity)

		// publish changes?
		if(!entity.published) {
			this.entityPublish(entity)
			entity.published = 1
		}
	}

	entityArt(entity) {

		if(!entity.pose) {
			//console.error("entityArt: no pose " + entity.uuid)
			return
		}

		// add art to entities if needed
		if(!entity.node) {
			entity.node = this.createSceneGraphNode(entity.art)
			this.scene.add(entity.node)
		}

		// given an anchor it is possible to directly set the node from that
		//	entity.node.matrixAutoUpdate = false
		//	entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchorCoordinateSystem))
		//	entity.node.updateMatrixWorld(true)

		// update entity rendering position (every frame)
		// TODO deal with orientation
		entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)		
	}

	///
	/// Make a gps entity - at the moment multiple of these are allowed - note that this.entityGPS is not set here (since it could arrive over network)
	///

	async entityAddGPS(frame) {
		let feature = await this.featureAtGPS(frame)
		if(!feature || !feature.gps) {
			console.error("UX entityAddGPS: could not make gps anchor!")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(feature.anchorUID),
			     anchor: feature.anchor,
			  anchorUID: feature.anchorUID,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: "a gps anchor at " + feature.gps.latitude + " " + feature.gps.longitude,
			      descr: "a gps anchor at " + feature.gps.latitude + " " + feature.gps.longitude,
			       kind: "gps",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create an entity as per the users request - it is ok to make these before gps anchors show up
	///

	async entityAddArt(frame) {

		let feature = await this.featureAtIntersection(frame,0.5,0.5)
		if(!feature) {
			console.error("UX entityAddArt: anchor failed")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(feature.anchorUID),
			  anchorUID: feature.anchorUID,
			     anchor: feature.anchor,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: "art",
			      descr: "some user art",
			       kind: "content",
			        art: "box",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entitySelected = entity
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create or update a partys position
	///

	async entityAddParty(frame) {

		let feature = await this.featureAtPose(frame)
		if(!feature) {
			console.error("entityAddParty: anchor failed")
			return 0
		}
		if(this.entityParty) {
			// TODO - should I throw away the previous anchor?
			this.entityParty.anchorUID = feature.anchorUID
			this.entityParty.cartesian = 0
			this.entityParty.published = 0
			this.entityParty.dirty = 0
			return this.entityParty
		}
		let entity = this.entityParty = {
			       uuid: this.entityUUID(feature.anchorUID),
			  anchorUID: feature.anchorUID,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: this.party,
			      descr: "a representation for a person named " + this.party,
			       kind: "party",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	async mapSave(frame) {

		// a slight hack - make and fully prep a gps anchor if one is not made yet

		let entity = this.entityGPS
		if(!entity) {
			// if no gps entity was added then force add one now
			entity = await this.entityAddGPS(frame)
			if(!entity) {
				console.error("UX map save - failed to add gps entity - no gps yet?")
				return
			}
			// force promote the entity to the gps entity
			this.featureRelocalize(frame, entity)
			if(!entity.relocalized) {
				console.error("UX map save - failed to relocalize entity - which is odd")
				return
			}
			this.entityGPS = entity
		}

		// for now the entity is also written into the map - it's arguable if this is needed - will likely remove since it's mostly just extraneous TODO
		// the idea was that I could search for maps, but if I assume each map has one and only one gps anchor entity then I know what maps exist based on entities whose kind is == gps

		console.log("UX saving map")

		let results = await this.session.getWorldMap()
		if(!results) {
			console.error("UX save: this engine does not have a good map from arkit yet")
			return 0
		}
		const data = new FormData()
		// TODO - this kind of mixes concerns badly - if I pick a single anchor to associate the map with then this is not needed
		data.append('blob',        new Blob([results.worldMap], { type: "text/html"} ) )
		data.append('uuid',        "MAP" + entity.uuid )
		data.append('anchorUID',   entity.anchorUID )
		data.append('name',        entity.name)
		data.append('descr',       entity.descr)
		data.append('kind',        "map" )
		data.append('art',         entity.art )
		data.append('zone',        entity.zone )
		data.append('tags',        entity.tags )
		data.append('party',       entity.party )
		data.append('relocalized', 0)
		data.append('latitude',    entity.gps.latitude )
		data.append('longitude',   entity.gps.longitude )
		data.append('altitude',    entity.gps.altitude )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		console.log("UX mapSave: succeeded")
		return json		
	}

	async  mapLoad(filename) {

		// observe anchors showing up again - this code doesn't have to do any work since update loop will busy poll till it rebinds anchors to maps
		if (!this.listenerSetup) {
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				console.log("UX mapLoad callback - saw an anchor re-appear uid=" + event.detail.uid )
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await this.session.setWorldMap({worldMap:data})
		console.log("UX load: a fresh map file arrived " + filename )
		console.log(results)
	}


	//////////////////////////////////////////////////////////////////////////////////
	// network
	//////////////////////////////////////////////////////////////////////////////////

	async entityNetworkRestart(args) {
		// flush local entities
		this.entitySystemReset()
		if(!this.socket) {
			// TODO somehow tell network where we are!!! - it needs some way to filter traffic to us intelligently
			// start network if needed
			this.socket = io()
			this.socket.on('publish', this.entityReceive.bind(this) )
		}
		// reload or load everything (typically AFTER the network is started to avoid missing chatter)
		await this.entityLoadAll(args.gps)
	}

	///
	/// Get everything near player gps from server (typically AFTER starting to listen to ongoing chatter due to possibility of a gap)
	///

	async entityLoadAll(gps) {
		// load all the entities from the server in one go - and rebinding/gluing state back together will happen later on in update()
		if(!gps) {
			console.error("UX load: this engine needs a gps location before loading maps")
			return 0
		}
		console.log("UX load: getting all entities near latitude="+gps.latitude+" longitude="+gps.longitude)

		let response = await fetch("/api/entity/query",{ method: 'POST', body: this.zone })
		let json = await response.json()

		let count = 0
		for(let uuid in json) {
			count = count + 1
			let entity = json[uuid]
			this.entities[entity.uuid]=entity
			entity.published=1
			entity.remote=1
			entity.dirty=1
			entity.relocalized=0
			console.log("UX load: made entity kind="+entity.kind+" uuid="+entity.uuid+" anchor="+entity.anchorUID)
		}
		console.log("UX load: loading done - entities in total is " + count )
		return 1
	}

	///
	/// Receive an entity over network - may Create/Revise/Update/Delete an entity
	/// TODO deletion events
	///

	entityReceive(entity) {
		// TODO rebuild trans/rot
		entity.cartesian = entity.cartesian ? new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z) : 0
		entity.published = 1
		entity.remote = 1
		entity.dirty = 1
		entity.relocalized = 0
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			console.log("UX entityReceive: saving new remote entity")
			console.log(entity)
		} else {
			// scavenge choice morsels from the network traffic and throw network traffic away
			previous.cartesian = entity.cartesian
			previous.art = entity.art
			previous.tags = entity.tags
			previous.gps = entity.gps
			console.log("UX entityReceive: remote entity found again and updated")
			console.log(entity)
		}
	}

	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	entityPublish(entity) {

		if(!entity.cartesian) {
			console.warning("publish: entity has no cartesian " + entity.uuid )
			return
		}

		entity.published = 1

		if(!this.socket) {
			return
		}

		let blob = {
			       uuid: entity.uuid,
			  anchorUID: entity.anchorUID,
			        gps: entity.gps || 0,
			  transform: entity.transform || 0,
		    translation: entity.translation || 0,
			orientation: entity.orientation || 0,
			relocalized: entity.relocalized || 0,
			  cartesian: entity.cartesian || 0,
			       name: entity.name,
			      descr: entity.descr,
			       kind: entity.kind,
			        art: entity.art,
			       zone: entity.zone,
			       tags: entity.tags,
			      party: entity.party,
			  published: entity.published || 0,
			     remote: entity.remote || 0,
			      dirty: entity.dirty || 0
		}

		this.socket.emit('publish',blob);
	}

	/* TODO - I need some kind of admin flush mode
	async flushServer() {

		// flush server
		let response = await fetch("/api/entity/flush",{ method: 'POST', body: this.zone })
		console.log("server state after flush")
		console.log(response)

		this.flushClient()
	}
	*/

	entityDebugging(entity) {
		if(entity.debugged) return
		if(!entity.pose) return
		entity.debugged = 1
		console.log("UX *********************** entity status " + entity.anchorUID + " relocalized="+entity.relocalized)
		if(entity.pose) console.log("UX entity=" + entity.anchorUID + " is at x=" + entity.pose.x + " y="+entity.pose.y+" z="+entity.pose.z)
		if(entity.gps) console.log("UX entity=" + entity.anchorUID + " latitude="+entity.gps.latitude+" longitude="+entity.gps.longitude+" accuracy="+entity.gps.accuracy)
		if(entity.cartesian) console.log("UX entity cartesian x=" + entity.cartesian.x + " y=" + entity.cartesian.y + " z="+entity.cartesian.z)
		console.log(entity)
	}

}
