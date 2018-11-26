
// a helper to get gps location
import {XRAnchorCartography} from './XRAnchorCartography.js'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Client side entity state mirroring and networking
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class EntityManager {

	constructor(zone,party,logging=0,errors=0) {
		// zone concept - TODO this may go away or be improved
		this.zone = zone || "ZZZ"

		// party - this may be improved - used to distinguish players right now but is not non-collidant
		this.party = party || "ME"

		// some error logging support - a callback handler
		this.logging = logging || console.log
		this.errors = errors || console.error

		// tags - default props per entity
		this.tags = ""

		// manage entities
		this.entities = {}

		// allow party to update
		this.partyUpdateCounter = 0

		// set selected to nothing
		this.entitySetSelected(0)

		// trying to keep a cached copy of the temporally in the past session and frame - TEST
		this._session = 0
		this._frame = 0
	}

	entityAll(callback) {
		for(let uuid in this.entities) {
			callback(this.entities[uuid])
		}
	}

	entityQuery(args={}) {
		// local query only - not network
		let results = []
		this.entityAll((entity)=>{
			if(args.kind && entity.kind != args.kind) return
			results.push(entity)
			// TODO add gps filtering
		})
		return results
	}

	entityUpdate(session,frame) {

		this._session = session
		this._frame = frame

		// update the player every n refreshes (if a map is loaded)
		if(this.entityGPS && this.partyUpdateCounter) {
	 		this.partyUpdateCounter++
			if(this.partyUpdateCounter > 120) {
				this.entityUpdateParty(frame)
				this.partyUpdateCounter = 1
			}
		}

		// update all entities
		this.entityAll((entity)=>{
			this._entityUpdateOne(entity)
			this._entityDebugging(entity)
		})
	}

	_entityUpdateOne(entity) {

		// ignore maps completely for now
		if(entity.kind=="map") return

		// ignore things that are not gps until a entityGPS exists
		if(!this.entityGPS && entity.kind != "gps") {
			return
		}

		XRAnchorCartography.relocalize({
			session:this._session,
			frame:this._frame,
			focus:entity,
			parent:this.entityGPS
			})

		// attempt to set an entityGPS once only for now - always using first one that fits
		if(!this.entityGPS && entity && entity.kind == "gps" && entity.relocalized) {
			this.logging("*** entityGPS found " + entity.uuid)
			this.entityGPS = entity
		}

		// never publish before relocalization of the system as a whole
		if(!this.entityGPS) {
			return
		}

		// publish changes? (only entities that have a location can have their changes published)
		if(!entity.published && entity.relocalized) {
			this._entityPublish(entity)
			entity.published = 1
		}
	}

	entitySetSelected(entity) { this.entitySelected = entity }

	entityGetSelected() { return this.entitySelected }

	///
	/// Make a gps entity
	/// * at the moment multiple of these are allowed
	/// * note that this.entityGPS is not set here - this system is a lazy loader and these things can arrive over network
	///

	async entityAddGPS() {

		if(!this._session || !this._frame) return

		let entity = {
		       name: "a gps anchor!",
		      descr: "such gps anchor!",
		       kind: "gps",
		        art: "cylinder",
		       zone: this.zone,
		       tags: this.tags,
		      party: this.party,
		  cartesian: 0,
		  transform: 0,
		 quaternion: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 0
		}

		let results = await XRAnchorCartography.manufacture({
			session:this._session,
			frame:this._frame,
			focus:entity,
			get_location:true,
			get_raytest:false
			})

		if(!results) {
			this.errors("entityAddGPS: could not make gps anchor!")
			return 0
		}

		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	///
	/// Create an entity as per the users request
	/// * it is ok to make these before gps anchors show up (this system uses a lazy loading philosophy)
	///

	async entityAddArt() {

		if(!this._session || !this._frame) return

		let	entity = {
		       name: "art!",
		      descr: "user art!",
		       kind: "content",
		        art: "box",
		       zone: this.zone,
		       tags: this.tags,
		      party: this.party,
		  cartesian: 0,
		  transform: 0,
		 quaternion: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 0
		}

		let results = await XRAnchorCartography.manufacture({
			session:this._session,
			frame:this._frame,
			focus:entity,
			get_location:false,
			get_raytest:true
			})

		if(!results) {
			this.errors("entityAddArt: anchor failed")
			return 0
		}

		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	///
	/// Create or update the player
	/// 

	async entityUpdateParty() {

		if(!this._session || !this._frame) return

		let entity = this.entityParty || {
		       name: this.party || "party?!",
		      descr: "a representation of a person",
		       kind: "party",
		        art: "box",
		       zone: this.zone,
		       tags: this.tags,
		      party: this.party,
		  cartesian: 0,
		  transform: 0,
		 quaternion: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 0
		}

		let results = await XRAnchorCartography.manufacture({
			session:this._session,
			frame:this._frame,
			focus:entity,
			get_location:false,
			get_raytest:false
			})

		if(!results) {
			this.errors("entityAddParty: fail?")
			return 0
		}

		// force mark as needing republishing
		entity.published = 0

		// set as the party

		this.entityParty = entity

		this.entities[entity.uuid] = entity
		return entity
	}

	async mapSave() {

		if(!this._frame || !this._session) {
			this.errors("entity mapSave: no frame or session")
			return 0
		}
		let frame = this._frame
		let session = this._session

		// a slight hack - make and fully prep a gps anchor if one is not made yet

		let entity = this.entityGPS
		if(!entity) {
			// if no gps entity was added then force add one now
			entity = await this.entityAddGPS(frame)
			if(!entity) {
				this.errors("entity MapSave: [error] failed to add gps entity - no gps yet?")
				return 0
			}
			this.entityGPS = entity
		}

		// for now the entity is also written into the map - it's arguable if this is needed - will likely remove since it's mostly just extraneous TODO
		// the idea was that I could search for maps, but if I assume each map has one and only one gps anchor entity then I know what maps exist based on entities whose kind is == gps

		this.logging("entity mapSave: UX saving map")

		let results = 0
		try {
			results = await session.getWorldMap()
		} catch(e) {
			this.errors(e)
			return 0
		}
		if(!results) {
			this.errors("entity MapSave: [error] this engine does not have a good map from arkit yet")
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
		data.append('latitude',    entity.gps.latitude )
		data.append('longitude',   entity.gps.longitude )
		data.append('altitude',    entity.gps.altitude )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		this.logging("entity mapSave: succeeded ")

// - TEST: reload the map - REMOVE ONCE STABLE
// - I could reload and rename anchors to our anchors?
await this.mapLoad(entity.anchorUID)

		return 1
	}

	async mapLoad(filename) {

		this.logging("will try load map named " + filename )

		if(!this._frame || !this._session) {
			this.errors("entity mapLoad: no frame or session")
			return 0
		}
		let session = this._session

		// observe anchors showing up again - actual work is elsewhere in a busy poll loop - this is purely for debugging
		if (!this.listenerSetup) {
			this.listenerSetup = true
			session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				let entity = 0
				this.entityAll(e=>{ if(e.anchorUID == event.detail.uid) entity = e })
				if(entity) {
					if(!entity.anchor && entity.kind == "gps") this.logging("<font color=green>mapLoad: " + event.detail.uid + " *** ANCHOR GOOD</font>" )
				} else {
					this.errors("mapLoad: " + event.detail.uid + " *** ANCHOR BAD" )
				}
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await session.setWorldMap({worldMap:data})
		this.logging("fresh map file arrived " + filename + " results=" + results.loaded )

		return 1
	}


	//////////////////////////////////////////////////////////////////////////////////
	// network
	//////////////////////////////////////////////////////////////////////////////////

	async entityNetworkRestart() {

		// get a gps location hopefully
		this.gps = await XRAnchorCartography.gpsPromise()
		this.logging("Got GPS")
		this.logging(this.gps)

		// local flush - not network
		this.entities = {}

		// unset anything selected
		this.entitySetSelected(0)

		// open connection if none
		if(!this.socket) {
			this.socket = io()
			this.socket.on('publish', this._entityReceive.bind(this) )
			this.socket.emit('location',this.gps)
		}

		// reload or load everything (typically AFTER the network is started to avoid missing chatter) - can happen before map load - can be called over and over
		await this._entityLoadAll(this.gps)
	}

	///
	/// Get everything near player gps from server (typically AFTER starting to listen to ongoing chatter due to possibility of a gap)
	///

	async _entityLoadAll() {
		// load all the entities from the server in one go - and rebinding/gluing state back together will happen later on in update()
		if(!this.gps) {
			this.logging("entityLoadAll: this engine needs a gps location before loading maps")
			return 0
		}
		this.logging("entityLoadAll: getting all entities near latitude="+this.gps.latitude+" longitude="+this.gps.longitude)

		let response = await fetch("/api/entity/query", {
			method: 'POST',
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
    		body: JSON.stringify({gps:this.gps})
		})

		let json = await response.json()

		let count = 0
		for(let uuid in json) {
			count = count + 1
			let entity = json[uuid]
			this.entities[entity.uuid]=entity
			entity.published=1
			entity.relocalized=0
			this.logging(entity.anchorUID + " << entityLoadAll: made entity kind="+entity.kind+" uuid="+entity.uuid+" anchor="+entity.anchorUID)
		}
		this.logging("entityLoadAll: loading done - entities in total is " + count )
		return 1
	}

	///
	/// Receive an entity over network - may Create/Revise/Update/Delete an entity
	/// TODO deletion events
	///

	_entityReceive(entity) {
		entity.cartesian = new Cesium.Cartesian3(
				parseFloat(entity.cartesian.x),
				parseFloat(entity.cartesian.y),
				parseFloat(entity.cartesian.z)
				)
		entity.published = 1
		entity.relocalized = 0
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			this.logging("entityReceive: saving new remote entity " + entity.uuid)
			console.log(entity)
		} else {
			// scavenge choice morsels from the network traffic and throw network traffic away
			previous.art = entity.art
			previous.tags = entity.tags
			previous.cartesian = entity.cartesian
			previous.quaternion = entity.quaternion
			previous.scale = entity.scale
			previous.xyz = entity.xyz
			previous.gps = entity.gps
			previous.published = 1
			previous.relocalized = 0
			//this.logging("entityReceive: remote entity found again and updated " + entity.uuid)
		}
	}

	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	_entityPublish(entity) {

		if(!entity.relocalized || !entity.cartesian) {
			this.logging("entityPublish: [error] entity has no cartesian " + entity.uuid )
			return
		}

		entity.published = 1

		if(!this.socket) {
			return
		}

		let blob = {
			       uuid: entity.uuid,
			  anchorUID: entity.anchorUID,
			       name: entity.name,
			      descr: entity.descr,
			       kind: entity.kind,
			        art: entity.art,
			       zone: entity.zone,
			       tags: entity.tags,
			      party: entity.party,
			  cartesian: entity.cartesian || 0,
			  //transform: entity.transform || 0,
			 quaternion: entity.quaternion || 0,
			      scale: entity.scale || 0,
			        //xyz: entity.xyz || 0,
			        gps: entity.gps || 0,
			//relocalized: entity.relocalized ? 1 : 0,
			  //published: entity.published ? 1 : 0
		}
		this.socket.emit('publish',blob);
	}

	_entityDebugging(entity) {
		if(entity.debugged) return
		entity.debugged = 1
		this.logging("entityDebug: *** anchorUID=" + entity.anchorUID + " relocalized="+entity.relocalized + " kind="+entity.kind)
		if(entity.gps) this.logging("entity=" + entity.anchorUID + " latitude="+entity.gps.latitude+" longitude="+entity.gps.longitude+" accuracy="+entity.gps.accuracy)
		if(entity.cartesian) this.logging("entity cartesian x=" + entity.cartesian.x + " y=" + entity.cartesian.y + " z="+entity.cartesian.z)
		console.log(entity)
	}

}

