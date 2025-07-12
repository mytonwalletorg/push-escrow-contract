export function omitEmptyStrings<T extends object>(object?: T): T | undefined {
  if (!object) return object;

  return Object.keys(object).reduce((result, stringKey) => {
    const key = stringKey as keyof T;
    if (object[key] !== '') {
      result[key] = object[key];
    }
    return result;
  }, {} as T);
}
