EZ-mode nonblocking in-order async queue processors
===================================================

Usage, standalone:

const processWidgets = Hopper( async (widget, whatever, otherArguments)=> {
    // lots of async stuff
});

Usage, class member:

class WidgetMachine {
    process = Hopper( async (widget, your, arguments)=>{
        // lots of async stuff
    });

};

// Calling them,,

processWidget( widget, whateverArg, otherArgs );


widgetMachineInstance.process( someWidget, and, soOn );

What?
=====
Calling from anywhere queues items for processing and immediately returns.
The processing takes place sequentially, in order.
You can have many hoppers, they can be independent or order-coupled,
say you want all insects to be processed in order, across hoppers.

const HopperForInsects = KeyedHopper('insects');



const hopperA = HopperForInsects( async (insect, bugName) => {
    // Some async stuff that will take 2 seconds
    console.log('Processed the '+ bugName);
});

const hopperB = HopperForInsects( async (insect, bugName, age)=> {
    // some other async stuff that will take 2 ms.
   console.log('Recalculated lifespan for the '+bugName);
});

hopperA( bug, 'ant');
hopperB( anoterBug, 'fly', 2);

Output:
Processed the ant
Recalculated lifespan for the fly
