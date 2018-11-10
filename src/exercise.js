const fs = require('fs')
const fetch = require('node-fetch');
const FormData = require('form-data');
const Blob = require('blob');

//const request = require('async-request')

class Exercise {

	async post_entity() {
	}
 
 	async go() {

 		let uuid = 1
		let gps = {longitude:0,latitude:0,altitude:0}
		let cartesian = {x:0, y:0, z:0}
		let zone = "myzone"

 		let entity = {
		       uuid: "test_entity_1",
		  anchorUID: "imagine there's no tomorrow",
		       kind: "it's easy if you try",
		        art: "nothing to live or die for",
		       zone: "above us only sky",
		       tags: "",
	          party: "imagine all the people",
			   name: "living for themselves",
			  descr: "you may say i am a dreamer",
		  cartesian: cartesian,
		        gps: gps,
		  published: 1,
		     remote: 1,
		      dirty: 0
		 }

		 // Make using fetch

		{
			console.log("Exercise: making entity")
			let response = await fetch("http://127.0.0.1:3000/api/entity/save",{
				method: 'POST',
		        headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(entity),
	       	})
			let json = await response.json()
			console.log("Exercise: Server returned save result")
			console.log(json)
		}

		// Make using request - doesn't work
		/*

		{
			console.log("Exercise: making entity")
			let response = await request('http://127.0.0.1:3000/api/entity/save', {
				method: 'POST',
		        headers: { 'Content-Type': 'application/json' },
				data: JSON.stringify(entity)
			})
			let json = response.body
			console.log("Exercise: Server returned object")
			console.log(json)
		}

		*/

		{
			console.log("Exercise: saving a map")
			const data = new FormData()
 			data.append('blob', fs.createReadStream('src/test.png'), 'blob' );
 			data.append('uuid',"test_map_2")
 			data.append('anchorUID',"test_map_anchor")
 			data.append('name',"a map at " + gps.latitude + " " + gps.longitude )
 			data.append('descr',"a map at " + gps.latitude + " " + gps.longitude )
 			data.append('kind',"map")
 			data.append('art',"cylinder")
			data.append('zone',zone)
			data.append('tags',"amaze")
 			data.append('party',"me")
			data.append('latitude',gps.latitude)
			data.append('longitude',gps.longitude)
			data.append('altitude',gps.altitude)
			let response = await fetch("http://127.0.0.1:3000/api/map/save", { method: 'POST', body: data })
			let json = await response.json()
			console.log("Exercise: Server saved something like a map")
			console.log(json)
		}

		{
			console.log("Exercise: get all entities nearby")
			let response = await fetch("http://127.0.0.1:3000/api/entity/query",{
				method: 'POST',
		        headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gps),
	       	})
			let json = await response.json()
			console.log("Exercise: Server returned query results")
			console.log(json)

		}

		console.log("done")

 	}
}

let exercise = new Exercise()
exercise.go()
