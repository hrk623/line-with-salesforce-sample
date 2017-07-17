const SERVICES = {
  LINE: require('../service/line/controller'),
  LIVEAGENT: require('../service/liveagent/controller'),
  SIMPLEBOT: require('../service/bot/controller'),
  EINSTEIN_SENTIMENT: require('../service/einstein/sentiment/controller'),
  EINSTEIN_INTENT: require('../service/einstein/intent/controller'),
  ROUTER: require('../service/router'),
};

const SERVICE_NAME = {
  LINE:      'LINE',
  LIVEAGENT: 'LIVEAGENT',
  SIMPLEBOT: 'SIMPLEBOT',
  DEFAULT:   'SIMPLEBOT',
  EINSTEIN_SENTIMENT: 'EINSTEIN_SENTIMENT',
  EINSTEIN_INTENT: 'EINSTEIN_INTENT',
  ROUTER:    'ROUTER',
};


const POSTBACK_DATA = {
	PROCESSOR: {
		ROUTER: SERVICE_NAME.ROUTER,
	},
	ACTION: {
		SWITCH_ORIGIN: 'SWITCH_ORIGIN',
		SWITCH_TERMINAL: 'SWITCH_TERMINAL',
	},
	OPTION: {
		LINE:      SERVICE_NAME.LINE,
        LIVEAGENT: SERVICE_NAME.LIVEAGENT,
        SIMPLEBOT: SERVICE_NAME.SIMPLEBOT,
        EINSTEIN:  SERVICE_NAME.EINSTEIN,
        ROUTER:    SERVICE_NAME.ROUTER,
        EINSTEIN_INTENT: SERVICE_NAME.EINSTEIN_INTENT,
        EINSTEIN_SENTIMENT: SERVICE_NAME.EINSTEIN_SENTIMENT
	},

};




//exports.SERVICE_NAME = name;
//exports.SERVICES = services;
//exports.POSTBACK_DATA = postback;

module.exports = {
	SERVICE_NAME: SERVICE_NAME,
    SERVICES: SERVICES,
    POSTBACK_DATA: POSTBACK_DATA,
};
