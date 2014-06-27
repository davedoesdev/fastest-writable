/*global beforeEach: false,
         stream: false,
         util: false */
/*jslint node: true, nomen: true */
"use strict";

global.util = require('util');
global.stream = require('stream');
global.expect = require('chai').expect;
global.sinon = require('sinon');
global.FastestWritable = require('..').FastestWritable;

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

/*jslint unparam: true */
TestWritable.prototype._write = function (chunk, encoding, callback)
{
    this.callbacks.unshift(callback);
};
/*jslint unparam: false */

global.TestWritable = TestWritable;

