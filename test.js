let PouchDB = require('pouchdb');

//PouchDB.plugin(require('pouchdb-find'));

let db = new PouchDB('entities');

async function save(entity) {
  entity._id = entity.anchorUID
  let prev = await db.get(entity.anchorUID)
  if(prev) entity._rev = prev._rev
  return await db.put(entity)
}

function find(id) {
  return db.get(id)
}

let entity = {
 anchorUID: "abcd1234", blah: { lat:Math.random(), lon:4123 }, colo: "blue", _rev: "1-1"
}

async function test() {
  let saved = await save(entity)
  console.log(saved)
  return saved

  let results = await find(entity.anchorUID)
  console.log(results)
}

async function query(limiter=0) {
  let results = await db.allDocs()
  let candidates = {}
  for(let i = 0; i < results.total_rows; i++) {
    let entity = await db.get(results.rows[i].id)
    if(limiter && !limiter(entity)) continue
    candidates[entity.anchorUID] = entity
  }
  console.log(candidates)
  return candidates
}

test() // query()


