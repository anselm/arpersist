
class a {
  constructor() {
    this.something = "12"
  }
}

class b {
  constructor() {
    this.whatever = "neato"
    this.yes = new a()
  }
  dowork() { console.log( "good" ) }
}


let made = new b()
made.dowork()

let str = JSON.stringify(made)
console.log(made)
console.log(str)

let real = JSON.parse(str)
console.log(real)
console.log(typeof real)
console.log(real.dowork())

