const record = require('node-record-lpcm16');

const snowboy = require('snowboy');
const Detector = snowboy.Detector;
const Models = snowboy.Models;

const models = new Models();

enum State
{
    WAITING,
    RECORDING,
    SENDING,
    ERROR
}

var timer: any = null;
var silenceTimer: any = null;
var silenceActive: boolean = false;
var state: State = State.WAITING;

models.add({
    file: 'node_modules/snowboy/resources/snowboy.umdl',
    sensitivity: '0.7',
    hotwords: 'snowboy'
});

const detector = new Detector({
    resource: "node_modules/snowboy/resources/common.res",
    models: models,
    audioGain: 2.0
});

var buffer: Buffer = new Buffer([]);

function clearPreBuffer()
{
    buffer = new Buffer([]);
}

function appendPreBuffer(buf: Buffer)
{
    buffer = Buffer.concat([buffer, buf]);
}

function getPreBuffer()
{
    return buffer;
}

function send(buf: Buffer)
{
    console.log("sending ", buf.length, " bytes");
}

function finishSend()
{
    console.log("closing Stream");
}

detector.on('silence', function ()
{
    if (timer != null) clearTimeout(timer);
    timer = null;
    if (state == State.RECORDING)
    {
        state = State.WAITING;
        console.log("GIVE UP BUFFERING");
        clearPreBuffer();
    }
    if (state == State.SENDING)
    {
        if (silenceActive)
        {
            state = State.WAITING;
            finishSend();
            console.log("END");
        }
    }
});

detector.on('sound', function (buffer: Buffer)
{
    if (state == State.WAITING)
    {
        state = State.RECORDING;
        console.log("BUFFERING");
        appendPreBuffer(buffer);
    }
    else if (state == State.RECORDING)
    {
        state = State.RECORDING;
        console.log("STILL BUFFERING");
        appendPreBuffer(buffer);
    }
    else if (state == State.SENDING)
    {
        state = State.SENDING;
        console.log("SENDING NEXT FRAME");
        send(buffer);
        silenceActive = true;
    }
});

detector.on('error', function ()
{
    console.log('error');
    state = State.WAITING;
});

detector.on('hotword', function (index: number, hotword: string, buffer: Buffer)
{
    console.log('hotword', index, hotword);
    state = State.SENDING;
    console.log("START");
    send(getPreBuffer());
    clearPreBuffer();
    send(buffer);
    silenceActive = false;
    silenceTimer = setTimeout(function ()
    {
        silenceActive = true;
    }, 1000);
    if (timer != null)
    {
        clearTimeout(timer);
        timer = null;
    }
    timer = setTimeout(function ()
    {
        console.log("GLOBAL TIMEOUT");
        state = State.WAITING;
        if (timer != null) clearTimeout(timer);
        timer = null;
        clearPreBuffer();
        finishSend();
    }, 10000);
});

const mic = record.start({
    threshold: 0,
    verbose: false,
    recordProgram: 'arecord'
});

mic.pipe(detector);
