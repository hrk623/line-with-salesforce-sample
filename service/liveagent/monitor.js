const Router = require('../../common/constants').SERVICES.ROUTER;

exports.startLiveAgentSessionMonitor = () => {
  setInterval(async () => {
    const sessions = await getNewSessions();

    for (let session of sessions) {
      info('LIVEAGENT:startLiveAgentSessionMonitor:セッション[' + session.id + '] に対するイベントループ開始');
      monitorChatActivity(session.id);
    }
  }, 3000);
}

const monitorChatActivity = async (sessionId) => {
  debug('LIVEAGENT:monitorChatActivity:[' + sessionId + ']:session');
  var session = await getSession(sessionId);
  debug(session);

  if (!session) return;

  session.ack = session.ack === undefined ? -1 : session.ack;
  var request = require("request");
  var options = {
    url: "https://" + process.env.LIVEAGENT_POD + "/chat/rest/System/Messages",
    qs: {
      ack: session.ack
    },
    headers: {
      "X-LIVEAGENT-API-VERSION": process.env.LIVEAGENT_API_VERSION,
      "X-LIVEAGENT-SESSION-KEY": session.key,
      "X-LIVEAGENT-AFFINITY": session.affinity
    },
    json: true
  };
  request.get(options, async (error, response, body) => {
    if (response.statusCode === 204) {
      monitorChatActivity(session.id);
    } else if (response.statusCode === 200) {
      session.ack = body.sequence;
      session = await updateSessionAck(session);
      body.messages.forEach(function(message) {
        processMessage(session, message);
      });
      monitorChatActivity(session.id);
    } else {
      endMonitorChatActivity(session.id);
    }
  });
}

const endMonitorChatActivity = async (session) => {
  info('LIVEAGENT:endMonitorChatActivity:セッション[' + session.id + '] に対するイベントモニタリングを終了');
  await deleteSession(session.id);
}

const processMessage = (session, message) => {
  switch (message.type) {
    case "ChatMessage":
      onChatMessage(session, message);
      break;
    case "AgentTyping":
      onAgentTyping(session);
      break;
    case "AgentNotTyping":
      onAgentNotTyping(session);
      break;
    case "AgentDisconnect":
      onAgentDisconnect(session);
      break;
    case "ChasitorSessionData":
      onChasitorSessionData(session);
      break;
    case "ChatEnded":
      onChatEnded(session);
      break;
    case "ChatEstablished":
      onChatEstablished(session);
      break;
    case "ChatRequestFail":
      onChatRequestFail(session);
      break;
    case "ChatRequestSuccess":
      onChatRequestSuccess(session);
      break;
    case "ChatTransferred":
      onChatTransferred(session);
      break;
    case "CustomEvent":
      onCustomEvent(session);
      break;
    case "NewVisitorBreadcrumb":
      onNewVisitorBreadcrumb(session);
      break;
    case "QueueUpdate":
      onQueueUpdate(session);
      break;
    case "FileTransfer":
      onFileTransfer(session, message);
      break;
    case "Availability":
      onAvailability(session);
      break;
    default:
      break;
  }
}

const onChatMessage = async(session, message) => {
  info('LIVEAGENT:onChatMessage:オペレーターからメッセージを受信');
  await Router.processEvent(createEvent(session, 'message', {type: 'text',text: message.message.text}));
}
const onAgentTyping = async(session) => {}
const onAgentNotTyping = async(session) => {}
const onAgentDisconnect = async(session) => {
  info('LIVEAGENT:onAgentDisconnect:オペレーターとの接続が切断');
  await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータとの接続が切断しました。'}));
  endMonitorChatActivity(session);
}
const onChasitorSessionData = async(session) => {}
const onChatEnded = async(session) => {
  info('LIVEAGENT:onChatEnded:オペレータがチャットを終了');
  await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータがチャットを終了しました。'}));
  endMonitorChatActivity(session);
}
const onChatEstablished = async(session) => {
  info('LIVEAGENT:onChatEstablished:オペレータと接続');
   await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータと接続されました。'}));
}
const onChatRequestFail = async(session) => {
  info('LIVEAGENT:onChatRequestFail:現在対応可能なオペレータがいません');
  await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] 現在対応可能なオペレータがいません。'}));
  endMonitorChatActivity(session);
}
const onChatRequestSuccess = async(session) => {
  info('LIVEAGENT:onChatRequestSuccess:オペレータを呼び出しています');
  await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータを呼び出しています。'}));
}
const onChatTransferred = async(session) => {}
const onCustomEvent = async(session) => {}
const onNewVisitorBreadcrumb = async(session) => {}
const onQueueUpdate = async(session) => {}
const onFileTransfer = async(session, message) => {
  if (message.message.type === 'Requested') {
    info('LIVEAGENT:onFileTransfer:オペレータをファイル送信を許可');
    var session = await getSession(session.id);
    session.file = message.message
    await updateSessionFile(session);
    await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータが画像ファイル1枚の送信を許可しました。'}));
  } else if (message.message.type === 'Canceled') {
    info('LIVEAGENT:onFileTransfer:オペレータをファイル送信の許可を取り消し');
    var session = await getSession(session.id);
    session.file = null;
    await updateSessionFile(session);
    await Router.processEvent(createEvent(session, 'message', {type: 'text',text: '[自動送信] オペレータがファイル送信の許可を取り消しました。'}));
  }
}

const onAvailability = () => {}

const createEvent = (session, type, message) => {
  info('LIVEAGENTMONITOR:createEvent:イベントを作成');
  debug('LIVEAGENTMONITOR:createEvent:event');
  var event = {
    type: type,
    origin: {
      id: session.id,
      name: session.name,
      service: session.service,
    },
    message: message
  };
  debug(event);
  return event;
}


const info = (message) => {
  console.log(message);
}
const debug = (message) => {
  //console.log(message);
}


var DB = require('../../db/mongodb');
var COLLECTION_NAME = 'LIVEAGENT';
const updateSession = async(session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({'id': session.id}, {$set: session})).value;
}
const updateSessionAck = async (session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({'id': session.id}, {$set: {ack: session.ack}}, {returnOriginal: false})).value;
}
const updateSessionFile = async(session) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({id: session.id}, {$set: {file: session.file}}, {returnOriginal: false})).value;
}

const getNewSessions = () => {
  return DB.collection(COLLECTION_NAME).find({ack: undefined}).toArray();
}

const getSession = (sessionId) => {
  return DB.collection(COLLECTION_NAME).find({id: sessionId}).limit(1).next();
}
const deleteSession = async(sessionId) => {
  return await DB.collection(COLLECTION_NAME).deleteOne({id: sessionId});
}
