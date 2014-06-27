/**
# fastest-writable&nbsp;&nbsp;&nbsp;[![Build Status](https://travis-ci.org/davedoesdev/fastest-writable.png)](https://travis-ci.org/davedoesdev/fastest-writable) [![Coverage Status](https://coveralls.io/repos/davedoesdev/fastest-writable/badge.png?branch=master)](https://coveralls.io/r/davedoesdev/fastest-writable?branch=master) [![NPM version](https://badge.fury.io/js/fastest-writable.png)](http://badge.fury.io/js/fastest-writable)

Node.js [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) which goes at the speed of its fastest peer `Writable` and ends peers which can't keep up.

- Alternative to [`readable.pipe`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_readable_pipe_destination_options) which goes at the rate of the slowest peer.
- Peers which aren't drained when a write occurs are ended.
- With no peers added, `fastest-writable` consumes data as fast as it is written and throws it away.
- Requires Node 0.11 (stream behaviour seems to change between every release and I'm targetting 0.12).
- Full set of unit tests with 100% coverage.

Example:

```javascript
var stream = require('stream'),
    assert = require('assert'),
    FastestWritable = require('fastest-writable').FastestWritable,
    source = new stream.PassThrough(),
    fw = new FastestWritable(),
    dest1 = new stream.PassThrough({ highWaterMark: 1 }),
    dest2 = new stream.PassThrough({ highWaterMark: 1 });

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
});
```

The API is described [here](#tableofcontents).

## Installation

```shell
npm install fastest-writable
```

## Licence

[MIT](LICENCE)

## Test

```shell
grunt test
```

## Code Coverage

```shell
grunt coverage
```

[Instanbul](http://gotwarlost.github.io/istanbul/) results are available [here](http://githubraw.herokuapp.com/davedoesdev/fastest-writable/master/coverage/lcov-report/index.html).

Coveralls page is [here](https://coveralls.io/r/davedoesdev/fastest-writable).

## Lint

```shell
grunt lint
```

# API
*/
/*jslint node: true, nomen: true */
"use strict";

var stream = require('stream'),
    util = require('util');

/**
Creates a new `FastestWritable` object which can write to multiple peer [`stream.Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) objects. 

Inherits from [`stream.Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) so you can use any `Writable` method or event in addition to those described here.

@constructor
@extends Writable

@param {Object} [options] Configuration options. This is passed onto `Writable`'s constructor and can contain the following extra property:

- `{Boolean} [end_peers_on_finish]` Whether to call [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) on all peers when this `FastestWritable` object emits a [`finish`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_event_finish) event.
*/

function FastestWritable(options)
{
    stream.Writable.call(this, options);

    options = options || {};

    this._peers = [];

    var ths = this;

    this.on('finish', function ()
    {
        while (ths._peers.length > 0)
        {
            ths._end_peer(0, ths._peers[0], options.end_peers_on_finish);
        }
    });
}

util.inherits(FastestWritable, stream.Writable);

/**
Add a peer [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) to the list of peers to which data will be written.

When [`writable.write`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_write_chunk_encoding_callback) is called on this `FastestWritable` object, the data is written to every peer. `FastestWritable` drains when _any_ of its peers drain. When `writable.write` is called again, [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) is called on any peer which hasn't drained from the previous `writable.write` call.

If this `FastestWritable` object has no peer `Writable`s then it drains immediately.

@param {stream.Writable} peer Peer `Writable` to add.
*/
FastestWritable.prototype.add_peer = function (peer)
{
    var ths = this, info = {
        peer: peer,
        waiting: false,
        removed: false
    };

    this._peers.push(info);
    
    peer.on('finish', function ()
    {
        if (!info.removed) // optimisation - won't be in peers if already removed
        {
            ths.remove_peer(peer);
        }
    });

    peer.on('error', function (err)
    {
        if (!info.removed) // optimisation - won't be in peers if already removed
        {
            ths.remove_peer(peer);
        }

        ths.emit('error', err, peer);
    });
};

/**
Remove a peer [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) from the list of peers to which data will be written.

@param {stream.Writable} peer Peer `Writable` to remove.

@param {Boolean} end Whether to call [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) on the peer once it's been removed from the list. Defaults to `true`.
*/

FastestWritable.prototype.remove_peer = function (peer, end)
{
    var i, info;

    for (i = 0; i < this._peers.length; i += 1)
    {
        info = this._peers[i];

        if (info.peer === peer)
        {
            return this._end_peer(i, info, end);
        }
    }
};

FastestWritable.prototype._end_peer = function (i, info, end)
{
    this._peers.splice(i, 1);
    info.removed = true;

    if (end !== false)
    {
        info.peer.end();
    }

    if (this._peers.length === 0)
    {
        this.emit('empty');
    }
};

FastestWritable.prototype._write = function (chunk, encoding, cb)
{
    var num_waiting = 0, i, info, drain;

    function callback()
    {
        if (cb)
        {
            var f = cb;
            cb = null;
            f();
        }
    }

    function make_drain(info)
    {
        var f, waiting_for = 1;

        f = function ()
        {
            num_waiting -= waiting_for;
            waiting_for = 0;

            info.peer.removeListener('drain', f);
            info.peer.removeListener('finish', f);

            if (info.removed) { return; } // doesn't mean it's ready for data!

            info.waiting = false;

            callback();
        };
        
        return f;
    }

    for (i = 0; i < this._peers.length; i += 1)
    {
        info = this._peers[i];

        if (info.waiting)
        {
            this._end_peer(i, info);
            i -= 1; // info has been removed from this._peers
        }
        else if (!info.peer.write(chunk, encoding))
        {
            num_waiting += 1;
            info.waiting = true;
            drain = make_drain(info);
            info.peer.on('drain', drain);
            info.peer.on('finish', drain);
        }
    }

    if ((this._peers.length === 0) || (num_waiting < this._peers.length))
    {
        // at least one peer is ready or there are no peers
        return callback();
    }

    this.emit('waiting', callback);
};

exports.FastestWritable = FastestWritable;

