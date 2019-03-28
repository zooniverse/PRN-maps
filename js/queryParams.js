export function queryParams() {
  const queryString = window.location.search.substring(1);
  const queryPairs = queryString.split('&');
  return queryPairs.reduce(function (query, queryPair) {
    const [param, value] = queryPair.split('=');
    query[param] = value;
    return query;
  }, {});
}
