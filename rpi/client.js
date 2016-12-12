var shadow;

/** Includes **/
var gpio = require('rpi-gpio');
var async = require('async');
var awsIot = require('aws-iot-device-sdk');

var thingName = 'XMAS';

/** GPIO Switch (for development) **/
var GPIOEnabled = false;

/** Power **/
var pCurrent = 0;
var PIN_POWER = 11;

/** Mode Changer (Assumes on power resume, the mode is always the first) **/
var mCurrent = 0;
var mUpperBound = 7;
var PIN_MODE = 13;

/** Pulse time must be long enough for the relay to engage and the controller to recognise the switch press. **/
var PULSE_TIME_MS = 50;

/** Setup pins **/
if(GPIOEnabled) {
    gpio.setup(PIN_POWER, function(err){
        console.log("Power pin setup. " + err);
    });
    gpio.setup(PIN_MODE, function(err){
        console.log("Mode pin setup. " + err);
    });
}

/**
 * AWS Handling of events
 */
function connectToAWS(){

    shadow = awsIot.thingShadow({
        "host": "data.iot.eu-west-1.amazonaws.com",
        "port": 8883,
        "clientId": thingName,
        "thingName": thingName,
        "caCert": "root-CA.crt",
        "clientCert": "certificate.pem.crt",
        "privateKey": "private.pem.key",
        "region": "eu-west-1"
    });

    shadow.on('connect', function() {
        console.log("AWS: connected");
        setTimeout(function(){
            shadow.register(thingName, enableVersioning=true,
                function() {
                    console.log("Getting latest shadow");
                    shadow.get(thingName);
                });
        }, 500);
    });

    shadow.on('delta', function(thingName, stateObject) {
        //console.log('received delta on '+thingName+': ' + JSON.stringify(stateObject));
        // Pass the state message for handling
        handleMessage(stateObject['state']);
    });

    shadow.on('status',
        function(thingName, stat, clientToken, stateObject) {
            // console.log('received '+stat+' on '+thingName+': ' + JSON.stringify(stateObject));
            if(stateObject["state"]["desired"]){
                handleMessage(stateObject['state']);
            }
        });

    shadow.on('error', function(error) {
        console.log("AWS: Error - " + error);
    });

    shadow.on('reconnect', function() {
        console.log("AWS: Error - Reconnecting");
    });
}

/**
 * Takes the message and directs it to the specific handler.
 * This is done is series to ensure the last action has applied before the next
 * one is attempted. Otherwise, for example, the power may be processed but not outputted
 * for the mode is attempted to be switched.
 * @param object
 */
function handleMessage(object){
    async.series([
        function(callback){
            if(typeof object['power'] !== 'undefined'){
                setPower(object['power'], callback);
            }else{
                callback();
            }
        },
        function(callback){
            if(typeof object['mode'] !== 'undefined'){
                setMode(object['mode'], callback);
            }else{
                callback();
            }
        }
    ], function (err, result){
        console.log("Done");
        updateShadow();
    });
}

/**
 * Updates the shadow with the current settings (as we know them)
 */
function updateShadow(){
    // Ensure we output INT, not strings
    var state = {"power": parseInt(pCurrent), "mode": parseInt(mCurrent)};
    shadow.update(thingName, {"state": {"reported": state}});
}

/// POWER ///
/**
 * Set the power to the correct value
 * @param val
 * @param gpioDoneCallback
 */
function setPower(val, gpioDoneCallback){
    if (val == 0) {
        writeGPIO(PIN_POWER, false, function () {
            pCurrent = 0;
            outputDeviceSummary();
            gpioDoneCallback();
        });
    }else{
        // Turn on (Hold in the relay)
        writeGPIO(PIN_POWER, true, function () {
            pCurrent = 1;
            outputDeviceSummary();
            gpioDoneCallback();
    });
    }
}

/// MODE ///

/**
 * Set the mode of the device to the desired input value
 * @param inputValue
 * @param gpioDoneCallback
 */
function setMode(inputValue, gpioDoneCallback){
    if(0 <= inputValue && mUpperBound >= inputValue){
        if(pCurrent == 1) {
            changePhysicalPushSwitchValue(PIN_MODE, mCurrent, mUpperBound, inputValue, function () {
                mCurrent = inputValue;
                gpioDoneCallback();
            });
        }else{
            // Skipping as pCurrent is OFF, so no need to change mode
            gpioDoneCallback();
        }
    }else{
        console.log("Mode: Invalid input value: " + inputValue);
        gpioDoneCallback();
    }
}

/// GPIO ///

/**
 * Change value depending on the input parameters.
 * @param pin
 * @param current
 * @param upperBound
 * @param desired
 * @param successCallback
 */
function changePhysicalPushSwitchValue(pin, current, upperBound, desired, successCallback){
    if(current == desired){
        // No need to change
        console.log("No need to change for pin: " + pin);
        successCallback();
    }else if(desired > current){
        // We can do a direct pulse, no need to loop
       // ensureDeviceOn();
        pulseGPIOPin(pin, desired - current, successCallback);
    }else{
        // Need to loop using upperBound
        //ensureDeviceOn();
        pulseGPIOPin(pin, ((upperBound - current) + desired), successCallback);
    }
}

/**
 * Pulse the GPIO Pin with a statically defined interval, in order to simulate
 * switch presses on the shadow.
 * @param pin
 * @param count
 * @param callback
 */
function pulseGPIOPin(pin, count, callback){
    console.log("Pulsing for pin " + pin + " for count: " + count);
    outputOnGPIOCountDuration(pin, PULSE_TIME_MS, count, callback);
}

/**
 * Manages the pin calling in an asynchronous fashion, calling successCallback
 * once remainingCount == 0.
 * @param pin
 * @param time
 * @param remainingCount
 * @param successCallback
 */
function outputOnGPIOCountDuration(pin, time, remainingCount, successCallback){
    async.series([
        function (callback){
            console.log(remainingCount + " pulses remaining for pin " + pin);
            outputOnGPIODuration(pin, PULSE_TIME_MS, callback);
        }
    ], function (err, result){
        if((remainingCount - 1 ) > 0) {
            outputOnGPIOCountDuration(pin, time, remainingCount - 1, successCallback);
        }else{
            successCallback();
            outputDeviceSummary();
        }
    })
}

/**
 * Handles on ON pause OFF sequence
 * @param pin
 * @param duration
 * @param finishedCallback
 */
function outputOnGPIODuration(pin, duration, finishedCallback) {
    console.log("Outputting pin " + pin + " for " + duration + " ms");
    async.series([
            function (callback) {
                writeGPIO(pin, true, callback);
            },
            function (callback) {
                setTimeout(function () {
                    writeGPIO(pin, false, callback);
                }, duration);
            }
        ],
        function (err, result) {
            console.log("On/off cycle complete");
            finishedCallback()
        });
}

/**
 * Wrapper function around write to make debugging and further
 * improvements easier.
 * @param pin
 * @param value
 * @param callback
 */
function writeGPIO(pin, value, callback) {
    console.log("Outputting " + value + " to pin " + pin);
    if(GPIOEnabled) {
        gpio.write(pin, value, callback);
    }else{
        callback();
    }
}

/// HELPERS ///

/**
 * Output a summary of the shadow state to the console.
 */
function outputDeviceSummary(){
    console.log("============================");
    console.log("Power: " + pCurrent);
    console.log("Mode: " + mCurrent);
    console.log("============================");
}


// Starting function
connectToAWS();
