/**
# fastest-writable&nbsp;&nbsp;&nbsp;[![Build Status](https://travis-ci.org/davedoesdev/fastest-writable.png)](https://travis-ci.org/davedoesdev/fastest-writable) [![Coverage Status](https://coveralls.io/repos/davedoesdev/fastest-writable/badge.png?branch=master)](https://coveralls.io/r/davedoesdev/fastest-writable?branch=master) [![NPM version](https://badge.fury.io/js/fastest-writable.png)](http://badge.fury.io/js/fastest-writable)

Node.js [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) which goes at the speed of its fastest peer `Writable` and ends peers which can't keep up.

- Alternative to [`readable.pipe`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_readable_pipe_destination_options) which goes at the rate of the slowest peer.
- Peers which aren't drained when a write occurs are ended.
- With no peers added, `fastest-writable` consumes data as fast as it is written and throws it away.
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
// drain emitted next tick
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

[Instanbul](http://gotwarlost.github.io/istanbul/) results are available [here](http://rawgit.davedoesdev.com/davedoesdev/fastest-writable/master/coverage/lcov-report/index.html).

Coveralls page is [here](https://coveralls.io/r/davedoesdev/fastest-writable).

## Lint

```shell
grunt lint
```

# API
*/
"use strict";

var stream = require('stream'),
    util = require('util');

/**
Creates a new `FastestWritable` object which can write to multiple peer [`stream.Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) objects. 

Inherits from [`stream.Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) so you can use any `Writable` method or event in addition to those described here.

@constructor
@extends Writable

@param {Object} [options] Configuration options. This is passed onto `Writable`'s constructor and can contain the following extra property:
- `{Boolean} [end_peers_on_finish]` Whether to call [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) on all peers when this `FastestWritable` object emits a [`finish`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_event_finish) event. Defaults to `true`.

- `{Boolean} [emit_laggard]` Whether to emit an event named `laggard` on any peers which can't keep up _instead of_ ending them. Defaults to `false`.
*/

function FastestWritable(options)
{
    stream.Writable.call(this, options);

    options = options || {};
    this._options = options;

    this._peers = new Map();

    var ths = this;

    this.on('finish', function ()
    {
        for (var peer of ths._peers.keys())
        {
            ths._end_peer(peer, options.end_peers_on_finish, false);
        }
    });

    this.on('pipe', function (src)
    {
        for (var peer of ths._peers.keys())
        {
            peer.emit('pipe', src);
        }
    });

    this.on('unpipe', function (src)
    {
        for (var peer of ths._peers.keys())
        {
            peer.emit('unpipe', src);
        }
    });

    this._finish = function ()
    {
        ths.remove_peer(this, false);
    };

    this._orig_emit = this.emit;
    this.emit = function (type)
    {
        if (type === 'error')
        {
            for (var peer of ths._peers.keys())
            {
                peer._fastest_writable_orig_emit.apply(peer, arguments);
            }
        }

        return this._orig_emit.apply(this, arguments);
    };
}

util.inherits(FastestWritable, stream.Writable);

/**
Add a peer [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) to the list of peers to which data will be written.

When [`writable.write`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_write_chunk_encoding_callback) is called on this `FastestWritable` object, the data is written to every peer. `FastestWritable` drains when _at least one_ of its peers drains. When `writable.write` is called again, [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) is called on any peer which hasn't drained from the previous `writable.write` call.

If this `FastestWritable` object has no peer `Writable`s then it drains immediately.

@param {stream.Writable} peer Peer `Writable` to add.
*/
FastestWritable.prototype.add_peer = function (peer)
{
    var ths = this;

    this._peers.set(peer, false);
    
    peer.on('finish', this._finish);

    peer._fastest_writable_orig_emit = peer.emit;
    peer.emit = function (type)
    {
        if (type === 'error')
        {
            ths._orig_emit.apply(ths, arguments);
        }

        return this._fastest_writable_orig_emit.apply(this, arguments);
    };

    this.emit('peer_added', peer);
};

/**
Remove a peer [`Writable`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_class_stream_writable) from the list of peers to which data will be written.

@param {stream.Writable} peer Peer `Writable` to remove.

@param {Boolean} end Whether to call [`writable.end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) on the peer once it's been removed from the list. Defaults to `true`.
*/
FastestWritable.prototype.remove_peer = function (peer, end)
{
    // From Node 14, 'finish' event is not emitted synchronously.
    // So when we end() the peer in _end_peer(), _remove_peer() isn't called
    // because we remove the 'finish' listener before the event is emitted.
    // istanbul ignore else
    if (this._peers.has(peer))
    {
        this._end_peer(peer, end, false);
    }
};

FastestWritable.prototype._end_peer = function (peer, end, laggard)
{
    this._peers.delete(peer);

    if (laggard)
    {
        this.emit('laggard', peer);
        peer.emit('laggard');
    }
    else if (end !== false)
    {
        peer.end();
    }

    peer.removeListener('finish', this._finish);
    peer.emit = peer._fastest_writable_orig_emit;

    this.emit('peer_removed', peer);

    if (this._peers.size === 0)
    {
        this.emit('empty');
    }
};

FastestWritable.prototype._write = function (chunk, encoding, cb)
{
    var ths = this, num_waiting = 0;

    function callback()
    {
        if (cb)
        {
            var f = cb;
            cb = null;
            f();
        }
    }

    function ready()
    {
        if (cb && !ths.emit('ready', num_waiting, num_peers, callback))
        {
            callback();
        }
    }

    function drain()
    {
        num_waiting -= 1;

        /*jshint validthis: true */
        this.removeListener('drain', drain);
        this.removeListener('finish', drain);

        if (!ths._peers.has(this))
        {
            if (num_waiting === 0)
            {
                ready();
            }

            return; // doesn't mean it's ready for data!
        }

        ths._peers.set(this, false);
        ready();
    }

    for (var info of this._peers)
    {
        var peer = info[0], waiting = info[1];

        if (waiting)
        {
            this._end_peer(peer, true, this._options.emit_laggard);
        }
        else if (!peer.write(chunk, encoding))
        {
            num_waiting += 1;
            this._peers.set(peer, true);
            peer.on('drain', drain);
            peer.on('finish', drain);
        }
    }

    var num_peers = this._peers.size;

    if ((num_peers === 0) || (num_waiting < num_peers))
    {
        // at least one peer is ready or there are no peers
        return process.nextTick(ready);
    }

    this.emit('waiting', callback);
};

exports.FastestWritable = FastestWritable;

