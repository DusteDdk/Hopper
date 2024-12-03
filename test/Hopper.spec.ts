import {Hopper, HopperSettings, Hopperkeys} from '../src/Hopper';

interface CbCtrl {
    run: ()=>void;
    cb: Promise<any>
}

const getCbCtrl = ()=>{
    const ctrl: any = {};
    const p = new Promise( resolve => ctrl.run = resolve );
    ctrl.cb = async ()=> { await  p };
    return ctrl as CbCtrl;
}

// We since promises are resolved next tick, we need to advance before we can
// expect any results.
const nextTick = ()=>{
    return new Promise(resolve=>setImmediate(resolve));
}

describe('Hopper', ()=>{
    it('processes in order', async ()=>{

        const results: number[] = [];
        const processor = Hopper( async (item: number, slowCallback: any)=>{
            await slowCallback();
            results.push(item);
        });

        // These "callback controllers" are used to continue execution from
        // "the slow callback"
        const a = getCbCtrl();
        const b = getCbCtrl();
        const c = getCbCtrl();
        const d = getCbCtrl();

        processor( 1, a.cb );
        processor( 2, b.cb );
        processor( 3, c.cb );
        processor( 4, d.cb );
        await nextTick();

        // Nothing should be queued yet
        expect(results).toEqual([]);

        // Be may be unblocked, but it shouldn't have run before a
        b.run();
        await nextTick();
        expect(results).toEqual([]);

        // They should both have run now, and A should have ran first
        a.run();

        await nextTick();
        expect(results).toEqual([1,2]);

        d.run();
        c.run();


        await nextTick();
        expect(results).toEqual( [1,2,3,4] );

    });


    let processorTwo;
    it('can share queue order', async ()=>{
        const resultOne: number[] = [];
        const resultTwo: number[] = [];

        const processorOne = Hopper( async (item: number, slowCallback: any)=>{
            await slowCallback();
            resultOne.push(item);
        }, {key: 'someKey'});
        processorTwo = Hopper( async (item: number, slowCallback: any)=>{
            await slowCallback();
            resultTwo.push(item);
        }, {key: 'someKey'});


        const a = getCbCtrl();
        const b = getCbCtrl();
        const c = getCbCtrl();
        const d = getCbCtrl();

        processorOne(1, a.cb); // Started right away
        processorTwo(2, b.cb); // Queued
        processorOne(3, c.cb); // Queued
        processorTwo(4, d.cb); // Queued

        await nextTick();
        expect(resultOne).toEqual([]);
        expect(resultTwo).toEqual([]);

        const registered = Hopperkeys();
        expect(registered).toEqual( { someKey: { refs: 2, queued: 3}} );

        b.run();
        c.run();

        await nextTick();
        expect(resultOne).toEqual([]);
        expect(resultTwo).toEqual([]);

        a.run();
        await nextTick();
        expect(resultOne).toEqual([1,3]);
        expect(resultTwo).toEqual([2]);

        d.run();
        await nextTick();
        expect(resultOne).toEqual([1,3]);
        expect(resultTwo).toEqual([2,4]);

    });

    it('cleans up after coupled hoppers (first reference gone)', async ()=>{
        if(global.gc) {
            global.gc();
            await new Promise(resolve=>setTimeout(resolve,50));
            const registered = Hopperkeys();
            expect(registered).toEqual( { someKey: { refs: 1, queued: 0 }} );
            processorTwo=undefined;

        } else {
            throw new Error('Should have global.gc');
        }
    });
    it('cleans up after coupled hoppers (all references gone)', async ()=>{
        if(global.gc) {
            global.gc();
            await new Promise(resolve=>setTimeout(resolve,50));
            const registered = Hopperkeys();
            expect(registered).toEqual( {} );
        } else {
            throw new Error('Should have global.gc');
        }
    });



    it('calls softLimit and hardLimit if set', async ()=>{

        const results: number[] = [];

        let slCallResult: any = undefined;
        let hlCallResult: any = undefined;

        const cfg: HopperSettings = {
            softLimit: 2,
            onSoftLimit: (sl, cl)=>{
                slCallResult={sl,cl};
            },
            hardLimit: 4,
            onHardLimit: (hl)=>{
                hlCallResult={hl};
                return new Error(`Test Error, hard limit of ${hl} reached.`);
            },
            };

        const processor = Hopper( async (item: number, slowCallback: any)=>{
            await slowCallback();
            results.push(item);
        }, cfg);

        // These "callback controllers" are used to continue execution from
        // "the slow callback"
        const a = getCbCtrl();
        const b = getCbCtrl();

        processor( 1, a.cb ); // Since queue is empty, this is started direct, calling it does not affect queue length
        processor( 2, b.cb ); // Queue length = 1 after this call
        processor( 3, b.cb ); // Queue length = 2 after this call
        processor( 4, b.cb ); // Queue length = 2 after this call

        expect(slCallResult).toEqual({sl: 2, cl: 2});
        processor( 5, b.cb ); // Queue length = 3 after this call
        expect(slCallResult).toEqual({sl: 2, cl: 3});

        // Take one off the queue and see currentLength is still 3 onSoftLimit
        a.run();
        await nextTick();
        processor( 6, b.cb ); // Queue length = 3 again after this call
        expect(slCallResult).toEqual({sl: 2, cl: 3});

        // This one fills the queue to 4
        processor( 7, b.cb ); // Queue length = 4

        let didReject=false;
        try {
            await processor(8, b.cb);
        } catch(e) {
            didReject=true;
            expect((e as Error).message).toEqual('Test Error, hard limit of 4 reached.');
        }
        expect(didReject).toBe(true);

        b.run();



        await nextTick();
        expect( results ).toEqual( [1,2,3,4,5,6, 7]);
    });

    it('throws if softLimit and onSoftLimit are not specified together', ()=>{
        expect( ()=>{
            const invalidCfg: any = {
                softLimit: 12,
            };
            Hopper( async()=>{}, invalidCfg );
        }).toThrow(/softLimit and onSoftLimit must both be either set or unset./);
        expect( ()=>{
            const invalidCfg: any = {
                onSoftLimit: ()=>{},
            };
            Hopper( async()=>{}, invalidCfg );
        }).toThrow(/softLimit and onSoftLimit must both be either set or unset./);
    });


    it('throws if hardLimit and onHardLimit are not specified together', ()=>{
        expect( ()=>{
            const invalidCfg: any = {
                hardLimit: 12,
            };
            Hopper( async()=>{}, invalidCfg );
        }).toThrow(/hardLimit and onHardlimit must both be either set or unset./);
        expect( ()=>{
            const invalidCfg: any = {
                onHardLimit: ()=>{},
            };
            Hopper( async()=>{}, invalidCfg );
        }).toThrow(/hardLimit and onHardlimit must both be either set or unset./);

    });


    it('keeps calling onDrain if specified, unless onDrain returns false', async ()=>{

        const results: number[] = [];
        let numCallsToOnDrain = 0;
        let keepCallinOnDrain=true;
        const processor = Hopper( async (item: number, slowCallback: any)=>{
            await slowCallback();
            results.push(item);
        }, { onDrain:()=>{
            numCallsToOnDrain++;
            return keepCallinOnDrain;
        }});

        // These "callback controllers" are used to continue execution from
        // "the slow callback"
        const a = getCbCtrl();
        const b = getCbCtrl();
        const c = getCbCtrl();
        const d = getCbCtrl();

        processor( 1, a.cb );
        expect(numCallsToOnDrain).toBe(0);

        processor( 2, b.cb );
        expect(numCallsToOnDrain).toBe(0);

        a.run();
        expect(numCallsToOnDrain).toBe(0);

        b.run();
        expect(numCallsToOnDrain).toBe(0);

        // Run the machinery, two items were waiting, but only once is it finished.
        await nextTick();
        expect(numCallsToOnDrain).toBe(1);

        // Queue one more, this should call it again
        keepCallinOnDrain=false; // But this time, it returns 0 and is removed.
        processor( 3, c.cb );
        c.run();
        await nextTick();
        expect(numCallsToOnDrain).toBe(2);

        // Queue another, this time, there shouldn't be any onDrain callback.
        processor( 4, d.cb );
        d.run();
        await nextTick();
        expect(numCallsToOnDrain).toBe(2); // So it stays 2

        expect(results).toEqual([1,2,3,4]);
    });

});