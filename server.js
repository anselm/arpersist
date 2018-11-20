
const express = require('express')
const parser = require('body-parser')
const app = express()
const url = require('url')
const multer = require('multer')
const upload = multer({dest:'public/uploads/'})
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')
const shortid = require('shortid')
var proxy = require('express-http-proxy');

const port = 3000

const entity = require('./src/entity.js')

//let entity = new Entity()

//////////////////////////////////////////////////
// server
//////////////////////////////////////////////////
 
app.use('/github.com', proxy('github.com'))
app.use('/raw.githubusercontent.com', proxy('raw.githubusercontent.com'))

app.use(parser.json())

app.get("/", async (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

app.post('/api/entity/save', async (request, response) => {
  let results = await entity.save(request.body)
  response.json(results)
})

app.post('/api/entity/flush', async (request, response) => {
  let results = await entity.flush(request.body)
  response.json(results)
})

app.post('/api/entity/query', async (request, response) => {
  let results = await entity.query(request.body)
  response.json(results)
})

app.post('/api/map/save', upload.single('blob'), async (request, response) => {
  let results = await entity.map_save(request.file.path,request.body)
  response.json(results)
})

var ip = require("ip");
console.dir ( "Your server http address is http://" + ip.address() + ":" + port )

app.use(express.static('public'))

// Logic for long connections

io.on('connection', (socket) => {
  console.log("Server: a new connection has shown up " + socket.id)

  // Sockets will tell server where they are at some point
  socket.on('location', (location) => {
    entity.socket_remember(socket.id,location)
  })

  // Sockets also tell server about publishing events
  socket.on('publish', async (msg) => {
    // save
    msg.socket_id = socket.id
    let results = await entity.save(msg)
    // publish to all nearby and also to self
    let ids = Object.keys(io.sockets.sockets)
    for(let i = 0; i < ids.length; i++) {
      let id = ids[i]
      if(!entity.socket_nearby(socket.id,id) ) {
        console.log("socket not nearby " + socket.id )
        continue
      }
      console.log("sending to socket " + socket.id + " " + msg.uuid)
      socket.emit('publish',results)
    }
  })

  socket.on('disconnect', (msg) => {
    // TODO periodically flush boring things that are attached to dead sockets - such as ghosts of participants past
    // TODO also flush participants on a dead socket now
    console.log("Socket disconnect " + socket.id)
    io.emit('user disconnected');
  })


})

http.listen(port, () => {
  console.log('listening on port ' + port )
})



