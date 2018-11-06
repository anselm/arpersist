
const mysql = require('mysql');

class DBWrapper {

  constructor(args) {
    return (async () => {
      this.connection = mysql.createConnection({
        host: args.host,
        user: args.user,
        password: args.password,
      })
      await this.database(args.database)
      await this.use(args.database)
      return this;
    })()
  }

  error(msg) {
    console.error(msg)
  }

  log(msg) {
    console.log(msg)
  }

  connect() {
    // this is not needed for some reason
    this.connection.connect(function(err) {
       if (err) throw err;
       this.log("Connected!");
    })
  }

  database(label) {
    return this.query("CREATE DATABASE IF NOT EXISTS " + label)
  }

  use(label) {
    return this.query("USE " + label)
  }

  table(label,args) {
    let sql = "CREATE TABLE IF NOT EXISTS " + label + " ( " + args.join(", ") + " )"
    return this.query(sql)
  }

  insert(table,hash) {
    // doesn't return results just success or fail
    // TODO should deal with quoting strings itself by looking at the schema (database can handle quoted numbers but...)
    // TODO or we should have some kind of minimal less stupid ORM
    let keys = []
    let values = []
    Object.keys(hash).forEach((key)=>{ keys.push(key); values.push(hash[key]) })
    values = values.map(v => "'" + v + "'")
    let sql = "INSERT INTO " + table + " ("+keys.join(",")+" ) VALUES (" + values.join(",") + ")"
    return this.query(sql)
  }

  find(table,key,value) {
    let sql = "SELECT * FROM " + table + " WHERE " + key + " = '" + value + "'"
    return this.query(sql)
  }

  delete(table,key,value) {
    let sql = "DELETE FROM " + table + " WHERE " + key + " = '" + value + "'"
    return this.query(sql)
  }

  query(sql,args) {
    return new Promise( (resolve, reject) => {
      this.connection.query(sql, args, (err, rows) => {
        if (err) return reject(err)
        if(rows && rows.length > 0) {
          // TODO HACK just get at the data
          resolve( rows[0] )
        }
        else resolve(0)
      })
    })
  }

  close() {
    return new Promise( (resolve, reject) => {
      this.connection.end(err => {
        if (err) return reject(err)
        resolve();
      })
    })
  }
}

module.exports = DBWrapper
 

