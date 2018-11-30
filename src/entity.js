const fs = require('fs')


//const DBWrapper = require('./dbwrapper.js')

///
/// Entity - server side management
///

class Entity {

  constructor(db,tablename="entity") {
    this.entities = {}
    this.socket_locations = {}
  }

  async init() {
/*

    this.db = new DBWrapper()

    this.table = tablename
    this.schema = [
      "zone TEXT",          // all things are of some layer for noise reduction
      "kind TEXT",          // all things are of some kind (party,art,...)
      "name TEXT",          // all things have a title or name
      "link TEXT",          // some things may link to other assets
      "art TEXT",           // some things may have an iconic representation
      "descr TEXT",         // some things may have a description
      "party TEXT",         // some things may be sponsored by a party
      "zone TEXT",          // some things may have a zone
      "tags TEXT",          // some things may have tags
      "parent INT",         // some things may have a parent node 
      "priority INT",       // some things may be visible from far away
      "public INT",         // some things may be private, protected, public
      "permissions INT",    // some things may be not publically editable
      "x DOUBLE",           // most things have cartesian coordinates
      "y DOUBLE",
      "z DOUBLE",
      "rx DOUBLE",          // many things have an orientation absolutely
      "ry DOUBLE",
      "rz DOUBLE",
      "radius DOUBLE",      // many things have a radius
      "xmin DOUBLE",        // many things have a radius
      "xmax DOUBLE",        // many things have a radius
      "ymin DOUBLE",        // many things have a radius
      "ymax DOUBLE",        // many things have a radius
      "zmin DOUBLE",        // many things have a radius
      "zmax DOUBLE",        // many things have a radius
      "created_at TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()",
      "updated_at TIMESTAMP NOT NULL",
    ]
    return (async () => {
      await this.db.table(this.table,this.schema)
      return this
    })()
*/
  }

  error(msg) {
    console.error(msg)
  }

  log(msg) {
    //console.log(msg)
  }

  async create(blob) {
/*
    let results = await this.read(uid)
    if(results) {
      this.log("Found existing user from uid " + uid)
    } else {
      let hash = { uid:uid, pubkey:pubkey, unencrypted_secret:unencrypted_secret }
      await this.db.insert(this.table,hash)
      results = await this.read(uid)
      this.log("Created new from uid " + uid)
    }
    this.log(results)
    return results
*/
  }

  async read(uid) {
    //let user = await this.db.find(this.table,"uid",uid)
    return user
  }

  async delete(uid) {
    // await this.db.delete(this.table,"uid",uid)
  }

  async save(entity) {
    let previous = this.entities[entity.uuid]
    this.entities[entity.uuid] = entity
    if(!previous) entity.createdAt = Date.now()
    entity.updatedAt = Date.now()
    return entity
  }

  async flush(blob) {
    // TODO
    return {error:"TBD"}
  }

  async query(query) {
    let results = {}
    if(this.entities && query.gps) {
      let keys = Object.keys(this.entities)
      for(let i = 0; i < keys.length;i++) {
        let key = keys[i]
        let entity = this.entities[key]
        if(!entity || !entity.gps) continue
        let dist = this.getDistanceFromLatLonInKm(query.gps.latitude,query.gps.longitude,entity.gps.latitude,entity.gps.longitude)
        if(dist > 1) continue
          console.log("server side entity query: query has decided this entity is close enough to return " + key)
          // I need to use the cesium libraries here to get to gps or i need to use cartesian coordinates or something... debate
        results[key] = entity
      }
    }
    return results
  }

  async map_save(filepath,args) {
    let target = "public/uploads/"+args.anchorUID
    fs.renameSync(filepath, target)
    return({status:"thanks"})
  }


  getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) { // haversine - https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula

    function deg2rad(deg) {
      return deg * (Math.PI/180)
    }

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
  }

  socket_remember(id,location) {
    console.log(location)
    console.log("entity: associating socket " + id + " with location " + location.latitude + " " + location.longitude )
    this.socket_locations[id] = location
  }

  socket_forget(id) {
    delete this.socket_locations[id]
  }

  socket_nearby(a,b) {
    let la = this.socket_locations[a]
    let lb = this.socket_locations[b]
    if(!la || !lb) return false
    let ld = this.getDistanceFromLatLonInKm(la.latitude,la.longitude,lb.latitude,lb.longitude)
    if(ld > 1.00) return false
    return true
  }
}

const instance = new Entity()
Object.freeze(instance)
module.exports = instance
