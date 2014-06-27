/*global FastestWritable: false */
/*jslint node: true */
"use strict";
/**
`empty` event

A `FastestWritable` object emits an `empty` event when it has no more `Writable` objects in its list of peers. 

Note that when a `FastestWritable` object is empty, it is always drained and throws any data it receives away.

You could, for example, [`end`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_writable_end_chunk_encoding_callback) the `FastestWritable` object when `empty` is emitted.
*/
FastestWritable.events.empty = function () { return undefined; };

/**
`waiting` event

A `FastestWritable` object emits a `waiting` event when it's waiting for any of its peers to drain.

Once at least one peer has drained, the `FastestWritable` object will emit a [`drain`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_event_drain) event.

@param {Function} stop_waiting Call this function to force the `FastestWritable` object to drain without waiting for any of its peers to drain. You could use this to implement a timeout, for example. It's safe to call `stop_waiting` more than once or even after a peer has drained of its own accord.
*/
FastestWritable.events.waiting = function () { return undefined; };
