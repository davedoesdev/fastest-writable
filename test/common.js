/*global beforeEach: false,
         before: false,
         stream: false,
         util: false */
"use strict";

global.util = require('util');
global.stream = require('stream');
global.sinon = require('sinon');
global.FastestWritable = require('..').FastestWritable;

before(async function () {
    ({ expect: global.expect } = await import('chai'));
});

beforeEach(function ()
{
    global.source_stream = new stream.PassThrough();
});

function TestWritable(options)
{
    stream.Writable.call(this, options);
    this.callbacks = [];
}

util.inherits(TestWritable, stream.Writable);

TestWritable.prototype._write = function (chunk, encoding, callback)
{
    this.callbacks.unshift(callback);
};

global.TestWritable = TestWritable;

