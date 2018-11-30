
//
// db helper
//

let PouchDB = require('pouchdb');  
//PouchDB.plugin(require('pouchdb-find'));

class DBWrapper {

  constructor() {
    this.db = new PouchDB('entities');
  }

  async function db_query(limiter=0) {
    let results = await this.db.allDocs()
    let rows = {}
    for(let i = 0; i < results.total_rows; i++) {
      let row = await this.db.get(results.rows[i].id)
      if(limiter && !limiter(row)) continue
      rows[row._id] = row
    }
    return rows
  }

  async function db_save(id,entity) {
    let prev = await this.db.get(id)
    if(prev) row._rev = prev._rev
    if(!prev) row.createdAt = Date.now()
    ror.updatedAt = Date.now()
    row._id = id
    let status = await this.db.put(row)
    return status
  }

  db_find(id) {
    let row = await this.db.get(id)
    return row
  }

   db_destroy() {
      this.db.destroy().then(function (response) {
        this.db = new PouchDB('entities');
      }).catch(function (err) {
        console.log(err);
      });
   }

}

//
// helper
//

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) { // haversine - https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula

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

//
// server side entity manager
//

class Entity extends DBWrapper {

  constructor() {
    super()
    this.socket_locations = {}
  }

  async save(entity) {
    let status = await this.db_save(entity.uuid,entity)
    if(status.ok != true) console.log("entity: error saving " + entity.uuid)
    return entity
  }

  async flush(blob) {
    this.db_destroy()
    return {status:"fine"}
  }

  async query(query) {
    let results = await this.db_query((entity) => {
        if(!entity || !entity.gps) continue
        let dist = this.getDistanceFromLatLonInKm(query.gps.latitude,query.gps.longitude,entity.gps.latitude,entity.gps.longitude)
        if(dist > 1) return 0
        console.log("server side entity query: query has decided this entity is close enough to return " + entity.uuid)
        return 1
    })
    return results
  }

  async map_save(filepath,args) {
    let target = "public/uploads/"+args.anchorUID
    fs.renameSync(filepath, target)
    return({status:"thanks"})
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
