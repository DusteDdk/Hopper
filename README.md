![](img/hopper.webp)
## Async processing: in sequence

Use this when you need to process async tasks in order, especially in workflows where overlapping operations could cause conflicts or inconsistent results.

Whenever maintaining the order of async tasks is critical. For example, processing database queries that depend on the results of previous calls, updating shared in-memory data without risking race conditions, or handling APIs that require sequential operations to ensure consistency. It’s ideal for workflows where parallel execution could disrupt data integrity or lead to unpredictable behavior.

Call Hopper with your implementation, and get back a hopper that ensures your implementation is executed in sequence.


# Module: `@dusted/hopper`

## `Hopper(impl[, settings]) => hopperImpl => Promise`

The `Hopper` function takes a callback (`impl`) and returns a function (`hopperImpl`) that accepts the same arguments as the callback. It ensures that only one `impl` is running at a time and that subsequent calls are executed in the order they were made. The promise resolves when `impl` returns or rejects if:

- The internal processing queue is full (if a hard limit is set).
- `impl` throws.

The returned promise can be awaited or ignored.

---

### **`impl`**
The implementation is an async function that performs the processing logic. It should resolve when the work is complete. The promise from `hopperImpl` resolves or rejects with the result of `impl`.

---

The implementation is an async function which does the work and returns/resolves when the work is done, the hopperImpl promise resolves with this.

#### **`settings`**
The settings object is optional.  
Default: All settings disabled.

```ts
{
    key?: string
    softLimit?: number
    onSoftLimit?: (softLimit: number, queueLength: number)=>void
    hardLimit?: number
    onHardLimit?: (hardLimit: number)=>any
    onDrain?: ()=>boolean
}
```

##### **`key`**
- When provided, the queue associated with this key determines the execution order.
- Multiple processing functions can share the same queue, ensuring a consistent call order across different implementations or class instances.
- This is the opposite of parallelism: all processors with the same key share the order, but not the items themselves.
- Default: undefined (each processing function gets its own queue).

##### **`softLimit`** and **`onSoftLimit`**
- When both softLimit and onSoftLimit are defined, onSoftLimit is called when the queue length reaches or exceeds softLimit.
- The call is still queued and processed as usual.
- Parameters for onSoftLimit:
  - softLimit: The configured soft limit value.
  - queueLength: The current length of the queue.
- Default: undefined (no limit).

##### **`hardLimit`** and **`onHardLimit`**
- Similar to softLimit, but when the queue length reaches hardLimit, nothing is queued and the call is rejected.
- onHardLimit is called with the current hardLimit, and the value it returns is used as the rejection reason.
- Parameters for onHardLimit:
  - hardLimit: The configured hard limit value.
- Default: undefined (no limit).


##### **`onDrain`**
- If defined, onDrain is called when the queue becomes empty after processing the last task.
- If onDrain() returns true, it will be called again the next time the queue empties.
- If it returns false, it is removed from the settings object and thus not called again.
- Default: undefined - nothing is called.

# Examples

## As a stand alone function
```js

import Hopper from '@dusted/hopper';

// Define your async implementation
const processTask = Hopper(async (taskId: number) => {
  console.log(`Fetching data for task ${taskId}`);
  const data = await fetchDataFromDatabase(taskId); // Imagine this fetches data from a database
  console.log(`Processing data for task ${taskId}`);
  const processedData = processData(data); // Imagine this transforms the data in some way
  console.log(`Saving results for task ${taskId}`);
  await saveResultsToStorage(processedData); // Imagine this saves the processed data
  console.log(`Finished task ${taskId}`);
});

// Ingress some work
processTask(1);
processTask(2);
processTask(3);

// Output:
// Fetching data for task 1
// Processing data for task 1
// Saving results for task 1
// Finished task 1
// Fetching data for task 2
// Processing data for task 2
// Saving results for task 2
// Finished task 2
// Fetching data for task 3
// Processing data for task 3
// Saving results for task 3
// Finished task 3
```

## As a class member

```js
import Hopper from '@dusted/hopper';

class TaskManager {
  private tasksProcessed = 0;

  // Define the task processor
  processTask = Hopper(async (taskName: string) => {
    console.log(`Starting task: ${taskName}`);
    const data = await this.fetchData(taskName);
    const processedData = this.generateReport(data);
    await this.saveToDatabase(processedData);
    this.tasksProcessed++;
    console.log(`Task completed: ${taskName}. Total tasks processed: ${this.tasksProcessed}`);
  });
 
  /**
  Rest of class impl. left to readers imagination.
  *//
}

// Create an instance of TaskManager
const manager = new TaskManager();

// Call the Hopper-wrapped method directly
manager.processTask('Generate sales report');
manager.processTask('Send inventory update');
manager.processTask('Notify stakeholders');

// Output:
// Task completed: Generate sales report. Total tasks processed: 1
// Task completed: Send inventory update. Total tasks processed: 2
// Task completed: Notify stakeholders. Total tasks processed: 3

```

## Same queue, different implementations

```js
// Define two hoppers with different implementations but sharing the same queue
const hopperA = Hopper(async (value: number) => {
  console.log(`Hopper A processing: ${value}`);
  await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async work
  console.log(`Hopper A done with: ${value}`);
}, { key: 'sharedQueueName' });

const hopperB = Hopper(async (value: number) => {
  console.log(`Hopper B processing: ${value}`);
  await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate async work
  console.log(`Hopper B done with: ${value}`);
}, { key: 'sharedQueueName' });

// Add tasks to both hoppers
hopperA(1);
hopperB(2);
hopperA(3);
hopperB(4);

// Output:
// Hopper A processing: 1
// Hopper A done with: 1
// Hopper B processing: 2
// Hopper B done with: 2
// Hopper A processing: 3
// Hopper A done with: 3
// Hopper B processing: 4
```