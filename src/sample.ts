import { Hopper, Hopperkeys } from "./Hopper";

class MyClass {
    private curItem = 0;
    private oci = 0;
    private items:Record<string, any> = {};
    processItem = Hopper( async (name: string, price: number, lag: number)=> {
        this.curItem++;
        await new Promise( resolve=>setTimeout(resolve, lag));
        const item = {place: this.curItem, price};
        this.items[name] = item
        return JSON.stringify(item);
    });

    otherProcess = Hopper( async (name:string, lag: number)=>{
        console.log(`Processing ${name} on coupled queue from MyClass`);
        await new Promise( resolve=>setTimeout(resolve, lag));
        this.oci++;
        return JSON.stringify( this.items[name] = {
            otherItemName: name
        });
    }, {key: 'fisk'});

    toJSON() {
        return this.items;
    }
}

class MyOtherClass {
    private oci = 0;
    private items:Record<string, any> = {};

    otherProcess = Hopper( async (name:string, lag: number)=>{
        console.log(`Processing ${name} on coupled queue from MyOtherClass`);
        await new Promise( resolve=>setTimeout(resolve, lag));
        this.oci++;
        return JSON.stringify( this.items[name] = {
            otherItemName: name
        });
    }, {key: 'fisk'});

    toJSON() {
        return this.items;
    }
}

const o = {
    inst: new MyClass(),
    other: new MyOtherClass(),
};

const startTime = new Date().getTime();

console.log('Start queueing stuff...');

const promises: Promise<any>[] = [];

promises.push (o.inst.processItem('FirstItem', 109, 100).then ( i=> console.log(`Processed: ${i}`) ) );
console.log('FirstItem queued');

promises.push (o.inst.processItem('SecondItem', 109, 1).then ( i=> console.log(`Processed: ${i}`) ));
console.log('SecondItem queued');

promises.push (o.inst.processItem('ThirdItem', 109, 500).then ( i=> console.log(`Processed: ${i}`) ));
console.log('ThirdItem queued');

promises.push (o.inst.processItem('FourthItem', 109, 1).then ( i=> console.log(`Processed: ${i}`) ));
console.log('FourthItem queued');

Promise.allSettled( promises ).then( ()=>{
    // Showing that items are processed in order on coupled queues, even though different
    // processing functions are handling them.
    promises.push (o.inst.otherProcess('OtherItem1ToMyClass', 200));
    promises.push (o.other.otherProcess('OtherItem1ToOtherClass', 100));

    promises.push (o.inst.otherProcess('OtherItem2ToMyClass', 100));
    promises.push (o.other.otherProcess('OtherItem2ToOtherClass', 200));

    promises.push (o.inst.otherProcess('OtherItem3ToMyClass', 100));
    promises.push (o.other.otherProcess('OtherItem3ToOtherClass', 10));

    Promise.allSettled( promises).then( ()=>{
        setTimeout( ()=>{
            console.log('Adding more stuff after first sequence.');
            o.inst.processItem('FifthItem', 100, 1000).then ( i=> console.log(`Processed: ${i}`) );
            console.log('FifthItem queued')

            o.inst.processItem('SixthItem', 1, 0).then ( i=>{
                console.log(`Processed: ${i}`);
                console.log(`Processing results:\n${JSON.stringify(o.inst,null,4)}`);
            });
            console.log('SixthItem queued');
        }, 800);

        delete (o as any).other;
        setTimeout( ()=>{
            delete (o as any).inst;
            if(global.gc) {
                global.gc();
            }
        }, 2000);

    });
});
const stopTime = new Date().getTime();

console.log(`Queueing took ${stopTime-startTime} ms`);
console.log(`Processing results:\n${JSON.stringify(o.inst,null,4)}`);

console.log(JSON.stringify(Hopperkeys()));