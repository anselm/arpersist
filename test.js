
const request = require('request')


let username = "anselm_moz"
let password = "34west34"
let key = "1a9db900738d44298b0bc59f68123393"
var url = "https://api.sketchfab.com/v3/models/"+key+"/download"

let oauth = 0

function get_oauth() {
  return new Promise((resolve, reject)=>{
      let params = {json:{
          username:username,
          password:password
      } }
      request.post( this.url_authenticate, params, (error,response,body) => {
        if(error || response.statusCode != 200) {
          console.error("jwt: error")
          console.error(error)
          return
        }
        oauth = body.token
        console.log("oauth is " + oauth)
        resolve("alls well that asynchronously ends well")
      })
  })
}

function getart() {

  var options = {
      method: 'GET',
      headers: {
          Authorization: 'Bearer {INSERT_OAUTH_ACCESS_TOKEN_HERE}',
      },
      mode: 'cors'
  };

  fetch(url, options).then(function(response){
    return response.json();
  }).then(function(data){
    console.log(data);
  });

}


async function test() {

  await get_oauth()

  console.log(oauth)

}

test()


