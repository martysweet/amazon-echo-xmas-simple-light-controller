/**
 * App ID for the skill
 */
var APP_ID = undefined; //OPTIONAL: replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');
var AWS = require("aws-sdk");
var iotdata = new AWS.IotData({endpoint: 'data.iot.eu-west-1.amazonaws.com'});
var thingName = 'XMAS';
var currentDesired;
const UPPER_MODE_LIMIT = 7;

/**
 * Setup child
 */
var Xmas = function (callback) {
    getThingShadow(callback);
};

/**
 * Gets the thing shadow for the device
 * @param callback
 */
function getThingShadow(callback){
    var params = {
        "thingName": thingName /* required */
    };
    iotdata.getThingShadow(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     {
            console.log(data);
            currentDesired = JSON.parse(data['payload'])['state']['desired'];
            AlexaSkill.call(this, APP_ID);
            callback();
        }
    });
}

// Extend AlexaSkill
Xmas.prototype = Object.create(AlexaSkill.prototype);
Xmas.prototype.constructor = Xmas;

Xmas.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    //console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

Xmas.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    //console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    //handleNewFactRequest(response);
};

Xmas.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    //console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

/**
 * Intent Handler
 */
Xmas.prototype.intentHandlers = {
    "TurnDeviceOn": function (intent, session, response) {
        changeDevicePowerState(response, 'ON');
    },

    "TurnDeviceOff": function (intent, session, response) {
        changeDevicePowerState(response, 'OFF');
    },

    "ChangeMode": function (intent, session, response) {
        changeMode(response, intent);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can say...");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

/**
 * Turn the lights on or off
 * @param response
 * @param state
 */
function changeDevicePowerState(response, state){

    var callback;
    var value;
    var currentValue = currentDesired['power'];

    // If we are asking it to be off, and it already is, assume Alexa has
    // heard it wrong, and turn the device on
    // NOTE: YOU MAY WANT TO DISABLE THIS HACK
    if(state == 'OFF' && currentValue == 0){
        state = 'ON';
    }

    // Form message
    var message = 'Turning the lights ' + state;

    // Set the value
    if(state == 'ON') {
        value = 1;
    }else{
        value = 0;
    }

    // Set the callback
    callback = function(){response.tell(message);};

    // Send message
    updateIotShadow({"power": value}, callback);
}

/**
 * Set the mode depending on the users SlotType values.
 * @param response
 * @param intent
 */
function changeMode(response, intent){
    var desired = intent['slots']['LightMode']['value'];
    var value = 0;
    switch(desired){
        case 'combination':
            value = 0;
            break;
        case 'steady on':
            value = 1;
            break;
        case 'in wave':
            value = 2;
            break;
        case 'twin light chasing':
            value = 3;
            break;
        case 'twinkle flashing':
            value = 4;
            break;
        case 'slow glow':
            value = 5;
            break;
        case 'stepping on':
            value = 6;
            break;
        case 'slow fade':
            value = 7;
            break;
        case 'next':
            value = increaseMode();
            break;
        case 'last':
            value = decreaseMode();
            break;
        case '0': case '1': case '2': case '3':
        case '4': case '5': case '6': case '7':
            value = desired;
            break;
        default:
            console.log("Unhandled Mode Request: " + desired);
            break;
    }

    updateIotShadow({"power": 1, "mode": value}, function(){successfulChange(response)});

}

/**
 * Decrease the mode from the current mode value
 */
function decreaseMode(){
    var x = currentDesired["mode"] - 1;
    if(x < 0){
        return UPPER_MODE_LIMIT;
    }else{
        return x;
    }
}

/**
 * Increase the mode from the current mode value
 */
function increaseMode(){
    var x = currentDesired["mode"] + 1;
    if(x > UPPER_MODE_LIMIT){
        return 0;
    }else{
        return x;
    }
}

/**
 * If a change has been acknowledged, can be expanded
 * to have an array of responses to add variety.
 */
function successfulChange(response){
    response.tell('Merry Christmas!');
}

/**
 * Send a message to Xmas
 */
function updateIotShadow(json, callback){
    var params = {
        payload: JSON.stringify({"state": { "desired": json} }), /* required */
        thingName: thingName /* required */
    };
    iotdata.updateThingShadow(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     callback();          // successful response
    });

}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the SpaceGeek skill.
    var bob = new Xmas(function(){
        // Calls context succeed
        bob.execute(event, context);
    });
};
