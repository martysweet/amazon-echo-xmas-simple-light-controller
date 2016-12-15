# Amazon Echo XMas Light Controller

The Amazon Echo Simple Xmas Light Controller comprises of an Alexa Node.js application (running in AWS Lambda) 
and a Node.js application running on a RaspberryPi, which controls GPIO pins to switch relays. 
This project uses three main AWS (Amazon Web Services) concepts, Alexa, IOT and Lambda.

Light Controller
================

The light controller in question is a ......... which .......

The device behaves as follows:
* Only one switch can be pressed any a time
* The power switch will turn on and off the device with a quick press, this is known as `PULSE_TIME_MS`
* The device registers presses of around 50ms, as defined by `PULSE_TIME_MS`

Alexa
-----

The Alexa folder contains the Intents, Slots and Utterances required to
create an Alexa Skill as required by the [Amazon Skill Kit](https://developer.amazon.com/alexa-skills-kit).
Alexa, the service behind the Amazon Echo, invokes the Lambda function with the matching 
intent and mentioned slots (if any). The called Lambda function then interprets the 
input and outputs the required settings using AWS IOT, updating the Thing Shadow of the BoB device.

For more information about AWS IOT Shadows, see the [AWS Device Shadows Document](http://docs.aws.amazon.com/iot/latest/developerguide/thing-shadow-document.html).

RPi
---

The RPi, running the Node.js program (found in the rpi folder), makes use
of the Node.js IOT SDK in order to listen for Shadow deltas (changes between
desired and reported). Delta messages are then interpreted, before switching 
GPIO pins as necessary in order for the user specified actions to be actioned on the device.

```bash
sudo npm install rpi-gpio async aws-iot-device-sdk
sudo nodejs client.js
```

The RPI uses it's GPIO pins (as shown by 2 switches) in order to excite a transistor, this transistor then
allows current to flow from it's collector to it's emitter in order to 
energise the coil for the relay, simulating a press of a switch as the contacts
are joined or the allowance of current to flow to the light flasher module.

The below diagram shows a similar design of the circuitry used for this project,
however the battery and signal lamps shown in the circuit are there
only for simulation and demonstration purposes. In the real world prototype,
the relay would be connected to both pins of the push switch.

PNP transistors can be used by placing them on the positive side of the relay coil.

!!IMAGE!!
