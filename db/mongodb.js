var db;
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Connection URL
var url = process.env.MONGODB_URI;

// Use connect method to connect to the Server
MongoClient.connect(url, (err, mongodb) => {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  db = mongodb;
});

exports.init = () => {
  MongoClient.connect(url, function(err, mongodb) {
    mongodb.collections().then(function(collections) {
      collections.forEach(collection => {
        if (collection.s.name !== 'system.indexes') {
          console.log('Initializing DB: ' + collection.s.name);
          collection.deleteMany();
        }
      });
    });
  });
}

exports.collection = name => {
  return db.collection(name);
}
