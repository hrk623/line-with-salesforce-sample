// Load required modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Load required custom modules
const Line = require('./service/line/controller');
const db = require('./db/mongodb');
db.init();

// Configure app
const app = express();
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Process requests for Line
app.route('/line').post(function(req, res) {
  process.env.BASE_URL = 'https://' + req.headers.host;
  Line.processRequest(req);
  res.send('SUCCESS');
});

// Start the Express server and initialize databases and event-loop.
app.listen(app.get('port'), function () {
  console.log('Server started on port: ' + app.get('port'));

  console.log('Starting liveagent chat session monitor');
  const LiveAgentMonitor = require('./service/liveagent/monitor');
  LiveAgentMonitor.startLiveAgentSessionMonitor();
});
