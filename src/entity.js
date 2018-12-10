const fs = require('fs')

///
/// haversine - https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
///

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {

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

///
/// EntityServer - server side management
///

class EntityServer {

  constructor(db,tablename="entity") {
    this.entities = {}
    this.socket_locations = {}
    this.debugging = {}
  }

  sanitize(entity) {
    // makes sure entities have key properties
    if(!entity.quaternion) entity.quaternion = { w:0, x:0, y:0, z:0 }
    if(!entity.scale) entity.scale = { x:0, y:0, z:0 }
    if(!entity.xyz) entity.xyz = { x:0, y:0, z:0 }
    if(!entity.gps) entity.gps = { latitude:0, longitude:0, altitude:0 }
    if(!entity.cartesian) entity.cartesian = { x:0, y:0, z:0 }
  }

  save(entity) {
    this.sanitize(entity)
    let previous = this.entities[entity.uuid]
    this.entities[entity.uuid] = entity
    if(!previous) entity.createdAt = Date.now()
    entity.updatedAt = Date.now()
    return entity
  }

  flush(blob) {
    // TODO tbd
    return {error:"TBD"}
  }

  query(query) {
    let results = {}
    for(let uuid in this.entities) {
      let entity = this.entities[uuid]
      for(let key in query) {
        let value = query[key]
        if(key == "gps" && value && entity.gps) {
          let dist = getDistanceFromLatLonInKm(value.latitude, value.longitude, entity.gps.latitude, entity.gps.longitude)
          if(dist > 1) {
            console.log("server decided this was too far to return " + key )
            continue
          } else {
            console.log("server side entity query: query has decided this entity is close enough to return " + key)
          }
        } else if(entity[key]!=value) { // case sensitive? should consider numerics? TODO?
          continue
        }
        // TODO remove password/pass from results - maybe have _results that are ignored
        results[key] = entity
      }
    }
    return results
  }

  map_save(filepath,args) {
    let target = "public/uploads/"+args.anchorUID
    fs.renameSync(filepath, target)
    return({status:"thanks"})
  }

  socket_remember(id,location) {
    //console.log(location)
    //console.log("entity: associating socket " + id + " with location " + location.latitude + " " + location.longitude )
    this.socket_locations[id] = location
  }

  socket_forget(id) {
    delete this.socket_locations[id]
  }

  socket_nearby(a,b) {
    let la = this.socket_locations[a]
    let lb = this.socket_locations[b]
    if(!la || !lb) return false
    let ld = getDistanceFromLatLonInKm(la.latitude,la.longitude,lb.latitude,lb.longitude)
    if(ld < 1.00) return true
    return false
  }
}

const instance = new EntityServer()
Object.freeze(instance)
module.exports = instance

//////////////////////////////////////////////////
// hardcoded users
//////////////////////////////////////////////////

instance.save({
  uuid: "anselm12341234",
  name: "anselm",
  _pass: "secret", // TODO hash this
  admin: 10,
  descr: "admin",
  kind: "party",
  tags: "",
  party: "anselm",
})


