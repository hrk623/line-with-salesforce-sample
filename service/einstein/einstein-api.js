const jwt = require('jsonwebtoken');

exports.getSentiment = async (modelId, text) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
     process.env.EINSTEIN_TOKEN = await getToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/sentiment",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'modelId':  modelId,
      'document': text
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async (error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.probabilities);
      }
    });
  });
}

exports.getIntent = async(modelId, text) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await getToken();
  }
  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/intent",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'modelId': modelId,
      'document': text
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.probabilities);
      }
    });
  });
}

const getToken = () => {
  const now = Math.floor( new Date().getTime() / 1000 );
  const payload = {
    sub: process.env.EINSTEIN_VISION_ACCOUNT_ID,
    aud: 'https://api.einstein.ai/v2/oauth2/token',
    exp: now + 86400
  };

  const assertion = jwt.sign(payload, process.env.EINSTEIN_VISION_PRIVATE_KEY, { algorithm: 'RS256'});

  const request = require("request");
  const options = {
    url: 'https://api.einstein.ai/v2/oauth2/token',
    proxy: process.env.FIXIE_URL,
    json: true,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion='+assertion
  };
  return new Promise((resolve, reject) => {
    request.post(options, (error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.access_token);
      }
    });
  });
}

const isTokenValid = (token) => {
  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/apiusage",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
    },
    json: true,
  };
  return new Promise((resolve, reject) => {
    request.get(options, (error, response, body) => {
      if (response.statusCode === 401) {
        resolve(false);
      } else if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(true);
      }
    });
  });
}