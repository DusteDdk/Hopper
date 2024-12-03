
type AsyncFunction<TArgs extends any[] = any[], TResult = any> = (...args: TArgs) => Promise<TResult>;

type PromiseResolver = (value?: unknown) => void;

interface HopperState {
    queue: PromiseResolver[],
    running: boolean
    refs: number
};

const couplings: Record<string, HopperState> = {};

const finalizer = new FinalizationRegistry( (key: string)=>{
    const state = couplings[key];
    if(state) {
        state.refs--;
        if(!state.refs) {
            delete couplings[key];
        }
    }
});

const newState = (): HopperState=>
    ({  queue: [],
        running: false,
        refs: 0 });


const getState = (key: string) => {
    const state = couplings[key]
        ? couplings[key]
        : couplings[key] = newState();
    state.refs++;
    return state;
};

type BothOrNone<T, U> =
  | { [K in keyof T]?: undefined } & { [L in keyof U]?: undefined } // Both unset
  | (T & U); // Both set



/**
 * Configuration settings for the Hopper function (default: {})
 * 
 * @interface HopperSettings
 * 
 * @property {string} [key] - Optional bonding key, multiple processors, called in order.
 * @property {number} [softLimit] - Accept item, but call onSoftLimit if this many or more are waiting to be processed.
 *                                  Default: 0 =no limit.
 * @property {(softLimit: number, queueLength: number) => void} [onSoftLimit] - Called when `softLimit` is reached or exceeded.
 * @property {number} [hardLimit] - Reject item with return value of onHardLimit if item is added when there is alrady this many items waiting to be processed.
 *                                  Default: 0 = no limit.
 * @property {(hardLimit: number) => any} [onHardLimit] - Called when `hardLimit` is reached, the promise is rejected with the return value of this callback.
 * @property {()=>boolean} [onDrain] - Called when there are no queued items. Can be called multiple times, will be removed if it returns false
 */
export type HopperSettings = {
    key?: string
    onDrain?: ()=>boolean
} 
& BothOrNone<{softLimit: number}, {onSoftLimit: (softLimit: number, queueLength: number)=>void}>
& BothOrNone<{hardLimit: number}, {onHardLimit: (hardLimit: number)=>any}>

const defaultHopperSettings = {};

interface HopperKeyMap {
    [key: string]: {
        refs: number,
        queued: number
    }
}
export const Hopperkeys = ()=>{
    const m: HopperKeyMap = {};
    for(const k in couplings) {
        m[k] = {
            refs: couplings[k].refs,
            queued: couplings[k].queue.length
        };
    }
    return m;
}

export const Hopper = <T extends AsyncFunction>( processingCallback: T, cfg: HopperSettings = defaultHopperSettings ) => {

    const state = (!cfg.key) ? newState() : getState(cfg.key);

    if( ( cfg.softLimit && !cfg.onSoftLimit) || (cfg.onSoftLimit && !cfg.softLimit)) {
        throw new Error('softLimit and onSoftLimit must both be either set or unset.');
    }

    if( ( cfg.hardLimit && !cfg.onHardLimit) || (cfg.onHardLimit && !cfg.hardLimit)) {
        throw new Error('hardLimit and onHardlimit must both be either set or unset.');
    }


    const next= ()=> {
        const turn = state.queue.shift();
        if(turn) {
            turn();
        } else {
            state.running=false;
            if(cfg.onDrain) {
                if( !cfg.onDrain() ) {
                    delete cfg.onDrain;
                }
            }
        }
    };

  const hopper = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {

    if(cfg.hardLimit && state.queue.length > cfg.hardLimit && cfg.onHardLimit) {
        throw cfg.onHardLimit(cfg.hardLimit);
    }

    if(cfg.softLimit && state.queue.length >= cfg.softLimit && cfg.onSoftLimit) {
        cfg.onSoftLimit(cfg.softLimit, state.queue.length);
    }

    if(state.running) {
        const turn = new Promise( resolve => {
            state.queue.push(resolve);
        });
        await turn;
    }
    state.running=true;
    return await processingCallback(...args).finally( next );
  };

  if(cfg.key) {
    finalizer.register(hopper, cfg.key);
  }

  return hopper;
};