export function directorySourceKey(sources) {
  return JSON.stringify(Object.keys(sources).sort().map(key => [key, sources[key]]));
}
