/*global describe: false,
         sinon: false,
         it: false,
         expect: false,
         beforeEach: false,
         TestWritable: false,
         source_stream: false,
         FastestWritable: false */
/*jslint node: true, nomen: true */
"use strict";

function expr(v) { return v; }

function buffer(s)
{
    return sinon.match(function (v)
    {
        return v.toString('utf8') === s;
    });
}

describe('pipe behaviour', function ()
{
    var dest_stream1, dest_stream2;

    beforeEach(function ()
    {
        // set low hwm to prevent all data being buffered
        dest_stream1 = new TestWritable({ highWaterMark: 1 });
        dest_stream2 = new TestWritable({ highWaterMark: 1 });

        // watch write methods
        sinon.spy(dest_stream1, 'write');
        sinon.spy(dest_stream2, 'write');
    });

    describe('Node default', function ()
    {
        it('should go at the speed of its slowest peer', function ()
        {
            // set up pipes
            source_stream.pipe(dest_stream1);
            source_stream.pipe(dest_stream2);

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // write again
            expr(expect(source_stream.write('second')).to.be.true);

            // check we didn't get the data this time (the source is awating drain)
            expect(dest_stream1.write.callCount).to.equal(1);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // drain one of the destination streams
            dest_stream1.callbacks[0]();

            // check we didn't get the data (source waits for all drains)
            expect(dest_stream1.write.callCount).to.equal(1);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // drain the other destination stream
            dest_stream2.callbacks[0]();

            // check we got the data now both streams have drained
            expect(dest_stream1.write.callCount).to.equal(2);
            expr(expect(dest_stream1.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.secondCall.calledWith(buffer('second'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(2);

            expect(dest_stream2.write.callCount).to.equal(2);
            expr(expect(dest_stream2.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.secondCall.calledWith(buffer('second'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(2);
        });
    });

    describe('FastestWritable', function ()
    {
        var fw, finished1, finished2;

        beforeEach(function ()
        {
            fw = new FastestWritable({ highWaterMark: 1 });
            sinon.spy(fw, 'write');

            // watch for finish event
            finished1 = false;
            dest_stream1.on('finish', function ()
            {
                finished1 = true;
            });

            finished2 = false;
            dest_stream2.on('finish', function ()
            {
                finished2 = true;
            });

            // watch end method
            sinon.spy(dest_stream1, 'end');
            sinon.spy(dest_stream2, 'end');

            // set up pipe
            source_stream.pipe(fw);

            // add peers
            fw.add_peer(dest_stream1);
            fw.add_peer(dest_stream2);
        });

        it('should go at the speed of its fastest peer', function ()
        {
            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // write again
            expr(expect(source_stream.write('second')).to.be.true);

            // check we didn't get the data this time (the source is awaiting drain)
            expect(fw.write.callCount).to.equal(1);

            expect(dest_stream1.write.callCount).to.equal(1);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // drain one of the destination streams
            dest_stream1.callbacks[0]();

            // check we got the data (FastestWritable waits for any drain)
            expect(fw.write.callCount).to.equal(2);
            expr(expect(fw.write.secondCall.returnValue).to.be.false);
            expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(2);
            expr(expect(dest_stream1.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.secondCall.calledWith(buffer('second'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(2);

            // second stream should not have been called since it didn't drain
            expect(dest_stream2.write.callCount).to.equal(1);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // check the second stream has been ended
            expect(dest_stream2.end.callCount).to.equal(1);
            expr(expect(finished2).to.be.false); // hasn't drained yet

            // check we don't carry on writing to the second stream
            expr(expect(source_stream.write('third')).to.be.true);
            expect(fw.write.callCount).to.equal(2);
            expect(dest_stream1.write.callCount).to.equal(2);
            expect(dest_stream2.write.callCount).to.equal(1);
            dest_stream1.callbacks[0]();
            expect(fw.write.callCount).to.equal(3);
            expect(dest_stream1.write.callCount).to.equal(3);
            expect(dest_stream2.write.callCount).to.equal(1);

            // drain the second stream and check we get finish event
            dest_stream2.callbacks[0]();
            // second write should still not be done
            expect(dest_stream2.callbacks.length).to.equal(1);
            expr(expect(finished2).to.be.true);

            // check we don't carry on writing to the second stream
            expr(expect(source_stream.write('fourth')).to.be.true);
            expect(fw.write.callCount).to.equal(3);
            expect(dest_stream1.write.callCount).to.equal(3);
            expect(dest_stream2.write.callCount).to.equal(1);
            dest_stream1.callbacks[0]();
            expect(fw.write.callCount).to.equal(4);
            expect(dest_stream1.write.callCount).to.equal(4);
            expect(dest_stream2.write.callCount).to.equal(1);
        });

        it('should copy with more than one peer draining', function ()
        {
            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // drain both of the destination streams
            dest_stream1.callbacks[0]();
            dest_stream2.callbacks[0]();

            // write again
            expr(expect(source_stream.write('second')).to.be.true);

            // check we got the data (FastestWritable waits for any drain)
            expect(fw.write.callCount).to.equal(2);
            expr(expect(fw.write.secondCall.returnValue).to.be.false);
            expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(2);
            expr(expect(dest_stream1.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.secondCall.calledWith(buffer('second'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(2);

            expect(dest_stream2.write.callCount).to.equal(2);
            expr(expect(dest_stream2.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.secondCall.calledWith(buffer('second'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(2);
        });

        it('should support one peer being drained straight away', function (cb)
        {
            dest_stream1._writableState.highWaterMark = 1024;

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            // above hwm for fw
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.true);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // write again
            expr(expect(source_stream.write('second')).to.be.true);

            // get dest_stream1 ready again
            dest_stream1.callbacks[0]();

            // check we didn't get the data this time (the source is awaiting drain which is done in process.nextTick)
            expect(fw.write.callCount).to.equal(1);

            process.nextTick(function ()
            {
                // fw should now have drained
                expect(fw.write.callCount).to.equal(2);
                // above hwm for fw
                expr(expect(fw.write.secondCall.returnValue).to.be.false);
                expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

                expect(dest_stream1.write.callCount).to.equal(2);
                expr(expect(dest_stream1.write.secondCall.returnValue).to.be.true);
                expr(expect(dest_stream1.write.secondCall.calledWith(buffer('second'))).to.be.true);
                expect(dest_stream1.callbacks.length).to.equal(2);

                // drain the second stream and check we get finish event
                dest_stream2.callbacks[0]();
                // second write should still not be done
                expect(dest_stream2.callbacks.length).to.equal(1);
                expr(expect(finished2).to.be.true);

                cb();
            });
        });

        it('should support all peers being drained straight away', function (cb)
        {
            dest_stream1._writableState.highWaterMark = 1024;
            dest_stream2._writableState.highWaterMark = 1024;

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            // above hwm for fw
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.true);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.true);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            // write again
            expr(expect(source_stream.write('second')).to.be.true);

            // get dest_streams ready again
            dest_stream1.callbacks[0]();
            dest_stream2.callbacks[0]();

            // check we didn't get the data this time (the source is awaiting drain which is done in process.nextTick)
            expect(fw.write.callCount).to.equal(1);

            process.nextTick(function ()
            {
                // fw should now have drained
                expect(fw.write.callCount).to.equal(2);
                // above hwm for fw
                expr(expect(fw.write.secondCall.returnValue).to.be.false);
                expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

                expect(dest_stream1.write.callCount).to.equal(2);
                expr(expect(dest_stream1.write.secondCall.returnValue).to.be.true);
                expr(expect(dest_stream1.write.secondCall.calledWith(buffer('second'))).to.be.true);
                expect(dest_stream1.callbacks.length).to.equal(2);

                expect(dest_stream2.write.callCount).to.equal(2);
                expr(expect(dest_stream2.write.secondCall.returnValue).to.be.true);
                expr(expect(dest_stream2.write.secondCall.calledWith(buffer('second'))).to.be.true);
                expect(dest_stream2.callbacks.length).to.equal(2);

                expr(expect(finished2).to.be.false);

                cb();
            });
        });

        it('should propagate errors', function (cb)
        {
            fw.on('error', function (err)
            {
                expect(err.message).to.equal('there was an error');
                cb();
            });

            dest_stream1.emit('error', new Error('there was an error'));
        });

        it('should propagate errors after peer has ended', function (cb)
        {
            fw.on('error', function (err)
            {
                expect(err.message).to.equal('there was an error');
                cb();
            });

            dest_stream1.on('finish', function ()
            {
                dest_stream1.emit('error', new Error('there was an error'));
            });

            dest_stream1.end();
        });

        it('should handle peers finishing', function ()
        {
            dest_stream2.end();

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            // check we're no longer writing to dest_stream2
            expect(dest_stream2.write.callCount).to.equal(0);
        });

        it('should end all peers when it ends', function ()
        {
            fw.end();
            expr(expect(finished1).to.be.true);
            expr(expect(finished2).to.be.true);

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we didn't get the data
            expect(fw.write.callCount).to.equal(0);
            expect(dest_stream1.write.callCount).to.equal(0);
            expect(dest_stream2.write.callCount).to.equal(0);
        });

        it('should support not ending all peers when it ends', function ()
        {
            source_stream.unpipe(fw);
            fw.remove_peer(dest_stream1, false);
            fw.remove_peer(dest_stream2, false);

            fw = new FastestWritable(
            {
                highWaterMark: 1,
                end_peers_on_finish: false
            });
            sinon.spy(fw, 'write');
            source_stream.pipe(fw);
            fw.add_peer(dest_stream1);
            fw.add_peer(dest_stream2);

            fw.end();
            expr(expect(finished1).to.be.false);
            expr(expect(finished2).to.be.false);

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we didn't get the data
            expect(fw.write.callCount).to.equal(0);
            expect(dest_stream1.write.callCount).to.equal(0);
            expect(dest_stream2.write.callCount).to.equal(0);
        });

        it('should support removing peers', function (cb)
        {
            fw.on('empty', function ()
            {
                // write to source
                expr(expect(source_stream.write('first')).to.be.true);

                // check we got the data
                expect(fw.write.callCount).to.equal(1);
                expr(expect(fw.write.firstCall.returnValue).to.be.false);
                expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

                // check dest_streams didn't get the data
                expect(dest_stream1.write.callCount).to.equal(0);
                expect(dest_stream2.write.callCount).to.equal(0);

                cb();
            });

            fw.remove_peer(dest_stream1);
            fw.remove_peer(dest_stream2);
        });

        it('should emit waiting event', function (cb)
        {
            fw.on('waiting', function (stop_waiting)
            {
                // check we got the data
                expect(fw.write.callCount).to.equal(1);
                // haven't returned from write yet!
                expr(expect(fw.write.firstCall.returnValue).not.to.exist);
                expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

                expect(dest_stream1.write.callCount).to.equal(1);
                expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
                expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
                expect(dest_stream1.callbacks.length).to.equal(1);

                expect(dest_stream2.write.callCount).to.equal(1);
                expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
                expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
                expect(dest_stream2.callbacks.length).to.equal(1);

                setTimeout(function ()
                {
                    expr(expect(fw.write.firstCall.returnValue).to.be.false);

                    // write again
                    expr(expect(source_stream.write('second')).to.be.true);

                    // check we didn't get the data
                    expect(fw.write.callCount).to.equal(1);
                    expect(dest_stream1.write.callCount).to.equal(1);
                    expect(dest_stream2.write.callCount).to.equal(1);

                    // force drain without waiting for peers
                    stop_waiting();

                    // check we got the data
                    expect(fw.write.callCount).to.equal(2);
                    // above hwm for fw
                    expr(expect(fw.write.secondCall.returnValue).to.be.false);
                    expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

                    // check peers didn't get the data
                    expect(dest_stream1.write.callCount).to.equal(1);
                    expect(dest_stream2.write.callCount).to.equal(1);

                    // drain the peers
                    dest_stream1.callbacks[0]();
                    dest_stream2.callbacks[0]();

                    // check peers have been ended
                    expr(expect(finished1).to.be.true);
                    expr(expect(finished2).to.be.true);

                    cb();
                }, 1000);
            });

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);
        });

        it('should emit drain event while waiting', function (cb)
        {
            fw.on('waiting', function (stop_waiting)
            {
                fw.on('drain', function ()
                {
                    // check we can call stop_waiting after drain
                    stop_waiting();
                    // check we can call it more than once
                    stop_waiting();
                    cb();
                });

                setTimeout(function ()
                {
                    // drain a peer
                    dest_stream1.callbacks[0]();
                }, 1000);
            });

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);
        });

        it('should support dummy data event on source', function (cb)
        {
            // pre-fill the streams
            dest_stream1.write('foo');
            dest_stream2.write('foo');

            fw.on('waiting', function ()
            {
                // successfully detected they're full
                cb();
            });

            source_stream.emit('data', '');

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            expr(expect(fw.write.firstCall.returnValue).to.be.true);
            expr(expect(fw.write.firstCall.calledWith('')).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(2);
            expr(expect(dest_stream1.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.secondCall.calledWith(buffer(''))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(2);
            expr(expect(dest_stream2.write.secondCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.secondCall.calledWith(buffer(''))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);
        });

        it('should be able to detect when done', function (cb)
        {
            fw.once('waiting', function (stop_waiting)
            {
                setTimeout(stop_waiting, 1000);
            });

            fw.on('unpipe', function (readable)
            {
                expect(readable).to.equal(source_stream);
                cb();
            });

            fw.on('empty', function ()
            {
                this.end();
            });

            // write to source
            expr(expect(source_stream.write('first')).to.be.true);

            // check we got the data
            expect(fw.write.callCount).to.equal(1);
            expr(expect(fw.write.firstCall.returnValue).to.be.false);
            expr(expect(fw.write.firstCall.calledWith(buffer('first'))).to.be.true);

            expect(dest_stream1.write.callCount).to.equal(1);
            expr(expect(dest_stream1.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream1.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream1.callbacks.length).to.equal(1);

            expect(dest_stream2.write.callCount).to.equal(1);
            expr(expect(dest_stream2.write.firstCall.returnValue).to.be.false);
            expr(expect(dest_stream2.write.firstCall.calledWith(buffer('first'))).to.be.true);
            expect(dest_stream2.callbacks.length).to.equal(1);

            setTimeout(function ()
            {
                // write again
                expr(expect(source_stream.write('second')).to.be.true);

                // check we got the data
                expect(fw.write.callCount).to.equal(2);
                expr(expect(fw.write.secondCall.returnValue).to.be.false);
                expr(expect(fw.write.secondCall.calledWith(buffer('second'))).to.be.true);

                // check peers weren't written to
                expect(dest_stream1.write.callCount).to.equal(1);
                expect(dest_stream2.write.callCount).to.equal(1);

                // drain the peers
                dest_stream1.callbacks[0]();
                dest_stream2.callbacks[0]();

                // check peers have been ended
                expr(expect(finished1).to.be.true);
                expr(expect(finished2).to.be.true);
            }, 2000);
        });
    });
});
