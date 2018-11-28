
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

	constructor(log=0,err=0) {

		// zone concept - TODO this may go away or be improved
		this.zone = "ZZZ"

		// party - this may be improved - used to distinguish players right now but is not non-collidant
		this.party = "ME"

		// debug output
		this.log = log || console.log
		this.err = err || console.error

		// tags - default props per entity
		this.tags = ""

		// manage entities
		this.entities = {}

		// allow party to update
		this.partyUpdateCounter = 0

		// set selected to nothing
		this.entitySetSelected(0)

		// wait for network
        return (async () => {
			await this.entityNetworkRestart()
            return this;
        })();
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

	async entityUpdateAll(session,frame) {

		// add an art?
		if(this.pleaseAddArt) {
			this.pleaseAddArt = 0
			await this._entityAddArt(session,frame)
		}

		// save?
		if(this.pleaseSaveMap) {
			this.pleaseSaveMap = 0
			await this._mapSave(session,frame)
		}

		// load?
		if(this.pleaseLoadMap) {
			let filename = this.pleaseLoadMap
			this.pleaseLoadMap = 0
			await this._mapLoad(session,frame,filename)
		}

		// update the player every n refreshes (if a map is loaded)
		if(this.entityGPS && this.partyUpdateCounter) {
	 		this.partyUpdateCounter++
			if(this.partyUpdateCounter > 120) {
				this.entityUpdateParty(session,frame)
				this.partyUpdateCounter = 1
			}
		}

		// update all entities
		this.entityAll((entity)=>{
			this._entityUpdateOne(session,frame,entity)
			this._entityDebugging(entity)
		})
	}

	_entityUpdateOne(session,frame,entity) {

		// ignore maps completely for now
		if(entity.kind=="map") return

		// ignore things that are not gps until a entityGPS exists
		if(!this.entityGPS && entity.kind != "gps") {
			return
		}

		XRAnchorCartography.relocalize(session,frame,entity,this.entityGPS)

		// attempt to set an entityGPS once only for now - always using first one that fits
		if(!this.entityGPS && entity && entity.kind == "gps" && entity.relocalized) {
			this.log("*** entityGPS found " + entity.uuid)
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

	async entityAddGPS(session,frame) {

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

		let results = await XRAnchorCartography.manufacture(session,frame,entity,true,false)

		if(!results) {
			this.err("entityAddGPS: could not make gps anchor!")
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

	entityAddArt() {
		this.pleaseAddArt = 1
	}

	async _entityAddArt(session,frame) {

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

		let results = await XRAnchorCartography.manufacture(session,frame,entity,false,true)

		if(!results) {
			this.err("entityAddArt: anchor failed")
			return 0
		}

		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	///
	/// Create or update the player
	/// 

	async entityUpdateParty(session,frame) {

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

		let results = await XRAnchorCartography.manufacture(session,frame,entity,false,false)

		if(!results) {
			this.err("entityAddParty: fail?")
			return 0
		}

		// force mark as needing republishing
		entity.published = 0

		// set as the party

		this.entityParty = entity

		this.entities[entity.uuid] = entity
		return entity
	}

	mapSave() {
		this.pleaseSaveMap = 1
		return
	}

	async _mapSave(session,frame) {

		// a slight hack - make and fully prep a gps anchor if one is not made yet

		let entity = this.entityGPS
		if(!entity) {
			// if no gps entity was added then force add one now
			entity = await this.entityAddGPS(session,frame)
			if(!entity) {
				this.err("entity MapSave: [error] failed to add gps entity - no gps yet?")
				return 0
			}
			this.entityGPS = entity
		}

		// for now the entity is also written into the map - it's arguable if this is needed - will likely remove since it's mostly just extraneous TODO
		// the idea was that I could search for maps, but if I assume each map has one and only one gps anchor entity then I know what maps exist based on entities whose kind is == gps

		this.log("entity mapSave: UX saving map")

		let results = 0
		try {
			results = await session.getWorldMap()
		} catch(e) {
			this.err(e)
			return 0
		}
		if(!results) {
			this.err("entity MapSave: [error] this engine does not have a good map from arkit yet")
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
		this.log("entity mapSave: succeeded ")

		// - TEST: reload the map - REMOVE ONCE STABLE
		this.mapLoad(entity.anchorUID)

		return 1
	}

	mapLoad(filename) {
		this.pleaseLoadMap = filename
	}

	async _mapLoad(session,frame,filename) {

		this.log("will try load map named " + filename )

		// observe anchors showing up again - actual work is elsewhere in a busy poll loop - this is purely for debugging
		if (!this.listenerSetup) {
			this.listenerSetup = true
			session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				let entity = 0
				this.entityAll(e=>{ if(e.anchorUID == event.detail.uid) entity = e })
				if(entity) {
					if(entity.kind == "gps") this.log("<font color=green>mapLoad: " + event.detail.uid + " *** ANCHOR GOOD</font>" )
				} else {
					this.err("mapLoad: " + event.detail.uid + " *** ANCHOR BAD" )
				}
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await session.setWorldMap({worldMap:data})
		this.log("fresh map file arrived " + filename + " results=" + results.loaded )

		return 1
	}


	//////////////////////////////////////////////////////////////////////////////////
	// network
	//////////////////////////////////////////////////////////////////////////////////

	async entityNetworkRestart() {

		// get a gps location hopefully
		this.gps = await XRAnchorCartography.gpsPromise()
		this.log("Got GPS")
		this.log(this.gps)

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
			this.log("entityLoadAll: this engine needs a gps location before loading maps")
			return 0
		}
		this.log("entityLoadAll: getting all entities near latitude="+this.gps.latitude+" longitude="+this.gps.longitude)

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
			this.log(entity.anchorUID + " << entityLoadAll: made entity kind="+entity.kind+" uuid="+entity.uuid+" anchor="+entity.anchorUID)
		}
		this.log("entityLoadAll: loading done - entities in total is " + count )
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
		entity.quaternion = entity.quaternion ? new THREE.Quaternion(
				parseFloat(entity.quaternion.x),
				parseFloat(entity.quaternion.y),
				parseFloat(entity.quaternion.z),
				parseFloat(entity.quaternion.w) ) : new THREE.Quaternion()
		entity.published = 1
		entity.relocalized = 0
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			this.log("entityReceive: saving new remote entity " + entity.uuid)
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
			//this.log("entityReceive: remote entity found again and updated " + entity.uuid)
		}
	}

	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	_entityPublish(entity) {

		if(!entity.relocalized || !entity.cartesian) {
			this.log("entityPublish: [error] entity has no cartesian " + entity.uuid )
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
		this.log("entityDebug: *** anchorUID=" + entity.anchorUID + " relocalized="+entity.relocalized + " kind="+entity.kind)
		if(entity.gps) this.log("entity=" + entity.anchorUID + " latitude="+entity.gps.latitude+" longitude="+entity.gps.longitude+" accuracy="+entity.gps.accuracy)
		if(entity.cartesian) this.log("entity cartesian x=" + entity.cartesian.x + " y=" + entity.cartesian.y + " z="+entity.cartesian.z)
		console.log(entity)
	}

}

