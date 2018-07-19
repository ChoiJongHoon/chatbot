/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request');

var mysql = require('mysql');
var utf8 = require('utf8');
var async = require('async');


var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({
  verify: verifyRequestSignature
}));
app.use(express.static('public'));

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

console.log("하이");

function db_insert_message(usernum, usermess) {

  var connection_message = mysql.createConnection({
    user: 'freeday',
    password: '',
    database: 'chat'
  });

  var usern = usernum;
  var userm = usermess;
  var quary = [
    //[utf8.encode(usern), utf8.encode(userm)]
    [usern, userm]
  ];

  console.log('usernum의 타입은 : ', typeof(usernum), ' 이고 ', '123의 타입은 : ', typeof('123'), ' 이다.');
  connection_message.connect();
  connection_message.query('INSERT INTO message(usernumber, usermessage) VALUES ?', [quary], function(err, rows, fields) {
    if (!err) {
      console.log('message 테이블에 값이 들어갔습니다.');
    }
    else {
      console.log('message 테이블에 값이 못들어갔습니다. Errow : ', err);
    }
  });
  connection_message.end();
}

// function db_collect_select(message) {

//   var mess = message;
//   var db_mess = "";

//   var connection_message = mysql.createConnection({
//     user : 'freeday',
//     password : '',
//     database : 'chat'
//   });

//   connection_message.connect();

//   connection_message.query('SELECT * from message', (err, rows, fields) => {

//       if(!err){
//         console.log('The solution is : ', rows);
//         //console.log(rows[0].study);
//         //console.log(rows[1].study);


//         console.log('DB의 길이는 : ' + rows.length );

//         /*for(var i = 0; i < rows.length; i++){
//           console.log(rows[i].usernumber);
//           console.log(rows[i].usermessage);
//         }*/
//         console.log("최종훈 rows[rows.length-2].usermessage 은" + rows[rows.length-2].usermessage);
//         db_mess = rows[rows.length-2].usermessage;
//         console.log("콜백함수안의 db_mess의 값은? ",db_mess);

//       }
//       else{
//         console.log('Errow : ', err);
//       }
//     }); 
//     connection_message.end();
//   console.log(db_mess, " db_mess");
//   console.log(mess, " mess");

//   if(mess == db_mess) {
//     console.log("db_mess의 값은? ",db_mess);
//     return true;
//   }
//   else { 
//     return false;
//   }
// };

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}



function setupGetStartedButton(res) {
  var messageData = {
    "get_started": [{
      "payload": "USER_DEFINED_PAYLOAD"
    }]
  };

  // Start the request
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      form: messageData
    },
    function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // Print out the response body
        res.send(body);
      }
      else {
        // TODO: Handle errors
        res.send(body);
      }
    }
  );
}

// app.get('/setup',function(req, res) {

//   setupGetStartedButton(res);
// });

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
    //setupGetStartedButton(res);
  }
  else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function(req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        }
        else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        }
        else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        }
        else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        }
        else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        }
        else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        }
        else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  }
  else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;


  console.log('내가 받은 상대 아이디 넘버의 타입은 : ', typeof(event.sender.id));
  // senderID : 사용자의 아이디를 저장한다.
  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));
  console.log(JSON.stringify(message));
  console.log("메세지가 어떻게 생겼나요? : " + message.text);

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;
  }
  else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }


  db_insert_message(senderID, messageText);


  var mess = message;
  var db_mess = "1";
  var key = "";
  var connection_message = mysql.createConnection({
    user: 'freeday',
    password: '',
    database: 'chat'
  });

  // var count = 0;

  connection_message.connect();


  var select_sql = 'SELECT * FROM message WHERE usernumber = ' + senderID;
  connection_message.query(select_sql, (err, rows, fields) => {

    if (!err) {
      //console.log('The solution is : ', rows);
      //console.log(rows[0].study);
      //console.log(rows[1].study);


      console.log('DB의 길이는 : ' + rows.length);

      /*for(var i = 0; i < rows.length; i++){
        console.log(rows[i].usernumber);
        console.log(rows[i].usermessage);
      }*/
      console.log("최종훈 rows[rows.length-2].usermessage 은" + rows[rows.length - 2].usermessage);
      db_mess = rows[rows.length - 2].usermessage;
      console.log("콜백함수안의 db_mess의 값은? ", db_mess);

      key = db_mess;

      console.log("key값확" + key);
      console.log("1번");
      // count++;
    }

  });


  connection_message.end(function() {

    console.log(db_mess, " db_mess");
    console.log(mess, " mess 이건 어디있지");
    if (messageText) {

      console.log('db_mess는 ㅇㅁㅇㅇ : ', db_mess);
      // If we receive a text message, check to see if it matches any special
      // keywords and send back the corresponding example. Otherwise, just echo
      // the text we received.
      switch (messageText) {


        case "image1":
          {
            sendImageMessage(senderID, messageText);
            break;
          }

        case "1번":
        case "학과선택":
        case "동서대학교":
          sendTextMessage(senderID, messageText);
          break;

        case 'image':
          sendImageMessage(senderID);
          break;

        case 'gif':
          sendGifMessage(senderID);
          break;

        case 'audio':
          sendAudioMessage(senderID);
          break;

        case 'video':
          sendVideoMessage(senderID);
          break;

        case 'file':
          sendFileMessage(senderID);
          break;

        case "4번":
        case "컴퓨터공학부":
        case 'button':
        case "3번":
          sendButtonMessage(senderID, messageText);
          break;

        case "문미경":
        case "문미경교수님":
        case "문미경 교수님":
        case "사용가이드":
        case "사용 가이드":
        case "2번":
        case 'generic':
          sendGenericMessage(senderID, messageText);
          break;

        case 'receipt':
          sendReceiptMessage(senderID);
          break;

        case 'quick reply':
          sendQuickReply(senderID);
          break;

        case 'read receipt':
          sendReadReceipt(senderID);
          break;

        case 'typing on':
          sendTypingOn(senderID);
          break;

        case 'typing off':
          sendTypingOff(senderID);
          break;

        case 'account linking':
          sendAccountLinking(senderID);
          break;

        case "시작하기":
        case "시작 하기":
        case '리스트':
          sendListMessage(senderID, messageText);
          break;

        default:
          {
            sendTextMessage(senderID, messageText);
          }
      }
    }
    else if (messageAttachments) {
      sendTextMessage(senderID, "Message with attachment received");
    }

  });

  // console.log("3번");
  //   console.log('key',db_mess);
  //   console.log("4번");






  // var tasks = [
  //   function (callback) {
  //     connection_message.query('select * from message', function (err, row) {
  //           if (err) return callback(err);
  //           if (row.length == 0) return callback('No Result Error');
  //           callback(null, row[0]);
  //       })
  //   },
  //   function (reviews, callback) {
  //       fs.writeFile('insideout.txt', JSON.stringify(reviews), function (err) {
  //           if (err) return callback(err);
  //           callback(null)
  //       });
  //   }
  //   ];

  // if(mess == db_mess) {
  //   console.log("db_mess의 값은? ",db_mess);
  //   return true;
  // }
  // else { 
  //   return false;
  // }





}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  // sendTextMessage(senderID, payload);

  switch (payload) {

    case "국제관":
    case "어문관":
    case "산학협력관":
    case "응용공학관":
    case "보건의료관":
    case "전자정보관":
    case "국제협력관":
    case "uit":
      // sendImageMessage(senderID, payload);
      // break;


    case "1번":
    case "학과선택":
    case "동서대학교":
    case "다른건물":
      sendTextMessage(senderID, payload);
      break;

    case 'image':
      sendImageMessage(senderID);
      break;

    case 'gif':
      sendGifMessage(senderID);
      break;

    case 'audio':
      sendAudioMessage(senderID);
      break;

    case 'video':
      sendVideoMessage(senderID);
      break;

    case 'file':
      sendFileMessage(senderID);
      break;

    case "4번":
    case "컴퓨터공학부":
    case 'button':
    case "3번":
      sendButtonMessage(senderID, payload);
      break;

    case "문미경":
    case "문미경교수님":
    case "문미경 교수님":
    case "사용가이드":
    case "사용 가이드":
    case "2번":
    case 'generic':
    case "배달가능":
    case "배달불가능":
      sendGenericMessage(senderID, payload);
      break;

    case 'receipt':
      sendReceiptMessage(senderID);
      break;

    case 'quick reply':
      sendQuickReply(senderID);
      break;

    case 'read receipt':
      sendReadReceipt(senderID);
      break;

    case 'typing on':
      sendTypingOn(senderID);
      break;

    case 'typing off':
      sendTypingOff(senderID);
      break;

    case 'account linking':
      sendAccountLinking(senderID);
      break;

    case "끝":
    case "시작하기":
    case "시작 하기":
    case '리스트':
      sendListMessage(senderID, payload);
      break;

    default:
      {
        sendTextMessage(senderID, payload);
      }
  }
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendImageMessage(recipientId, messageText) {

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL //+ "/assets/uni_14.PNG"
        }
      }
    }
  };

  if (messageText == "uit") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_14_14_14.png";
  }
  else if (messageText == "국제관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_07.png";
  }
  else if (messageText == "어문관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_06.png";
  }
  else if (messageText == "산학협력관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_05.png";
  }
  else if (messageText == "응용공학관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_04.png";
  }
  else if (messageText == "보건의료관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_03.png";
  }
  else if (messageText == "전자정보관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_02.png";
  }
  else if (messageText == "국제협력관") {
    messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/uni_01.png";
  }

  callSendAPI(messageData);

}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + "/assets/allofus480.mov"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: SERVER_URL + "/assets/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {

  console.log("recipientId : " + recipientId + "임........");

  if (messageText == "동서대학교") {
    messageText = "http://www.dongseo.ac.kr/main/main.php" + " 입니다.";
  }
  // else if (messageText == "메뉴얼" || messageText == "시작하기") {
  //   messageText = "1. 교수님 위치 찾기\n2. 캠퍼스 지도\n3. 주위 맛집\n4. 공지사항\n번호를 입력하세요!!!!!\nex) 1번";
  // }
  else if (messageText == "1번") {
    messageText = "교수님 성함을 입력하세요!";
  }
  else if (messageText == "2번") {
    messageText = "건물 이름을 입력해주세요!!!\nex)uit";
  }
  // else if (messageText == "끝") {
  //   messageText = "다른 메뉴를 선택해주세요.\n1. 교수님 위치 찾기\n2. 캠퍼스 지도\n3. 주위 맛집\n4. 공지사항\nex)1번";
  // }
  else if (messageText == "다른교수") {
    messageText = "교수님 성함을 입력하세요!";
  }
  else if (messageText == "학과선택") {
    messageText = "학과를 선택해주세요!\nex)컴퓨터공학부";
  }
  else if (messageText == "다른건물") {
    messageText = "다른 건물을 입력해주세요!!";
  }

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Trigger Postback",
              payload: "DEVELOPER_DEFINED_PAYLOAD"
            },
            // {
            //   type: "phone_number",
            //   title: "Call Phone Number",
            //   payload: "+16505551234"
            // }, 
            {
              type: "postback",
              title: "동서대학교",
              //payload: "DEVELOPER_DEFINED_PAYLOAD"
              payload: "동서대학교"
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendButtonMessage(recipientId, messageText) {
  if (messageText == "4번") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "",
            buttons: [{
                type: "postback",
                title: "학부 선택하기",
                payload: ""
              }, {
                type: "web_url",
                url: "",
                title: "학내 공지사항"
              }, {
                type: "postback",
                title: "끝",
                payload: "끝"
              },
              // {
              //   type: "phone_number",
              //   title: "Call Phone Number",
              //   payload: "+16505551234"
              // }, 
              // {
              //   type: "postback",
              //   title: "동서대학교",
              //   //payload: "DEVELOPER_DEFINED_PAYLOAD"
              //   payload: "동서대학교"
              // }
            ]
          }
        }
      }
    };
  }
  else if (messageText == "컴퓨터공학부") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "",
            buttons: [{
              type: "web_url",
              url: "",
              title: "학내 공지사항"
            }, {
              type: "postback",
              title: "끝",
              payload: "끝"
            }]
          }
        }
      }
    };
  }
  else if (messageText == "3번") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "3가지 중 하나를 선택해주세요!!",
            buttons: [{
              type: "postback",
              title: "배달 가능",
              payload: "배달가능"
            }, {
              type: "postback",
              title: "배달 불가능",
              payload: "배달불가능"
            }, {
              type: "postback",
              title: "끝",
              payload: "끝"
            }]
          }
        }
      }
    };
  }

  if (messageText == "컴퓨터공학부") {
    messageData.message.attachment.payload.text = "2개의 버튼중 하나를 입력해주세요!!!";
    messageData.message.attachment.payload.buttons[0]['url'] = "http://uni.dongseo.ac.kr/computer";
    messageData.message.attachment.payload.buttons[0]['title'] = messageText + " 공지사항";
  }

  if (messageText == "4번") {
    messageData.message.attachment.payload.text = "3개의 버튼중 하나를 입력해주세요!!!";
    messageData.message.attachment.payload.buttons[0]['payload'] = "학과선택";
    messageData.message.attachment.payload.buttons[1]['url'] = "http://www.dongseo.ac.kr/08_board/board_01.php?bbs_id=webBoardA";
    //messageData.message.attachment.payload.buttons[1]['url'] = SERVER_URL + "/assets/instagram_logo.gif";
  }

  callSendAPI(messageData);
}
/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendListMessage(recipientId, messageText) {

  if (messageText == "시작하기" || messageText == "시작 하기" || messageText == "끝") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "list",
            top_element_style: "compact",
            elements: [{
                title: "1. 교수님 위치 찾기!!",
                //image_url: SERVER_URL + "/assets/pro_moon.PNG",
                subtitle: "교수님과 통화연결 및 이름, 전공 학과, 연구실, 연락처, E-mail을 알수있습니다.",
                buttons: [{
                  type: "postback",
                  title: " 1번 ",
                  payload: "1번",
                }]
              }, {
                title: "2. 캠퍼스 지도!!",
                //image_url: SERVER_URL + "/assets/pro_moon.PNG",
                subtitle: "캠퍼스의 위치를 확인할 수 있습니다. 다운로드 가능!!",
                buttons: [{
                  type: "postback",
                  title: " 2번 ",
                  payload: "2번",
                }]
              }, {
                title: "3. 주위 맛집",
                //image_url: SERVER_URL + "/assets/pro_moon.PNG",
                subtitle: "맛집의 위치, 통화 연결, 맛집 블로그를 알수있습니다.",
                buttons: [{
                  type: "postback",
                  title: " 3번 ",
                  payload: "3번",
                }]
              }, {
                title: "4. 공지 사항!!",
                //image_url: SERVER_URL + "/assets/pro_moon.PNG",
                subtitle: "학과별 공지사항, 학내 공지사항을 확인할 수 있습니다.",
                buttons: [{
                  type: "postback",
                  title: " 4번 ",
                  payload: "4번",
                }]
              }]
              // ,
              // buttons: [{
              //   title: "View More",
              //   type: "postback",
              //   payload: "payload"
              // }]
          }
        }
      }
    };
  }

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId, messageText) {

  if (messageText == "문미경교수님" || messageText == "문미경 교수님" || messageText == "문미경") {

    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
                title: "",
                subtitle: "",
                //item_url: "",               
                image_url: SERVER_URL,
                buttons: [{
                  type: "phone_number",
                  title: "전화 걸기",
                  payload: ""
                    // type: "web_url",
                    // url: "https://www.oculus.com/en-us/rift/",
                    // title: "Open Web URL"
                }, {
                  type: "postback",
                  title: "다른 교수님 찾기",
                  payload: "다른교수",
                }, {
                  type: "postback",
                  title: "끝",
                  payload: "끝",
                }],
              }
              // ,{
              //   title: "touch",
              //   subtitle: "Your Hands, Now in VR",
              //   item_url: "https://www.oculus.com/en-us/touch/",               
              //   image_url: SERVER_URL + "/assets/touch.png",
              //   buttons: [{
              //     type: "web_url",
              //     url: "https://www.oculus.com/en-us/touch/",
              //     title: "Open Web URL"
              //   }, {
              //     type: "postback",
              //     title: "Call Postback",
              //     payload: "Payload for second bubble",
              //   }]
              // }
            ]
          }
        }
      }
    };
  }
  else if (messageText == "사용가이드" || messageText == "사용 가이드") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: "Manual",
              subtitle: "매뉴얼 입니다.",
              //item_url: "",               
              image_url: SERVER_URL + "/assets/menual.PNG",
              buttons: [{
                  type: "postback",
                  title: "시작 하기",
                  payload: "시작 하기"
                    // type: "phone_number",
                    // title: "전화 걸기",
                    // payload: ""
                    // type: "web_url",
                    // url: "https://www.oculus.com/en-us/rift/",
                    // title: "Open Web URL"
                }
                // , {
                //   type: "postback",
                //   title: "다른 교수님 찾기",
                //   payload: "다른교수",
                // }, {
                //   type: "postback",
                //   title: "끝",
                //   payload: "끝",
                // }
              ],
            }, {
              title: "1. 교수님 위치 찾기!!",
              subtitle: "교수님과 통화연결 및 이름, 전공 학과, 연구실, 연락처, E-mail을 알수있습니다.",
              // item_url: "https://www.oculus.com/en-us/touch/",               
              image_url: SERVER_URL + "/assets/professor.PNG"
                // ,buttons: [{
                //   type: "web_url",
                //   url: "https://www.oculus.com/en-us/touch/",
                //   title: "Open Web URL"
                // }, {
                //   type: "postback",
                //   title: "Call Postback",
                //   payload: "Payload for second bubble",
                // }]
            }, {
              title: "2. 캠퍼스 지도!!",
              subtitle: "캠퍼스의 위치를 확인할 수 있습니다. 다운 가능!!",
              // item_url: "https://www.oculus.com/en-us/touch/",               
              image_url: SERVER_URL + "/assets/uni_basic_min.png"
            }, {
              title: "3. 주위 맛집!!",
              subtitle: "맛집의 위치, 통화 연결, 맛집 블로그를 알수있습니다.",
              // item_url: "https://www.oculus.com/en-us/touch/",               
              image_url: SERVER_URL + "/assets/goodfood.png"
            }, {
              title: "4. 공지 사항!!",
              subtitle: "학과별 공지사항, 학내 공지사항을 확인할 수 있습니다.",
              // item_url: "https://www.oculus.com/en-us/touch/",               
              image_url: SERVER_URL + "/assets/logo1.png"
            }]
          }
        }
      }
    };
  }
  else if (messageText == "2번") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: "UIT관",
              subtitle: "UIT관은 14번 건물입니다.",
              //item_url: SERVER_URL + "/assets/uni_14_14_14.png",
              //image_url: SERVER_URL + "/assets/uni_14_14_14.png",
              item_url: SERVER_URL + "/assets/uit.jpg",
              image_url: SERVER_URL + "/assets/uit.jpg",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "국제관",
              subtitle: "국제관은 7번 건물입니다.",
              //item_url: SERVER_URL + "/assets/uni_07.png",
              //image_url: SERVER_URL + "/assets/uni_07.png",
              item_url: SERVER_URL + "/assets/uni_07.jpg",
              image_url: SERVER_URL + "/assets/uni_07.jpg",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "어문관",
              subtitle: "어문관은 6번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_06.png",
              image_url: SERVER_URL + "/assets/uni_06.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "산학협력관",
              subtitle: "산학협력관은 5번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_05.png",
              image_url: SERVER_URL + "/assets/uni_05.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "응용공학관",
              subtitle: "응용공학관은 4번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_04.png",
              image_url: SERVER_URL + "/assets/uni_04.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "보건의료관",
              subtitle: "보건의료관은 3번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_03.png",
              image_url: SERVER_URL + "/assets/uni_03.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "전자정보관",
              subtitle: "전자정보관은 2번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_02.png",
              image_url: SERVER_URL + "/assets/uni_02.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }, {
              title: "국제협력관",
              subtitle: "국제협력관은 1번 건물입니다.",
              item_url: SERVER_URL + "/assets/uni_01.png",
              image_url: SERVER_URL + "/assets/uni_01.png",
              buttons: [{
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }]
          }
        }
      }
    };
  }
  else if (messageText == "배달가능") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: "불백",
              subtitle: "사진을 누르면 위치가 보입니다.",
              item_url: "http://map.naver.com/?eelng=&elng=1a0fb973e2f322dc28a4302a07bcc448&eelat=&elat=6a826e8a690ab58cc6f841c6004081c4&eText=%EB%B6%88%EB%B0%B1",
              image_url: SERVER_URL + "/assets/boolback.PNG",
              buttons: [{
                type: "phone_number",
                title: "전화 걸기",
                payload: "0518961180",
              }, {
                type: "web_url",
                title: "블로그",
                url: "http://blog.naver.com/bullback1",
              }, {
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            },{
              title: "돈스떼끼",
              subtitle: "사진을 누르면 위치가 보입니다.",
              item_url: "http://map.naver.com/?elng=65141218c88a53c00a8736dde9616344&eelat=&elat=db859db1385deff814d7506ac200351d&eText=%EB%8F%88%EC%8A%A4%EB%96%BC%EB%81%BC&eelng=",
              image_url: SERVER_URL + "/assets/donse.png",
              buttons: [{
                type: "phone_number",
                title: "전화 걸기",
                payload: "05078932909",
              }, {
                type: "web_url",
                title: "블로그",
                url: "http://blog.naver.com/jieunsan0324/220971711916",
              }, {
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }]
          }
        }
      }
    };
  }
  else if (messageText == "배달불가능") {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: "황금룡",
              subtitle: "사진을 누르면 위치가 보입니다.",
              item_url: "http://map.naver.com/?eelng=&elng=b2d538cb4f0c97ef19f1f0630ff0d383&eelat=&elat=738f2badb0c4df3495faef5866bcfd58&eText=%ED%99%A9%EA%B8%88%EB%A3%A1",
              image_url: SERVER_URL + "/assets/goldendragon.png",
              buttons: [{
                type: "phone_number",
                title: "전화 걸기",
                payload: "0513120038",
              }, {
                type: "web_url",
                title: "블로그",
                url: "http://blog.naver.com/ekfr4353/220533917607",
              }, {
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            },{
              title: "꼬망",
              subtitle: "사진을 누르면 위치가 보입니다.",
              item_url: "http://map.naver.com/?eelng=&elng=ccba7ad2a30cb6d69679366a78a51950&eelat=&elat=ae1eafa67f301175a1e02326f64bbdf1&eText=%EA%BC%AC%EB%A7%9D",
              image_url: SERVER_URL + "/assets/gomang.png",
              buttons: [{
                type: "web_url",
                title: "블로그",
                url: "https://www.instagram.com/ggomangz/",
              }, {
                type: "postback",
                title: "끝",
                payload: "끝",
              }],
            }]
          }
        }
      }
    };
  }

  if (messageText == "문미경교수님" || messageText == "문미경 교수님" || messageText == "문미경") {
    messageData.message.attachment.payload.elements[0]['title'] = "문미경 교수님";
    messageData.message.attachment.payload.elements[0]['subtitle'] = "";
    //messageData.message.attachment.payload.elements[0]['item_url'] = "http://uni.dongseo.ac.kr/computer2/?pCode=1408524972";
    //messageData.message.attachment.payload.elements[0]['image_url'] = messageData.message.attachment.payload.elements[0]['image_url'] + "/assets/pro_moon.PNG";
    messageData.message.attachment.payload.elements[0]['image_url'] = messageData.message.attachment.payload.elements[0]['image_url'] + "/assets/pro_moon.jpg";
    //messageData.message.attachment.payload.elements[0]['image_url'] = messageData.message.attachment.payload.elements[0]['image_url'] + "/assets/uni_01.png";
    messageData.message.attachment.payload.elements[0].buttons[0]['payload'] = "0513201702";
    //messageData.message.attachment.payload['url'] = messageData.message.attachment.payload['url'] + "/assets/pro_moon.PNG";  
  }

  console.log("여기 왓나>?");

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random() * 1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What's your favorite movie genre?",
      quick_replies: [{
        "content_type": "text",
        "title": "Action",
        "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
      }, {
        "content_type": "text",
        "title": "Comedy",
        "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
      }, {
        "content_type": "text",
        "title": "Drama",
        "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
      }]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons: [{
            type: "account_link",
            url: SERVER_URL + "/authorize"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: messageData

  }, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s",
          messageId, recipientId);
      }
      else {
        console.log("Successfully called Send API for recipient %s",
          recipientId);
      }
    }
    else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;
