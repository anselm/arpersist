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
    console.log("granted new uuid " + entity.uuid )
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
const multer = require('multer')
const upload = multer({dest:'uploads/'})
var http = require('http').Server(app);
var io = require('socket.io')(http);


app.use(parser.json())

app.get("/", (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

/*
app.post('/api/blob/save', upload.single('blob'), (request, response) => {
  response.json({result:"thanks"})
});
*/

app.post('/api/map/save', upload.single('blob'), (request, response) => {
  console.log("saved result " + request.file)
  console.log(request.file)
  console.log(request.body)
  response.json({result:"thanks"})
});

app.post('/api/entity/save', (request, response) => {
  //let params = url.parse(request.url, true).query
  let entity = request.body;
  let result = entity_save(entity)
  console.log("saved new")
  console.log(result)
  response.json(result)
});

app.post('/api/entity/sync', (request, response) => {
  //let params = url.parse(request.url, true).query
  var d = new Date()
  var n = d.getTime()
  console.log("ping at time " + n)
  response.json(entities)
});

app.use(express.static('public'))

io.on('connection', function(socket){
  socket.on('publish', function(msg){
    io.emit('publish', msg)
  })
})

http.listen(port, function(){
  console.log('listening on port ' + port )
})


