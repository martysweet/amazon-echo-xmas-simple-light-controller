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
    var message = 'Turning Xmas ' + state;
    var callback;
    var value;
    if(state == 'ON') {
        callback = function(){response.tell(message);};
        value = 1;
    }else{
        callback = function(){response.tell(message);};
        value = 0;
    }
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
        case 'slowly':
            value = 0;
            break;
        case 'next':
            value = increaseMode();
            break;
        case 'last':
            value = decreaseMode();
            break;
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7':
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
    return getModeInRange(x);
}

/**
 * Increase the mode from the current mode value
 */
function increaseMode(){
    var x = currentDesired["mode"] + 1;
    return getModeInRange(x);
}

/**
 * Ensure the mode is within the valid MODE range
 * @param x
 * @returns {*}
 */
function getModeInRange(x){
    if(x >= 0 && x <= UPPER_MODE_LIMIT){
        return x
    }else{
        // Maybe have nicer feedback if this is the case
        return currentDesired["mode"];
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
