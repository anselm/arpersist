
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

app.post('/api/map/query', upload.single('blob'), async (request, response) => {
  let results = await entity.map_query(request.body)
  response.json(results)
})

var ip = require("ip");
console.dir ( "Your server http address is http://" + ip.address() + ":" + port )

app.use(express.static('public'))

io.on('connection', (socket) => {
  socket.on('publish', async (msg) => {
    console.log("*** network received a message")
    console.log(msg)
    let results = await entity.save(msg)
    // TODO understand the location of all sockets
    // TODO filter by layer / zone also
    // TODO filter by trust network distance
    // TODO filter by geography
    io.emit('publish', results )
  })
})

http.listen(port, () => {
  console.log('listening on port ' + port )
})



