////////////////////////////////////////////////////////////////////////
// server
//
// - persist entities (which are hashes)
// - return them on demand
//
// - TODO generate a room UUID per session so that every client instance has its own room
// - TODO do not shovel everything back to client every update - only send back differences
// - TODO do not busy poll
//
////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////
// fancy database
//////////////////////////////////////////////////

var shortid = require('shortid')

let entities = {}

function entity_save(entity) {
  // save a blob and return it with a uuid if none
  if(!entity.uuid) {
    entity.uuid = shortid.generate()
  }
  entities[entity.uuid] = entity
  return entity
}

//////////////////////////////////////////////////
// server
//////////////////////////////////////////////////

const port = 3000

const express = require('express')
const parser = require('body-parser')
const app = express()
const url = require('url')

app.use(parser.json())

app.get("/", (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

app.post('/api/entity/save', (request, response) => {
  //let params = url.parse(request.url, true).query
  let entity = request.body;
  let result = entity_save(entity)
  console.log(result);
  response.json(result)
});

app.post('/api/entity/sync', (request, response) => {
  //let params = url.parse(request.url, true).query
  response.json(entities)
});

app.use(express.static('public'))

app.listen(port, () => console.log(`Listening on port ${port}`))


