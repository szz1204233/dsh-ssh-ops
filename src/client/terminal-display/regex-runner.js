function browserWorker() {
  // The build embeds the worker bundle so installed plugins need no extra URL
  // route and the worker has no host imports or network dependencies.
  // eslint-disable-next-line no-undef
  const source = typeof __DSH_HIGHLIGHT_WORKER_SOURCE__ === "undefined" ? "" : __DSH_HIGHLIGHT_WORKER_SOURCE__;
  if (!source) throw Error("Highlight worker is unavailable");
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const worker = new Worker(url);
    const terminate = worker.terminate.bind(worker);
    worker.terminate = () => { terminate(); URL.revokeObjectURL(url); };
    return worker;
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

// One serial worker shared by terminals and the preview. Coalesce queued work
// per owner; a timeout retires the worker and quarantines only that scheme.
export function createRegexRunner({ createWorker = browserWorker, timeoutMs = 150, startupMs = 2500 } = {}) {
  let worker, ready = false, active, timer, nextId = 0, references = 0;
  const queue = [], blocked = new Set();
  const retire = () => { clearTimeout(timer); const old = worker; worker = undefined; ready = false; old?.terminate(); };
  const settle = (value) => {
    clearTimeout(timer);
    const job = active; active = undefined;
    job?.resolve(value);
    pump();
  };
  const fail = (error) => {
    retire();
    if (active) settle({ error });
    else { queue.shift()?.resolve({ error }); pump(); }
  };
  const pump = () => {
    if (active || !queue.length) return;
    if (!worker) {
      try {
        const created = createWorker(); worker = created;
        worker.onmessage = ({ data }) => {
          if (worker !== created) return;
          if (data.ready) { clearTimeout(timer); ready = true; pump(); return; }
          if (active && data.id === active.id) settle(data);
        };
        worker.onerror = () => { if (worker === created) fail("worker-unavailable"); };
        timer = setTimeout(() => fail("worker-unavailable"), startupMs);
      } catch { const job = queue.shift(); job.resolve({ error: "worker-unavailable" }); pump(); }
      return;
    }
    if (!ready) return;
    active = queue.shift();
    if (blocked.has(active.signature)) { settle({ error: "regex-timeout" }); return; }
    const signature = active.signature;
    timer = setTimeout(() => {
      if (blocked.size >= 32) blocked.delete(blocked.values().next().value);
      blocked.add(signature); fail("regex-timeout");
    }, timeoutMs);
    try { worker.postMessage({ id: active.id, entries: active.entries, texts: active.texts }); }
    catch { fail("worker-unavailable"); }
  };
  return {
    acquire() {
      references++;
      const owner = {}, owned = new Set();
      let released = false;
      return {
        match(entries, texts) {
          if (released) return Promise.resolve({ cancelled: true });
          const signature = JSON.stringify(entries);
          if (blocked.has(signature)) return Promise.resolve({ error: "regex-timeout" });
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i].owner === owner) { queue[i].resolve({ cancelled: true }); queue.splice(i, 1); }
          }
          return new Promise((resolve) => {
            const done = (value) => { owned.delete(done); resolve(value); };
            owned.add(done);
            queue.push({ id: ++nextId, owner, signature, entries, texts, resolve: done }); pump();
          });
        },
        release() {
          if (released) return;
          released = true;
          for (let i = queue.length - 1; i >= 0; i--) if (queue[i].owner === owner) queue.splice(i, 1);
          for (const resolve of [...owned]) resolve({ cancelled: true });
          if (active?.owner === owner) { retire(); active = undefined; }
          if (--references === 0) { retire(); blocked.clear(); }
          else pump();
        }
      };
    }
  };
}
const runner = createRegexRunner();
export const acquireRegexMatcher = () => runner.acquire();
