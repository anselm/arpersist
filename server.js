
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

const DBWrapper = require('./dbwrapper.js')
const Entity = require('./entity.js')

const port = 3000

let dbwrapper = new DBWrapper()
let entities = new Entity(dbwrapper)

//////////////////////////////////////////////////
// server
//////////////////////////////////////////////////

app.use(parser.json())

app.get("/", (request, response) => {
  response.sendFile(__dirname + '/public/index.html')
})

app.post('/api/entity/save', (request, response) => {
  let results = await entities.save(request.body)
  response.json(results)
})

app.post('/api/entity/flush', (request, response) => {
  let results = await entities.flush(request.body)
  response.json(results)
})

app.post('/api/entity/sync', (request, response) => {
  let results = await entities.filter(request.body)
  response.json(results)
})

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

  fs.writeFileSync("public/uploads/" + request.body.zone + ".inf",JSON.stringify({
    cartesianx:request.body.cartesianx,
    cartesiany:request.body.cartesiany,
    cartesianz:request.body.cartesianz,
    anchor:request.body.anchor
  }))

  // TODO save an entity for this too for later recovery

})

app.post('/api/map/query', upload.single('blob'), (request, response) => {
  // TODO
})

app.use(express.static('public'))

io.on('connection', (socket) => {
  socket.on('publish', (msg) => {
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


