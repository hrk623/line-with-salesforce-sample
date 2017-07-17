const jwt = require('jsonwebtoken');
const SERVICE = require('../../common/constants').SERVICE;
const ROUTERACTION = require('../../common/constants').ROUTERACTION;
const Router = require('../router');

const STATE = {
  PICK_MODE: '0',
  PREDICT: '1',
  TRAINER_PICK_TRAIN_MODE: '2',
  TRAINER_DOCUMENT: '3',
  TRAINER_LABEL: '4',
  TRAINER_TRAINING: '5',
};

const POSTBACK = {
  PICK_MODE_PREDICT: '0',
  PICK_MODE_TRAINER: '1',
  TRAINER_PICK_TRAIN_MODE_TRAINING: '2',
  TRAINER_PICK_TRAIN_MODE_ADD_EXAMPLE: '3',
  BACK: '4',
};

exports.initService = async() => {
  info('INTENT:initService:データセットの取得');
  debug('INTENT:initService:datasets');
  const datasets = await getAllDatasets();
  debug(datasets);

  let  models = [];
  info('INTENT:initService:モデルの取得');
  debug('INTENT:initService:models');
  for (let dataset of datasets) {
    models = models.concat(await getAllModels(dataset.id));
  }
  debug(models);

  const id = (new Date()).getTime();
  const name = 'INTENT';
  return await initInstance(id, name, datasets, models);
}

exports.processEvent = async(event) => {
  info('INTENT:processEvent:イベントを受け取り');

  const instance = await getInstance(event.terminal.id);
  switch (event.type) {
    case 'message':
      switch (event.message.type) {
        case 'text':
          info('INTENT:processEvent:textイベントを処理');
          onText(instance, event);
          break;
        default:
          break;
      }
      break;
    case 'postback':
      info('INTENT:processEvent:postback イベントを処理');
      onPostback(instance, event);
      break;
    default:
      break;
  }
}

exports.getBaton = async(id) => {
  info('INTENT:getBaton:バトンの取得');
  const transcript = await getTranscript(id);
  return {
    message: {
      type: 'text',
      text: transcript
    }
  };
}


const createEvent = (instance, type, message) => {
  const e = {
    type: type,
    origin: {
      id: instance.id,
      name: instance.name,
      service: SERVICE.INTENT,
    },
    message: message,
  }
  return e;
}

const onText = async(instance, event) => {
  const state = instance.state;
  if (state === STATE.PICK_MODE) {
    event = createEvent(instance, 'message', {
      type: 'template',
      altText: 'モードを選択',
      template: {
        type: 'buttons',
        thumbnailImageUrl: process.env.BASE_URL + '/asset/img/aaaa.png',
        title: '実行モードを選択',
        text: 'Einstein Intent にようこそ！文章を解析するか、モデルの作成や例文の追加を行うか選んでください。',
        actions: [{
          type: 'postback',
          label: '解析する',
          data: POSTBACK.PICK_MODE_PREDICT
        }, {
          type: 'postback',
          label: 'モデルをトレーニングする',
          data: POSTBACK.PICK_MODE_TRAINER
        }]
      }
    });
    await Router.processEvent(event);

  } else if (state === STATE.PREDICT && event.message.text === 'end') {
    instance = await updateInstanceState(instance, STATE.PICK_MODE);
    onText(instance, event);
  } else if (state === STATE.PREDICT) {
    debug('INTENT:onText:translatedText:');
    const translatedText = await translate(event.message.text);
    debug(translatedText);
    const probabilities = await getIntent(instance.models[0].modelId, translatedText);

    const text = (probabilities.length > 0 ? Math.floor(probabilities[0].probability * 100) + '% ' + probabilities[0].label : '')
    + (probabilities.length > 1 ? '\n' + Math.floor(probabilities[1].probability * 100) + '% ' + probabilities[1].label : '')
    + (probabilities.length > 2 ? '\n' + Math.floor(probabilities[2].probability * 100) + '% ' + probabilities[2].label : '');

    await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: text}));
  } else if (state === STATE.TRAINER_DOCUMENT) {
    info('INTENT:onText:例文を追加');
    const translatedText = await translate(event.message.text);
    instance = await updateInstanceCurrentDocument(instance, translatedText);
    instance = await updateInstanceState(instance, STATE.TRAINER_LABEL);
    await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: '例文の紐付けたいラベルを送信してください。'}));
  } else if (state === STATE.TRAINER_LABEL) {
    info('INTENT:onText:ラベルを追加');
    await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: event.message.text + ': ' + instance.document}));
    debug('INTENT:onText:instance:');
    instance = await updateInstanceAppendExample(instance, event.message.text, instance.document);
    debug(JSON.stringify(instance));
    instance = await updateInstanceState(instance, STATE.PICK_MODE);
    event.postback = {data: POSTBACK.PICK_MODE_TRAINER};
    onPostback(instance, event);
  }

}




const onPostback = async(instance, event) => {
  const data = event.postback.data;
  if (instance.state === STATE.PICK_MODE && data === POSTBACK.PICK_MODE_PREDICT) {
    if (instance.models.length > 0) {
      instance = await updateInstanceState(instance, STATE.PREDICT);
      await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: 'Einstein Intent を開始します。何かメッセージを送信してください。'}));
      await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: '終了する場合は「end」と送信してください。'}));
    } else {
      event = createEvent(instance, 'message', {
        type: 'text',
        text: '学習済みのモデルが存在しません。Einstein Intent を開始するにはモデルを作成してください。'
      });
      await Router.processEvent(event);
      onText(instance, event);
    }
  } else if (instance.state === STATE.PICK_MODE && data === POSTBACK.PICK_MODE_TRAINER) {
    debug('INTENT:onPostback:instance:');
    instance = await updateInstanceState(instance, STATE.TRAINER_PICK_TRAIN_MODE);
    debug(instance);

    debug('INTENT:onPostback:event:');
    event = createEvent(instance, 'message', {
      type: 'template',
      altText: 'トレーナーモードを選択',
      template: {
        type: 'buttons',
        thumbnailImageUrl: process.env.BASE_URL + '/asset/img/aaaa.png',
        title: 'トレーナーモードを選択',
        text: 'データセットに例文を追加するか、モデルのトレーニングを開始するか選んでください。',
        actions: [{
          type: 'postback',
          label: '例文を追加',
          data: POSTBACK.TRAINER_PICK_TRAIN_MODE_ADD_EXAMPLE
        }, {
          type: 'postback',
          label: 'トレーニングを開始',
          data: POSTBACK.TRAINER_PICK_TRAIN_MODE_TRAINING
        }, {
          type: 'postback',
          label: '戻る',
          data: POSTBACK.BACK
        }]
      }
    });
    debug(event);

    Router.processEvent(event);
  } else if (instance.state === STATE.TRAINER_PICK_TRAIN_MODE && data === POSTBACK.BACK) {
    instance = await updateInstanceState(instance, STATE.PICK_MODE);
    onText(instance, event);
  } else if (instance.state === STATE.TRAINER_PICK_TRAIN_MODE && data === POSTBACK.TRAINER_PICK_TRAIN_MODE_TRAINING) {
    info('トレーニング開始の準備中');

    debug('INTENT:onPostback:instance:');
    instance = await updateInstanceState(instance, STATE.TRAINER_PICK_TRAIN_MODE_TRAINING);


    event = createEvent(instance, 'message', {
      type: 'text',
      text: 'トレーニング開始の準備をしています。'
    });
    await Router.processEvent(event);

    debug('INTENT:onPostback:datasets:');
    let datasets = instance.datasets
    debug(datasets);

    if (datasets.length === 0) {
      info('新規データセットを作成します');
      event = createEvent(instance, 'message', {
        type: 'text',
        text: '新規データセットを作成します。'
      });
      await Router.processEvent(event);

      debug('INTENT:onPostback:result:');
      const result = await createDataset();
      debug(result);

      if (result.statusMsg === 'SUCCEEDED') {

        debug('INTENT:onPostback:datasets:');
        datasets = await getAllDatasets();
        debug(datasets);

        debug('INTENT:onPostback:instance:');
        instance = await updateInstanceDatasets(instance, datasets);
        debug(instance);
      } else {
        return;
      }
    }

    if (instance.example) {
      await createExamples(datasets[0].id, instance.example);
    }

    const models = instance.models
    let result = {
      modelId: ''
    };
    if (models.length === 0) {
      info('新規モデルでトレーニングを開始します');
      await Router.processEvent(createEvent(instance, 'message', {
        type: 'text',
        text: '新規モデルでトレーニングを開始します。'
      }));

      debug('INTENT:onPostback:result:');
      result = await trainDataset(datasets[0].id, instance.example);
      debug(result);

    } else {
      info('既存モデルでトレーニングを開始します');
      debug('INTENT:onPostback:result:');
      result = await retrainModel(models[0].modelId, instance.example);
      debug(result);

      await Router.processEvent(createEvent(instance, 'message', {
        type: 'text',
        text: '再トレーニングを開始します。'
      }));
    }
    await Router.processEvent(createEvent(instance, 'message', {
      type: 'text',
      text: 'この処理には数分かかる可能性があります。'
    }));

    const intervalId = setInterval(async function() {
      info('トレーニング完了をまっています');
      debug('INTENT:onPostback:result:');
      result = await getTrainingStatus(result.modelId);
      debug(result);

      if (result.status === 'SUCCEEDED' && result.progress === 1) {
        const models = await getAllModels(result.datasetId)
        instance = await updateInstanceModels(instance, models);
        await Router.processEvent(createEvent(instance, 'message', {
          type: 'text',
          text: 'トレーニングが完了しました。'
        }));
        instance = await updateInstanceState(instance, STATE.PICK_MODE);
        onText(instance, event);
        clearInterval(intervalId);
      } else if (result.status === 'FAILED') {
        await Router.processEvent(createEvent(instance, 'message', {
          type: 'text',
          text: 'トレーニングが失敗しました。:' + result.failureMsg
        }));
        instance = await updateInstanceState(instance, STATE.PICK_MODE);
        onText(instance, event);
        clearInterval(intervalId);
      }
    }, 30000);


  } else if (instance.state === STATE.TRAINER_PICK_TRAIN_MODE && data === POSTBACK.TRAINER_PICK_TRAIN_MODE_ADD_EXAMPLE) {
    instance = await updateInstanceState(instance, STATE.TRAINER_DOCUMENT);
    await Router.processEvent(createEvent(instance, 'message', {type: 'text',text: '追加したい例文を送信してください。例文に紐付けたいラベルは、まだ送信しないでください。'}));
  }
}

const getIntent = async(modelId, text) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
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


const getAllDatasets = async() => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/datasets",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
    },
    json: true
  };
  return new Promise((resolve, reject) => {
    request.get(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.data);
      }
    });
  });
}

const getAllModels = async(datasetId) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }
console.log(datasetId);
  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/datasets/" + datasetId + "/models",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
    },
    json: true
  };
  return new Promise((resolve, reject) => {
    request.get(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.data);
      }
    });
  });
}



const createDataset = async() => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/datasets/upload/sync",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'path': process.env.BASE_URL + '/asset/data/sample.json',
      'type': 'text-intent'
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}

const createExamples = async(datasetId, exampleJson) => {
  debug('INTENT:createExamples:relativePath');
  const relativePath = '/asset/data/'+datasetId+'.json'
  debug(relativePath);

  const fs = require("fs");
  const path = require('path')
  const jsonPath = path.join(__dirname, '..', '..', 'public', 'asset', 'data', datasetId +'.json');
  fs.writeFileSync(jsonPath, JSON.stringify(exampleJson), "utf8");

  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }


const url = "https://api.einstein.ai/v2/vision/language/"+datasetId+"/upload";
  console.log(url);
  console.log(process.env.EINSTEIN_TOKEN);

  const request = require("request");
  const options = {
    url: url,
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'path': process.env.BASE_URL + '/asset/data/'+datasetId+'.json',
    }
  };
  return new Promise((resolve, reject) => {
    request.put(options, async(error, response, body) => {
      console.log(body);
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}


const trainDataset = async (datasetId, example) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/train",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'name': 'sample',
      'datasetId': datasetId,
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}

const retrainModel = async (modelId,example) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/retrain",
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    formData: {
      'modelId': modelId,
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}

const getTrainingStatus = async(modelId) => {
  if (!(await isTokenValid(process.env.EINSTEIN_TOKEN))) {
    process.env.EINSTEIN_TOKEN = await initToken();
  }

  const request = require("request");
  const options = {
    url: "https://api.einstein.ai/v2/language/train/" + modelId,
    proxy: process.env.FIXIE_URL,
    headers: {
      'Authorization': 'Bearer ' + process.env.EINSTEIN_TOKEN,
      'Cache-Control': 'no-cache',
    },
    json: true
  };
  return new Promise((resolve, reject) => {
    request.get(options, async(error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body);
      }
    });
  });
}


const initToken = () => {
  const now = Math.floor(new Date().getTime() / 1000);
  const payload = {
    sub: process.env.EINSTEIN_VISION_ACCOUNT_ID,
    aud: 'https://api.einstein.ai/v2/oauth2/token',
    exp: now + 86400
  };

  const assertion = jwt.sign(payload, process.env.EINSTEIN_VISION_PRIVATE_KEY, {
    algorithm: 'RS256'
  });

  const request = require("request");
  const options = {
    url: 'https://api.einstein.ai/v2/oauth2/token',
    proxy: process.env.FIXIE_URL,
    json: true,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + assertion
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




const translate = (text) => {
  const request = require("request");
  const options = {
    url: 'https://translation.googleapis.com/language/translate/v2' + '?key=' + process.env.GOOGLE_TRANSLATEAPI_TOKEN + '&source=ja&target=en' + '&q=' + encodeURI(text),
    proxy: process.env.FIXIE_URL,
    json: true,
  };
  return new Promise((resolve, reject) => {
    request.get(options, (error, response, body) => {
      if (error || response.statusCode != 200) {
        reject(body);
      } else {
        resolve(body.data.translations[0].translatedText);
      }
    });
  });
}

const info = (message) => {
  console.log(message);
}
const debug = (message) => {
  console.log(message);
}







const DB = require('../../db/mongodb');
const COLLECTION_NAME = 'INTENT';
const initInstance = async(id, name, datasets, models) => {
  return (await DB.collection(COLLECTION_NAME).insertOne({
    id: id,
    name: name,
    datasets: datasets,
    models: models,
    state: STATE.PICK_MODE,
    document: null,
    example: null,
  })).ops[0];
}

const getInstance = (id) => {
  return DB.collection(COLLECTION_NAME).find({
    'id': id
  }).limit(1).next();
}
const updateInstanceDatasets = async(instance, datasets) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    id: instance.id
  }, {
    $set: {
      datasets: datasets
    }
  }, {
    returnOriginal: false
  })).value;
}
const updateInstanceModels = async(instance, models) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    id: instance.id
  }, {
    $set: {
      models: models
    }
  }, {
    returnOriginal: false
  })).value;
}
const updateInstanceState = async(instance, state) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    id: instance.id
  }, {
    $set: {
      state: state
    }
  }, {
    returnOriginal: false
  })).value;
}
const updateInstanceCurrentDocument = async(instance, document) => {
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    id: instance.id
  }, {
    $set: {
      document: document
    }
  }, {
    returnOriginal: false
  })).value;
}
const updateInstanceAppendExample = async(instance, label, document) => {
  let example = instance.example;
  if (!example) example = {intents: {}};
  if (example.intents[label]) intents[label].push(document);
  else example.intents[label] = [document];
  return (await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    id: instance.id
  }, {
    $set: {
       document: null,
      'example': example
    }
  }, {
    returnOriginal: false
  })).value;
}

const appendTranscript = async(instance, scriptText, speaker) => {
  const transcript = (await DB.collection(COLLECTION_NAME).find({
    'id': instance.id
  }).limit(1).next()).transcript || '';
  transcript += '\n' + speaker + ': ' + scriptText;
  await DB.collection(COLLECTION_NAME).findOneAndUpdate({
    'id': instance.id
  }, {
    $set: {
      transcript: transcript
    }
  });
}
const getTranscript = async(instance) => {
  return (await DB.collection(COLLECTION_NAME).find({
    'id': instance.id
  }).limit(1).next()).transcript;
}
