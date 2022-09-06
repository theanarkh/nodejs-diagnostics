const { ThreadInspector, util } = require('node-inspector');

class Diagnostics {
    inspector;
    constructor() {
        this.inspector = new ThreadInspector();
    }

    async takeHeapSnapshot(consumer) {
        this.inspector.on('HeapProfiler.addHeapSnapshotChunk', consumer);
        try {
            await this.inspector.post('HeapProfiler.takeHeapSnapshot');
        } catch(e) {
            throw e;
        } finally {
            this.inspector.removeListener('HeapProfiler.addHeapSnapshotChunk', consumer);
        }
    }
    
    async trackHeapObjects({ duration }, consumer) {
        this.inspector.on('HeapProfiler.addHeapSnapshotChunk', consumer);
        try {
            await this.inspector.post('HeapProfiler.startTrackingHeapObjects');
            await util.sleep(duration);
            await this.inspector.post('HeapProfiler.stopTrackingHeapObjects');
        } catch(e) {
            throw e;
        } finally {
            this.inspector.removeListener('HeapProfiler.addHeapSnapshotChunk', consumer);
        }
    }

    async getCpuProfile({ interval, duration } = {}) {
        await this.inspector.post('Profiler.enable');
        if (interval) {
            await this.inspector.post('Profiler.setSamplingInterval', { interval });
        }
        await this.inspector.post('Profiler.start');
        await util.sleep(duration);
        const { profile } = await this.inspector.post('Profiler.stop');
        await this.inspector.post('Profiler.disable');
        return profile;
    }
    
    async getHeapProfile({ interval, duration } = {}) {
        await this.inspector.post('HeapProfiler.enable');
        const params = interval ? { samplingInterval: interval } : {};
        await this.inspector.post('HeapProfiler.startSampling', params);
        await util.sleep(duration);
        const { profile } = await this.inspector.post('HeapProfiler.stopSampling');
        await this.inspector.post('HeapProfiler.disable');
        return profile;
    }

    runCodeInMaster(params) {
        return this.inspector.post("Runtime.evaluate", {
            includeCommandLineAPI: true, 
            ...params
        });
    }

    async collectTraceEvent(options, consumer) {
        const  { duration, categories } = options;
        await this.inspector.post('NodeTracing.start', { traceConfig: { includedCategories: categories } });
        await this.inspector.on('NodeTracing.dataCollected', consumer);
        try {
            await util.sleep(duration);
            await this.inspector.post('NodeTracing.stop');
        } catch(e) {
            throw e;
        } finally {
            this.inspector.removeListener('NodeTracing.dataCollected', consumer);
        }
    }

    _checkSessionId(sessionId) {
        const ctx = this.inspector.getSessions()[sessionId];
        if (!ctx) {
            throw new Error(`sessionId(${sessionId}) invalid`);
        }
        return ctx;
    }

    async takeWorkerHeapSnapshot(sessionId, consumer) {
        const ctx = this._checkSessionId(sessionId);
        ctx.on('HeapProfiler.addHeapSnapshotChunk', consumer);
        try {
            await this.inspector.postToWorker(sessionId, {
                method: 'HeapProfiler.takeHeapSnapshot'
            });
        } catch(e) {
            throw e;
        } finally {
            ctx.removeListener('HeapProfiler.addHeapSnapshotChunk', consumer);
        }
    }
    
    async trackWorkerHeapObjects(sessionId, { duration }, consumer) {
        const ctx = this._checkSessionId(sessionId);
        ctx.on('HeapProfiler.addHeapSnapshotChunk', consumer);
        try {
            await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.startTrackingHeapObjects' });
            await util.sleep(duration); 
            await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.stopTrackingHeapObjects' });
        } catch(e) {
            throw e;
        } finally {
            ctx.removeListener('HeapProfiler.addHeapSnapshotChunk', consumer);
        }
    }

    async getWorkerCpuProfile(sessionId, { interval, duration } = {}) {
        this._checkSessionId(sessionId);
        await this.inspector.postToWorker(sessionId, { method: 'Profiler.enable' });
        if (interval) {
            await this.inspector.postToWorker(sessionId, { method: 'Profiler.setSamplingInterval', params: { interval } });
        }
        await this.inspector.postToWorker(sessionId, { method: 'Profiler.start' });
        await util.sleep(duration);
        const { profile } = await this.inspector.postToWorker(sessionId, { method: 'Profiler.stop' });
        await this.inspector.postToWorker(sessionId, { method: 'Profiler.disable' });
        return profile;
    }
    
    async getWorkerHeapProfile(sessionId, { interval, duration } = {}) {
        this._checkSessionId(sessionId);
        await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.enable' });
        const params = interval ? { samplingInterval: interval } : {};
        await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.startSampling', params });
        await util.sleep(duration);
        const { profile } = await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.stopSampling' });
        await this.inspector.postToWorker(sessionId, { method: 'HeapProfiler.disable' });
        return profile;
    }

    runCodeInWorker(sessionId, params) {
        return this.inspector.postToWorker(sessionId, {
                method: "Runtime.evaluate", 
                params: {
                    includeCommandLineAPI: true, 
                    ...params
                }
        });
    }

    start() {
        return this.inspector.start();
    }

    stop() {
        return this.inspector.stop();
    }
}

module.exports = {
    Diagnostics,
}