// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var async = require('async');
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var r = require('rethinkdb');



// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 6969;        // set our port

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


// ROUTES FOR OUR API
// =============================================================================
app.route('/api/entry').post(createEntry);

app.route('/api/entry/:device')
  .get(getEntry);

app.route('/api/entries/:device')
  .get(getEntries);

app.route('/api/snapshot').get(getSnapshot);



//If we reach this middleware the route could not be handled and must be unknown.
app.use(handle404);

//Generic error handling middleware.
app.use(handleError);

/*
Take snapshot
*/
function getSnapshot(req, res, next)
{
  console.log('getSnapshot');
    r.db('elder').table('snapshot').run(req.app.dbConn, function(err, result) {
    if(err) {
      return next(err);
    }
    result.toArray(function(error, xx){
        if(error){return next(error);}
        res.json(xx);
    });
  });
}


/*
* Make a snapshot record
*/
function makeSnapshot(entry)
{
     r.db('elder').table('snapshot').insert(entry, {returnChanges: true, conflict: "replace"}).run(app.dbConn, function(err, result) {
    if(err) {
      console.log(err);
    }
    console.log('make a snapshot');

  });
}




function profileLookup(deviceId, output)
{




  var _output = output;

  return new Promise(function(resolve, reject){
    r.db('elder').table('profile').filter({"device": deviceId}).run(app.dbConn).then(function(cursor){
      return cursor.toArray();
    }).then(function(result){
       _output = result;
       resolve(_output);
    }).error(reject)
  });




//  r.db('elder').table('profile').filter({"device":deviceId}).run(app.dbConn).then (function(cursor){
//   return cursor.toArray();
//     } ).then(function (result){

//     return result;
// }); 


// r.db('elder').table('profile').filter({"device":deviceId}).run(app.dbConn, function(err, result) {
//     if(err) {
//       return next(err);
//     }

//      result.toArray();
//     /*
//     result.toArray(function(error, xx){
//         if(error){return next(error);}
//         console.log(xx);
//         return xx;
//     });*/
//   });
  
}

/*
 * Insert a new entry
 */
function createEntry(req, res, next) {
  var entry = req.body;
  


//   r.db('elder').table('entry').insert(entry, {returnChanges: true}).run(req.app.dbConn, function(err, result) {
//     if(err) {
//       return next(err);
//     }

//     res.json(result.changes[0].new_val);
//   });

// var profile ; 
  profileLookup(req.body.device).then(function(output) { 
    ///console.log(profile);
    entry.name = output[0].displayName;
    entry.residentId = output[0].residentId;

    console.log(entry);
    //insert into entry table
    r.db('elder').table('entry').insert(entry, {returnChanges: true}).run(req.app.dbConn, function(err, result) { 
      if(err) {
        return next(err);
      }
      res.json(result.changes[0].new_val);
    });

    //insert or update snapshot
      var previousId = '';

      r.db('elder').table('snapshot').filter({"residentId":entry.residentId}).run(req.app.dbConn, function(err, result2){
          if(err) { return next(err); }


          result2.each(function(err, row){
            if (err) 
            { return next(err); }
                  previousId = row.id;
              }, function(){
                // console.log('pID: ' + previousId);
                if(previousId.length>0)
                entry.id = previousId;
                // console.log(entry);
                makeSnapshot(entry);
            });
      });
  });


// async.waterfall([

//   function ( callback){

//     r.db('elder').table('entry').insert(entry, {returnChanges: true}).
//       run(app.dbConn, function(err, result) {
//        res.json(result.changes[0].new_val);
//       callback(null, err, "hello");
//     });
//    },
//   function (arg1, arg2, callback) {

//       console.log('passing '+ req.body.device);
//       var profile = null;
//       profileLookup(req.body.device).then(function(output) { 
//         ///console.log(profile);
//         entry.name = output[0].displayName;
//         entry.residentId = output[0].residentId;

//         console.log(entry);
        
//       });
   
//       // console.log('Profile: ' + profile);
//       callback(null, arg1+arg2+'b');
//   }
// ], function(error, success)
// {

//    if (error) { console.log('Something is wrong!'); }
//         return console.log('Done! ' + success);
// }

// );
  



}

/*
 * Get specific entries
 */
function getEntries(req, res, next) {
  var device = req.params.device;
   record=''; 
  r.db('elder').table('entry').getAll(device,{index:'device'} ).run(req.app.dbConn, function(err, result) {
    if(err) {
      return next(err);
    }
    result.toArray(function(error, xx){
        if(error){return next(error);}
        res.json(xx);
    });
  });
}


/*
 * Get a specific entry
 */
function getEntry(req, res, next) {
  var device = req.params.device;
   record=''; 
  r.db('elder').table('entry').getAll(device,{index:'device'} ).run(req.app.dbConn, function(err, result) {
    if(err) {
      return next(err);
    }
    result.toArray(function(error, xx){
        if(error){return next(error);}
        res.json(xx[0]);
    });
  });
}

/*
 * Page-not-found middleware.
 */
function handle404(req, res, next) {
  res.status(404).end('not found');
}

/*
 * Generic error handling middleware.
 * Send back a 500 page and log the error to the console.
 */
function handleError(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({err: err.message});
}

function startServer(connection)
{
    app.dbConn = connection;
    // START THE SERVER
    // =============================================================================
    app.listen(port);
    console.log('Magic happens on port ' + port);
}

async.waterfall([
    function connect(callback) {
    r.connect({host:'localhost', port:28015}, callback);
  },
    function createDatabase(connection, callback) {
    //Create the database if needed.
    r.dbList().contains('elder').do(function(containsDb) {
      return r.branch(
        containsDb,
        {created: 0},
        r.dbCreate('elder')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function createTable(connection, callback) {
    //Create the table if needed.
    r.db('elder').tableList().contains('entry').do(function(containsTable) {
      return r.branch(
        containsTable,
        {created: 0},
        r.db('elder').tableCreate('entry')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },

  function createTable2(connection, callback) {
    //Create the table if needed.
    r.db('elder').tableList().contains('snapshot').do(function(containsTable) {
      return r.branch(
        containsTable,
        {created: 0},
        r.db('elder').tableCreate('snapshot')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },

  function createIndex(connection, callback) {
    //Create the index if needed.
    r.db('elder').table('entry').indexList().contains('device').do(function(hasIndex) {
      return r.branch(
        hasIndex,
        {created: 0},
        r.db('elder').table('entry').indexCreate('device')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function waitForIndex(connection, callback) {
    //Wait for the index to be ready.
    r.db('elder').table('entry').indexWait('device').run(connection, function(err, result) {
      callback(err, connection);
    });
  },
    function createIndex2(connection, callback) {
    //Create the index if needed.
    r.db('elder').table('snapshot').indexList().contains('device').do(function(hasIndex) {
      return r.branch(
        hasIndex,
        {created: 0},
        r.db('elder').table('snapshot').indexCreate('device')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function waitForIndex2(connection, callback) {
    //Wait for the index to be ready.
    r.db('elder').table('snapshot').indexWait('device').run(connection, function(err, result) {
      callback(err, connection);
    });
  }
], function(err, connection){
    if(err)
    {
        console.error(err);
        process.exit(1);
        return;
    }
    startServer(connection);
});





