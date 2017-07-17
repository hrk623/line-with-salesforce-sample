exports.init = async () => {
  const id = (new Date()).getTime();
  return await initTranscript(id);
}

exports.flush = async (transcriptId) => {
  return await getFormattedTranscriptsAndDelete(transcriptId);
}

exports.append = async (transcriptId, event) => {
  switch (event.type) {
    case 'message':
      switch (event.message.type) {
        case 'text':
          await onText(transcriptId, event);
          break;
        case 'image':
          await onImage(transcriptId, event);
          break;
        case 'video':
          await onVideo(transcriptId, event);
          break;
        case 'audio':
          await onAudio(transcriptId, event);
          break;
        case 'location':
          await onLocation(transcriptId, event);
          break;
        case 'sticker':
          await onSticker(transcriptId, event);
          break;
        default:
          break;
      }
      break;
    case 'follow':
      await onFollow(transcriptId, event);
      break;
    case 'unfollow':
      await onUnfollow(transcriptId, event);
      break;
    case 'join':
      await onJoin(transcriptId, event);
      break;
    case 'leave':
      await onLeave(transcriptId, event);
      break;
    case 'postback':
      await onPostback(transcriptId, event);
      break;
    case 'beacon':
      await onBeacon(transcriptId, event);
      break;
    default:
      break;
  }
}

const onText = async(transcriptId, event) => {
    await appendTranscript(transcriptId, event.origin.name, event.message.text);
}

const onImage = async (transcriptId, event) => {
	await appendTranscript(transcriptId, event.origin.name, event.content.url);
}

const onVideo = async(transcriptId, event) => {
	await appendTranscript(transcriptId, event.origin.name, event.content.url);
}

const onAudio = async(transcriptId, event) => {
	await appendTranscript(transcriptId, event.origin.name, event.content.url);
}

function onLocation(transcriptId, event) {}

function onSticker(transcriptId, event) {}

function onFollow(transcriptId, event) {}

function onUnfollow(transcriptId, event) {}

function onJoin(transcriptId, event) {}

function onLeave(transcriptId, event) {}

const onPostback = async(transcriptId, event) => {
	const POSTBACK_DATA = require('../common/constants').POSTBACK_DATA;
	const processor = event.postback.data.split(',')[0];
    const action = event.postback.data.split(',')[1];
    if (processor === POSTBACK_DATA.PROCESSOR.ROUTER && action === POSTBACK_DATA.ACTION.SWITCH_ORIGIN){
      const newServiceName = event.postback.data.split(',')[2];
      await appendTranscript(transcriptId, 'SYSTEM', newServiceName + ' を開始');
    } else if (processor === POSTBACK_DATA.PROCESSOR.ROUTER && action === POSTBACK_DATA.ACTION.SWITCH_TERMINAL){
      const newServiceName = event.postback.data.split(',')[2];
      await appendTranscript(transcriptId, 'SYSTEM', newServiceName + ' を開始');
    }
}

const info = (message) => {
  console.log(message);
}
const debug = (message) => {
  console.log(message);
}

const DB = require('../db/mongodb');
const COLLECTION_NAME = 'TRANSCRIPT';
const initTranscript = async (id) => {
  return (await DB.collection(COLLECTION_NAME).insertOne({id: id, transcripts: []})).ops[0].id;
}

const appendTranscript = async (id, name, message) => {
  await DB.collection(COLLECTION_NAME).findOneAndUpdate({id:id}, {$push: {transcripts: '== '+ name + ' ==\n' + message}});
}

const getTranscripts = async (id) => {
  return (await DB.collection(COLLECTION_NAME).find({id:id}).limit(1).next()).transcripts;
}

const getFormattedTranscriptsAndDelete = async (id) => {
  const transcripts = (await DB.collection(COLLECTION_NAME).findOneAndUpdate({id:id}, {$set: {transcripts: []}}, {returnOriginal: true})).value.transcripts;
  return transcripts.join('\n');
}
