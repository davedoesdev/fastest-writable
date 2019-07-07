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

/**
`laggard` event

A `FastestWritable` object emits a `laggard` event when one of its peers can't keep up, if `emit_laggard` was passed to the constructor. Note a `laggard` event is also emitted on the peer.

@param {stream.Writable} peer Peer `Writable` which can't keep up.
*/
FastestWritable.events.laggard = function (peer) { return undefined; };

/**
`peer_added` event

A `FastestWritable` object emits a `peer_added` event when a peer has been added to the list of peers to which data will be written.

@param {stream.Writable} peer Peer added.
*/
FastestWritable.events.peer_added = function (peer) { return undefined; };

/**
`peer_removed` event

A `FastestWritable` object emits a `peer_removed` event when a peer has been removed from the list of peers to which data will be written.

@param {stream.Writable} peer Peer removed.
*/
FastestWritable.events.peer_removed = function (peer) { return undefined; };
