/*global FastestWritable: false */
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

When a peer drains, the `FastestWritable` object will emit a [`ready`](#fastestwritableeventsreadynum_waiting-total-drain) event. If there are no listeners for the `ready` event then it will emit a [`drain`](http://nodejs.org/docs/v0.11.13/api/stream.html#stream_event_drain) event.

@param {Function} stop_waiting Call this function to force the `FastestWritable` object to drain without waiting for any of its peers to drain. You could use this to implement a timeout, for example. It's safe to call `stop_waiting` more than once or even after a peer has drained of its own accord.
*/
FastestWritable.events.waiting = function (stop_waiting) { return undefined; };

/**
`ready` event

A `FastestWritable` object emits a `ready` event when one of its peers drains. It gives you the ability to control when the `FastestWritable` object emits `drain`.

@param {Integer} num_waiting Number of peers which still haven't drained for the latest data written to the `FastestWritable` object.

@param {Integer} total Number of peers which received the latest data written to the `FastestWritable` object.

@param {Function} drain Call this function to let the `FastestWritble` object drain without waiting for any more of its peers to drain. It's safe to call `drain` more than once.
*/
FastestWritable.events.ready = function (num_waiting, total, drain) { return undefined; };
