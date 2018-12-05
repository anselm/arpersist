
const express = require('express')
const parser = require('body-parser')
const app = express()
const url = require('url')
const multer = require('multer')
const upload = multer({dest:'public/uploads/'})
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')


//var proxy = require('express-http-proxy');

const port = 3000

const entity = require('./src/entity.js')

//////////////////////////////////////////////////
// server
//////////////////////////////////////////////////

var request = require('request');

app.get('/proxy/*', function(req,res) {
  let newurl = req.params[0]
  request(newurl).pipe(res)
})

// older proxy approach - too limiting
//app.use('/github.com', proxy('github.com'))
//app.use('/raw.githubusercontent.com', proxy('raw.githubusercontent.com'))

app.use(parser.json())

app.get("/", (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

app.post('/api/entity/save', (request, response) => {
  let results = entity.save(request.body)
  response.json(results)
})

app.post('/api/entity/flush', (request, response) => {
  //let results = entity.flush(request.body)
  response.json(results)
})

app.post('/api/entity/query', (request, response) => {
  let results = entity.query(request.body)
  response.json(results)
})

app.post('/api/map/save', upload.single('blob'), (request, response) => {
  let results = entity.map_save(request.file.path,request.body)
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
  socket.on('publish', (msg) => {
    let srcid = socket.id
    // save
    msg.socket_id = srcid
    let results = entity.save(msg)
    // debug
    let latitude = msg.gps ? msg.gps.latitude : 0
    let longitude = msg.gps ? msg.gps.longitude : 0
    console.log("Server port " + srcid + " received entity=" + msg.uuid + " kind=" + msg.kind + " at lat="+latitude+" lon="+longitude )
    // publish to all nearby - let's not reecho to self 
    let ids = Object.keys(io.sockets.sockets)
    for(let i = 0; i < ids.length; i++) {
      let id = ids[i]
      if(srcid == id) continue
      let target = io.sockets.sockets[id]
      if(!entity.socket_nearby(srcid,id) ) {
        console.log("not sending msg to geographically distant socket " + id + " " + msg.uuid)
        continue
      }
      target.emit('publish',results)
    }
  })

  socket.on('disconnect', (msg) => {
    // TODO periodically flush boring things that are attached to dead sockets - such as ghosts of participants past
    // TODO also flush participants on a dead socket now
    console.log("Socket disconnect " + socket.id)
    entity.socket_forget(socket.id)
  })


})

http.listen(port)



