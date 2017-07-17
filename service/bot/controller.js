const Router = require('../router');

exports.initInstance = async (event) => {
  const SERVICE_NAME = require('../../common/constants').SERVICE_NAME;
  const id = (new Date()).getTime();
  const name = 'BOT';
  return await initInstance(id, name, SERVICE_NAME.SIMPLEBOT);
}

exports.destroyInstance = async (id) => {
  return await deleteInstance(id);
}

exports.processEvent = async(event) => {
  const instance = await getInstance(event.terminal.id);
  switch (event.type) {
    case 'message':
      switch (event.message.type) {
        case 'text':
          onText(instance, event);
          break;
        case 'image':
          onImage(instance, event);
          break;
        case 'video':
          onVideo(instance, event);
          break;
        case 'audio':
          onAudio(instance, event);
          break;
        case 'location':
          onLocation(instance, event);
          break;
        case 'sticker':
          onSticker(instance, event);
          break;
        default:
          break;
      }
      break;
    case 'follow':
      onFollow(instance, event);
      break;
    case 'unfollow':
      onUnfollow(instance, event);
      break;
    case 'join':
      onJoin(instance, event);
      break;
    case 'leave':
      onLeave(instance, event);
      break;
    case 'postback':
      onPostback(instance, event);
      break;
    case 'beacon':
      onBeacon(instance, event);
      break;
    default:
      break;
  }
}

const createEvent = (instance, type, message) => {
  const e = {
    type: type,
    origin: {
      id: instance.id,
      name: instance.name,
      service: instance.service,
    },
    message: message,
  }
  return e;
}

const onText = (instance, event) => {
  var patterns = [{
    key: /こんにちは|ハロー/,
    message: 'こんにちは、' + event.origin.name + 'さん\n何かお困りですか？'
  }, {
    key: /Hello|hello/,
    message: 'Hi ' + event.origin.name + ',\nHow can I help you today?'
  }, {
    key: /.*パスワード.*/,
    message: 'こちらの情報はお役にたちますか？\nhttps://help.salesforce.com/articleView?id=user_password.htm&language=ja&type=0'
  }, {
    key: /./,
    message: ''
  }];
  var matchedPattern = patterns.filter((pattern) => {
    return pattern.key.test(event.message.text);
  });

  if (matchedPattern[0].message) {
    Router.processEvent(createEvent(instance, 'message', {type: 'text', text: matchedPattern[0].message}));
  } else {
    const POSTBACK_DATA = require('../../common/constants').POSTBACK_DATA;
    event = createEvent(instance, 'message', {
      type: 'template',
      altText: '今すぐチャットでオペレータに質問してみましょう。',
      template: {
        type: 'buttons',
        thumbnailImageUrl: process.env.BASE_URL + '/asset/img/liveagent_invite.png',
        title: '答えが見つかりませんか？',
        text: '今すぐチャットでオペレータに質問してみましょう。',
        actions: [{
          type: 'postback',
          label: 'チャットを開始',
          data: POSTBACK_DATA.PROCESSOR.ROUTER +','+ POSTBACK_DATA.ACTION.SWITCH_TERMINAL +','+ POSTBACK_DATA.OPTION.LIVEAGENT
        }]
      }
    });
    Router.processEvent(event);
  }
}
const onImage = (instance, event) => {
  const text = '画像を受け取りました。\n種類は「' + event.content.type + '」、サイズは「' + event.content.length + '」バイトです。\nこちらから確認出来ます。' + event.content.url;
  event = createEvent(instance, 'message', {
    type: 'text',
    text: text
  });
  Router.processEvent(event);
}
const onVideo = (instance, event) => {
  const text = '動画を受け取りました。\n種類は「' + event.content.type + '」、サイズは「' + event.content.length + '」バイトです。\nこちらから確認出来ます。' + event.content.url;
  event = createEvent(instance, 'message', {
    type: 'text',
    text: text
  });
  Router.processEvent(event);
}

const onAudio = (instance, event) => {
  const text = '音声を受け取りました。\n種類は「' + event.content.type + '」、サイズは「' + event.content.length + '」バイトです。\nこちらから確認出来ます。' + event.content.url;
  event = createEvent(instance, 'message', {
    type: 'text',
    text: text
  });
  Router.processEvent(event);
}

const onLocation = (instance, event) => {}

const onSticker = (instance, event) => {}

const onFollow = (instance, event) => {

}

const onUnfollow = (instance, event) => {}

const onJoin = (instance, event) => {}

const onLeave = (instance, event) => {}

const onPostback = (instance, event) => {}

const DB = require('../../db/mongodb');
const COLLECTION_NAME = 'SIMPLEBOT';
const initInstance = async (id, name, service) => {
  return (await DB.collection(COLLECTION_NAME).insertOne({id: id, name: name, service: service})).ops[0];
}
const getInstance = (id) => {
  return DB.collection(COLLECTION_NAME).find({id: id}).limit(1).next();
}
const deleteInstance = async (id) => {
  return await DB.collection(COLLECTION_NAME).deleteOne({id:id});
}
