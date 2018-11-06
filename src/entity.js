const DBWrapper = require('./dbwrapper.js')

class Entity {

  constructor(db,tablename="entity") {
    this.db = db
    this.table = tablename
    this.schema = [
      "zone TEXT",          // all things are of some layer for noise reduction
      "kind TEXT",          // all things are of some kind (participant,art,...)
      "name TEXT",          // all things have a title or name
      "link TEXT",          // some things may link to other assets
      "art TEXT",           // some things may have an iconic representation
      "description TEXT",   // some things may have a description
      "sponsor INT",        // some things may be sponsored by a participant
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
    let user = await this.db.find(this.table,"uid",uid)
    return user
  }

  async delete(uid) {
     await this.db.delete(this.table,"uid",uid)
  }

  async save(blob) {
    // TODO
    return {error:"TBD"}
  }

  async flush(blob) {
    // TODO
    return {error:"TBD"}
  }

  async filter(blob) {
    // TODO
    return {error:"TBD"}
  }

}

module.exports = Entity

/*

//////////////////////////////////////////////////
// fancy database
// TODO put this in a class and add persistence
//////////////////////////////////////////////////

let entities = {}

function entity_save(entity) {
  // save a blob and return it with a uuid if none
  if(!entity.uuid) {
    entity.uuid = shortid.generate()
    console.log("granted new uuid " + entity.uuid )
  }
  entities[entity.uuid] = entity
  return entity
}

function entity_filter(args) {
  // TODO replace sloppy code with map
  let results = []
  for(let uuid in entities) {
    let entity = entities[uuid]
    //if(entity.zone != args.zone) continue
    results.push(entity)
  }
  return results
}

\entity_filter(request.body)

*/

