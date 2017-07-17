const Router = require('../../router');
const EinsteinAPI = require('../einstein-api');
const GoogleAPI = require('../google-api');

exports.initInstance = async (event) => {
  const SERVICE_NAME = require('../../../common/constants').SERVICE_NAME;
  const id = (new Date()).getTime();
  const name = 'EINSTEIN';
  return await initInstance(id, name, SERVICE_NAME.EINSTEIN_SENTIMENT);
}

exports.destroyInstance = async (id) => {
  return await deleteInstance(id);
}

exports.processEvent = async (event) => {
  info('EINSTEIN:processEvent:イベントを受け取り');
  debug('EINSTEIN:processEvent:instance');
  const instance = await getInstance(event.terminal.id);
  debug(instance);
  switch (event.type) {
    case 'message':
      switch (event.message.type) {
        case 'text':
          info('EINSTEIN:processEvent:textイベントを処理');
          onText(instance, event);
          break;
        default:
          break;
      }
      break;
    case 'postback':
    info('EINSTEIN:processEvent:postback イベントを処理');
      onPostback(instance, event);
      break;
    default:
      break;
  }
}

const createEvent = (instance, type, message) => {
  info('EINSTEIN:createEvent:イベントを作成');
  debug('EINSTEIN:createEvent:event');
  const event = {
    type: type,
    origin: {
      id: instance.id,
      name: instance.name,
      service: instance.service,
    },
    message: message,
  }
  debug(event);
  return event;
}

const onText =  async (instance, event) => {
  if (event.message.text === 'token') {
    return Router.processEvent(createEvent(instance, 'message', {type: 'text',text: process.env.EINSTEIN_TOKEN}));
  } else if (event.message.text === 'model') {
    return Router.processEvent(createEvent(instance, 'message', {type: 'text',text: process.env.EINSTEIN_SENTIMENT_MODEL_ID}));
  }


  if (process.env.GOOGLE_TRANSLATEAPI_TOKEN) {
    debug('EINSTEIN:onText:event.message.text');
    event.message.text = await GoogleAPI.translate(event.message.text);
    debug(event.message.text);
  }
  debug('EINSTEIN:onText:probabilities');
  const probabilities = await EinsteinAPI.getSentiment(process.env.EINSTEIN_SENTIMENT_MODEL_ID, event.message.text);
  debug(probabilities);

  debug('EINSTEIN:onText:text');
  const text = (probabilities.length > 0 ? Math.floor(probabilities[0].probability * 100) + '% ' + probabilities[0].label : '')
    + (probabilities.length > 1 ? '\n' + Math.floor(probabilities[1].probability * 100) + '% ' + probabilities[1].label : '')
    + (probabilities.length > 2 ? '\n' + Math.floor(probabilities[2].probability * 100) + '% ' + probabilities[2].label : '');
  debug(text);
  Router.processEvent(createEvent(instance, 'message', {type: 'text',text: text}));
}

const onPostback = (instance, event) => {
  Router.processEvent(createEvent(instance, 'message', {type: 'text',text: 'Einstein Sentiment(Beta) を開始します。ユーザーが送信した文章を Positive, Negative, Neutral のいずれかに分類する事で、ユーザーの発言の裏にある感情を読み解く事ができます。'}));
}

const info = (message) => {
  console.log(message);
}
const debug = (message) => {
  //console.log(message);
}

const DB = require('../../../db/mongodb');
const COLLECTION_NAME = 'EINSTEIN_SENTIMENT';
const initInstance = async (id, name, service) => {
  return (await DB.collection(COLLECTION_NAME).insertOne({
    id: id,
    name: name,
    service: service,
  })).ops[0];
}

const getInstance = (id) => {
  return DB.collection(COLLECTION_NAME).find({
    'id': id
  }).limit(1).next();
}
const deleteInstance = async (id) => {
  return await DB.collection(COLLECTION_NAME).deleteOne({id:id});
}
