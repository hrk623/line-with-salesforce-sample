const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36";


exports.initInstance = async(event) => {
  const SERVICE_NAME = require('../../common/constants').SERVICE_NAME;
  const Router = require('../../common/constants').SERVICES.ROUTER;
  let session = await createLiveAgentSession();
  session = await createChatVisitorSession(session, event.origin);
  session.name = 'OPERATOR';
  session.service = SERVICE_NAME.LIVEAGENT;
  session = await initSession(session);
  const transcript = await Router.getTranscript(event.origin.id);
  
  if (transcript) {
    await sendMessage(session, transcript);
  }
  

  return session;
}

exports.destroyInstance = async (id) => {
  return await deleteSession(id);
}


const createLiveAgentSession = () => {
  var request = require("request");
  var options = {
    url: "https://" + process.env.LIVEAGENT_POD + "/chat/rest/System/SessionId",
    headers: {
      "X-LIVEAGENT-API-VERSION": process.env.LIVEAGENT_API_VERSION,
      "X-LIVEAGENT-AFFINITY": "null",
      Connection: "keep-alive"
    },
    json: true
  };
  return new Promise(function(resolve, reject) {
    request.get(options, (error, response, body) =>{
      if (error || response.statusCode != 200) {
        reject(error);
      } else {
        resolve({
          key: body.key,
          affinity: body.affinityToken,
          id: body.id,
          sequence: 1
        });
      }
    });
  });
}

const createChatVisitorSession = (session, origin) => {
  var request = require("request");
  var options = {
    url: "https://" + process.env.LIVEAGENT_POD + "/chat/rest/Chasitor/ChasitorInit",
    headers: {
      "X-LIVEAGENT-API-VERSION": process.env.LIVEAGENT_API_VERSION,
      "X-LIVEAGENT-SESSION-KEY": session.key,
      "X-LIVEAGENT-SEQUENCE": session.sequence,
      "X-LIVEAGENT-AFFINITY": session.affinity
    },
    json: true,
    body: {
      organizationId: process.env.LIVEAGENT_ORGANIZATION_ID,
      deploymentId: process.env.LIVEAGENT_DEPLOYMENT_ID,
      buttonId: process.env.LIVEAGENT_BUTTON_ID,
      sessionId: session.id,
      trackingId: "",
      userAgent: USER_AGENT,
      language: "ja",
      screenResolution: "750x1334",
      visitorName: origin.name,
      prechatDetails: [{
        label: "ContactLineId",
        value: origin.id,
        entityMaps: [],
        transcriptFields: [],
        displayToAgent: true,
        doKnowledgeSearch: false
      }, {
        label: "ContactLastName",
        value: origin.name,
        entityMaps: [],
        transcriptFields: [],
        displayToAgent: true,
        doKnowledgeSearch: false
      }],
      buttonOverrides: [],
      receiveQueueUpdates: true,
      prechatEntities: [{
        entityName: "Contact",
        showOnCreate: true,
        linkToEntityName: null,
        linkToEntityField: null,
        saveToTranscript: "ContactId",
        entityFieldsMaps: [{
          fieldName: "LastName",
          label: "ContactLastName",
          doFind: false,
          isExactMatch: false,
          doCreate: true
        }, {
          fieldName: "LineId__c",
          label: "ContactLineId",
          doFind: true,
          isExactMatch: true,
          doCreate: true
        }]
      }],
      isPost: true
    }
  };
  return new Promise(function(resolve, reject) {
    request.post(options, (error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(error);
      } else {
        session.sequence++;
        resolve(session);
      }
    });
  });
}

exports.processEvent = async(event) => {
  var session = await getSession(event.terminal.id);
  switch (event.type) {
    case 'message':
      switch (event.message.type) {
        case 'text':
          await onText(session, event);
          break;
        case 'image':
          await onImage(session, event);
          break;
        case 'video':
          await onVideo(session, event);
          break;
        case 'audio':
          await onAudio(session, event);
          break;
        case 'location':
          await onLocation(session, event);
          break;
        case 'sticker':
          await onSticker(session, event);
          break;
        default:
          break;
      }
      break;
    case 'follow':
      await onFollow(session, event);
      break;
    case 'unfollow':
      await onUnfollow(session, event);
      break;
    case 'join':
      await onJoin(session, event);
      break;
    case 'leave':
      await onLeave(session, event);
      break;
    case 'postback':
      await onPostback(session, event);
      break;
    case 'beacon':
      await onBeacon(session, event);
      break;
    default:
      break;
  }
}

const onText = async(session, event) => {
  await sendMessage(session, event.message.text);
}

const onImage = async (session, event) => {
  if (session.file) {
    await uploadFile(session, event.content);
    session.file = null;
    await updateSessionFile(session);
  } else {
    await sendMessage(session, event.content.url);
  }
}

const onVideo = async(session, event) => {
   await sendMessage(session, event.content.url);
}

const onAudio = async(session, event) => {
   await sendMessage(session,  event.content.url);  
}

function onLocation(session, event) {}

function onSticker(session, event) {}

function onFollow(session, event) {}

function onUnfollow(session, event) {}

function onJoin(session, event) {}

function onLeave(session, event) {}

function onPostback(session, event) {}

const sendMessage = async (session, text) => {
  var session = await incrementSessionSequence(session);
  var request = require("request");
  var options = {
    url: "https://" + process.env.LIVEAGENT_POD + "/chat/rest/Chasitor/ChatMessage",
    headers: {
      "X-LIVEAGENT-API-VERSION": process.env.LIVEAGENT_API_VERSION,
      "X-LIVEAGENT-SESSION-KEY": session.key,
      "X-LIVEAGENT-SEQUENCE": session.sequence,
      "X-LIVEAGENT-AFFINITY": session.affinity
    },
    json: true,
    body: {
      text: text
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async (error, response, body) => {
      if (response.statusCode === 409) {
        session.sequence = Number(body.match(/\d+/g)[1]);
        await updateSessionSequence(session);
        reject(body);
      }
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}

const uploadFile = (session, content) => {
  var request = require("request");
  var query = "?orgId=" + process.env.LIVEAGENT_ORGANIZATION_ID;
  query += "&chatKey=" + session.key.slice(0, session.key.indexOf("!"));
  query += "&fileToken=" + session.file.fileToken;
  query += "&encoding=UTF-8";

  var options = {
    url: session.file.uploadServletUrl + query,
    headers: {
      Referer: session.file.cdmServletUrl,
      "User-Agent": USER_AGENT
    },
    formData: {
      filename: content.filename,
      file: {
        value: content.data,
        options: {
          filename: content.filename,
          contentType: content.type
        }
      }
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, function(error, response, body) {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    }).on('data', function(chunk) {
      console.log("sending");
    });
  });
}

function log(message) {
  console.log(message);
}


var DB = require('../../db/mongodb');
var COLLECTION_NAME = 'LIVEAGENT';
const initSession = async (session) => {
  return (await DB.collection(COLLECTION_NAME).insertOne(session)).ops[0];
}
const incrementSessionSequence = async (session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({id: session.id}, {$inc: {sequence: 1}}, {returnOriginal: true })).value;
}
const updateSessionSequence = async(session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({id: session.id}, {$set: {sequence: session.sequence}}, {returnOriginal: true})).value;
}
const getSession = (sessionId) => {
  return DB.collection(COLLECTION_NAME).find({'id': sessionId}).limit(1).next();
}
const updateSessionFile = async(session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({id: session.id}, {$set: {file: session.file}}, {returnOriginal: false})).value;
}
const deleteSession = async (sessionId) => {
  return await DB.collection(COLLECTION_NAME).deleteOne({'id': sessionId});
}
