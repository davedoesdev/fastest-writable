/*global describe: false,
         it: false */
"use strict";

describe('example', function ()
{
    it('should pass', function (cb)
    {
        var stream = require('stream'),
            assert = require('assert'),
            FastestWritable = require('..').FastestWritable,
            source = new stream.PassThrough(),
            fw = new FastestWritable(),
            dest1 = new stream.PassThrough({ highWaterMark: 0 }),
            dest2 = new stream.PassThrough({ highWaterMark: 0 });

        source.pipe(fw);
        fw.add_peer(dest1);
        fw.add_peer(dest2);

        source.write('foo');
        assert.equal(dest1.read().toString(), 'foo');
        source.write('bar');
        // fw drain emitted next tick
        process.nextTick(function ()
        {
            assert(dest2._writableState.ended);
            cb();
        });
    });
});

