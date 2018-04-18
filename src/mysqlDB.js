'use strict';

import config from './config';
import log from './lib/log';
import mysql from 'mysql';


let onAcquire = (connection)=>{
  log('d', 'i','mysql connection %d acquired', connection.threadId)
};

let onConnection = (connection)=>{
  log('d', 'i','mysql new connection', connection)
};

let onEnqueue = ()=>{
  log('d', 'i','mysql connection queued')
};

let onRelease = (connection)=>{
  log('d', 'i','mysql connection %d released', connection.threadId)
};

let pool = mysql.createPool(config.mysql);

pool.on('acquire', onAcquire);
pool.on('connection', onConnection);
pool.on('enqueue', onEnqueue);
pool.on('release', onRelease);


let connection = {
  async query (){

    let sql_args = [];
    let args = [];
    for(let i=0; i<arguments.length; i++){
      args.push(arguments[i]);
    }
    if(args.length > 1){
      sql_args = args[1]
    }
    // var callback = args[args.length-1]; //last arg is callback


    return new Promise(async (resolve, reject) => {

      pool.query(args[0],sql_args, (err, result)=>{

        if(err){
         reject(err)
        }

        resolve(result)


      });
    });
  },
  async transaction(stages){
    return new Promise(async (resolve, reject) => {

      if(!stages || !Array.isArray(stages) || !stages.length){
        reject({msg:`no stages provided for transaction`})
      }

      pool.getConnection((err,conn)=>{

        if(err){
          reject(err);
          return;
        }

        conn.beginTransaction((err)=>{
          let response = [];
          if(err){
            reject(err);
            return;
          }

          stages.forEach((s, idx , arr)=>{

            conn.query(s.statement,s.postdata || {}, (error, results, fields)=>{

              if(error){
                return conn.rollback(()=>{
                  conn.release();
                  reject(error);
                });
              }

              response.push(results);

              if(idx === arr.length-1){

                conn.commit((err)=>{

                  if(err){
                    return conn.rollback(()=>{
                      conn.release();
                      reject(err);
                    });
                  }

                  conn.release();
                  response.push(results);
                  resolve(response);
                })
              }
            })

          })

        })


      });
    });
  },
  getConnection: (cb) => pool.getConnection(cb)
};

export default connection;


