
const fetch = require('node-fetch');

//const request = require('async-request')

class Exercise {

	async post_entity() {
	}
 
 	async go() {

 		let uuid = 1
		let gps = {longitude:0,latitude:0,altitude:0}
		let cartesian = {x:0, y:0, z:0}

 		let entity = {
		       uuid: 1,
		  anchorUID: "imagine there's no tomorrow",
		       kind: "it's easy if you try",
		        art: "nothing to live or die for",
		       zone: "above us only sky",
		participant: "imagine all the people",
		  cartesian: cartesian,
		        gps: gps,
		  published: 1,
		     remote: 1
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

		// TODO - save something that is kinda like a map

		// TODO - maps should also save an entity 

		// TODO - get back that map in the set of entities

		// TODO - actually do range limiting on queries

		// TODO - actually make client show the set of maps the client can choose from

		// TODO - actually load a chosen map - or allow NONE for admin modes

		console.log("done")

 	}
}

let exercise = new Exercise()
exercise.go()
