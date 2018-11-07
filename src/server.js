
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

const Entity = require('./entity.js')

const port = 3000

let entity = new Entity()

//////////////////////////////////////////////////
// server
//////////////////////////////////////////////////

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
  let path = "public/uploads/"
  let results = await entity.map_save(path+request.file.filename,path+request.body)
  response.json(results)
})

app.post('/api/map/query', upload.single('blob'), async (request, response) => {
  let results = await entity.map_query(request.body)
  response.json(results)
})

app.use(express.static('public'))

io.on('connection', (socket) => {
  socket.on('publish', async (msg) => {
    console.log(msg)
    let results = await entities.save(msg)
    // TODO filter traffic to channels based on what those channels
    // LET SOCKETS HAVE AREAS OF INTEREST
    io.emit('publish', results )
  })
})

http.listen(port, () => {
  console.log('listening on port ' + port )
})


