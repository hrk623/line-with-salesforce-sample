exports.translate = (text) => {
  const request = require("request");
  const options = {
    url: 'https://translation.googleapis.com/language/translate/v2'
    + '?key=' + process.env.GOOGLE_TRANSLATEAPI_TOKEN
    + '&source=ja&target=en'
    + '&q=' + encodeURI(text),
    json: true,
  };
  return new Promise((resolve, reject) => {
    if (process.env.GOOGLE_TRANSLATEAPI_TOKEN) {
    request.get(options, (error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.data.translations[0].translatedText);
      }
    });
  } else {
    text;
  }
  });
}