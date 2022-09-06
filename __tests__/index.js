require('jest');
jest.setTimeout(60000);
const { Worker } = require('worker_threads');
const { Diagnostics } = require('..');
const duration = 500;
describe('test Diagnostics', () => {

  test('Diagnostics', async () => {
    const diagnostics = new Diagnostics();
    await diagnostics.start();
    // Master
    let count = 0;
    const consumer = () => {
        count++;
    }
    await diagnostics.takeHeapSnapshot(consumer);
    expect(count > 0).toBe(true);

    count = 0;
    await diagnostics.trackHeapObjects({ duration }, consumer);
    expect(count > 0).toBe(true);

    {
        const profile = await diagnostics.getCpuProfile({ duration });
        expect(!!profile).toBe(true);
    }

    {
        const profile = await diagnostics.getHeapProfile({ duration });
        expect(!!profile).toBe(true);
    }

    expect(diagnostics.runCodeInMaster({ expression: "x.a" })).rejects.toThrow('x is not defined');
    await diagnostics.runCodeInMaster({ expression: "1 + 1" });

    count = 0;
    await diagnostics.collectTraceEvent({ duration, categories: ['node'] }, consumer);
    expect(count > 0).toBe(true);

    // Worker
    const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
    const sessionContext = await new Promise((rsolve) => {
        diagnostics.inspector.on('attachedToWorker', rsolve); 
    });
    const { sessionId } = sessionContext.getWorkerInfo();

    count = 0;
    await diagnostics.takeWorkerHeapSnapshot(sessionId, consumer);
    expect(count > 0).toBe(true);

    count = 0;
    await diagnostics.trackWorkerHeapObjects(sessionId, { duration }, consumer);
    expect(count > 0).toBe(true);

    {
        const profile = await diagnostics.getWorkerCpuProfile(sessionId, { duration });
        expect(!!profile).toBe(true);
    }

    {
        const profile = await diagnostics.getWorkerHeapProfile(sessionId, { duration });
        expect(!!profile).toBe(true);
    }

    await diagnostics.runCodeInWorker(sessionId, { expression: "1 + 1" });
    expect(diagnostics.runCodeInWorker(sessionId, { expression: "x.a" })).rejects.toThrow('x is not defined');
    
    worker.terminate();
    await diagnostics.stop();
  });
  
});
