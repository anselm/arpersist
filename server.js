
const express = require('express')
const parser = require('body-parser')
const app = express()
const url = require('url')
const multer = require('multer')
const upload = multer({dest:'public/uploads/'})
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')

const port = 3000

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

app.use(parser.json())

app.get("/", (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

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

app.post('/api/map/save', upload.single('blob'), (request, response) => {

  let source = "public/uploads/" + request.file.filename // sanitize TODO
  let target = "public/uploads/" + request.body.zone

  console.log(source)
  console.log(target)

  try {
    fs.statSync(target)
    fs.unlinkSync(target)
    console.log("deleted")
  } catch(err) {
    console.log("not deleted")
  }

  try {
    console.log("moving")
    fs.renameSync(source, target)
    response.json({status:"thanks"})
    console.log("moved")
  } catch(err) {
    console.log("failed")
    console.log(err)
    response.json({status:"error"})
  }

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


