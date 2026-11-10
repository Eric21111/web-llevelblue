import {useCallback,useEffect,useMemo,useSyncExternalStore} from 'react';
import {apiRequest} from '../utils/api';
import {directorySourceKey} from '../utils/directory';

const interval = 10_000;
const cache = new Map();
const watched = new Map();
const listeners = new Set();
let version = 0;
let session;
let timer;

function publish() {
  version++;
  for (const listener of listeners) listener();
}
function clearEntries() {
  for (const entry of cache.values()) entry.controller?.abort();
  cache.clear();
}
export function resetWorkspaceCache() {
  clearEntries();
  session = undefined;
  publish();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => version;

function load(url, force = false) {
  if (!session || session !== localStorage.getItem('token')) return;
  const previous = cache.get(url);
  if (previous?.request) return previous.request;
  const now = Date.now();
  if (!force && previous && now - previous.started < interval) return;

  const controller = new AbortController();
  const entry = {...previous, controller, started:now};
  cache.set(url, entry);
  entry.request = apiRequest(url, {signal:AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)])})
    .then(data => {
      if (cache.get(url) === entry) cache.set(url, {data, started:now, time:Date.now()});
    })
    .catch(error => {
      if (cache.get(url) === entry) cache.set(url, {error:error.message, started:now, time:Date.now()});
    })
    .finally(() => { if (!controller.signal.aborted) publish(); });
  return entry.request;
}

function poll() {
  if (!document.hidden) for (const url of watched.keys()) load(url, true);
}
function watch(urls) {
  for (const url of urls) watched.set(url, (watched.get(url) || 0) + 1);
  if (watched.size && !timer) {
    timer = setInterval(poll, interval);
    document.addEventListener('visibilitychange', poll);
  }
  return () => {
    for (const url of urls) {
      const count = watched.get(url) - 1;
      if (count) watched.set(url, count);
      else watched.delete(url);
    }
    if (!watched.size) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', poll);
    }
  };
}

// Only explicit workspace reads are cached. Each login starts a fresh session.
export function useWorkspaceQuery(sources, {paused=false}={}) {
  const key = directorySourceKey(sources);
  const entries = useMemo(() => JSON.parse(key), [key]);
  const token = localStorage.getItem('token');
  if (session !== token) { clearEntries(); session = token; }
  useSyncExternalStore(subscribe, snapshot);
  const refresh = useCallback(() => Promise.all(entries.map(([,url]) => load(url,true))), [entries]);
  useEffect(() => {
    for (const [url,entry] of cache) {
      if (!watched.has(url) && !entry.request && Date.now()-entry.started > 300_000) cache.delete(url);
    }
    const urls = entries.map(([,url]) => url);
    urls.forEach(url => load(url));
    if (!paused) return watch(urls);
  }, [entries,paused,token]);

  const data = {}, errors = {};
  let loading = false, latest = 0;
  for (const [name,url] of entries) {
    const entry = cache.get(url);
    if (entry?.error) errors[name] = entry.error;
    else if (entry?.data !== undefined) data[name] = entry.data;
    else loading = true;
    latest = Math.max(latest, entry?.time || 0);
  }
  return {data, errors, loading, refresh, refreshing:loading, updatedAt:latest ? new Date(latest) : null};
}

window.addEventListener('levelblue-data-changed', () => {
  for (const [url,entry] of cache) {
    entry.controller?.abort();
    cache.set(url, {...entry, controller:null, request:null, started:0});
  }
  for (const url of watched.keys()) load(url,true);
});
