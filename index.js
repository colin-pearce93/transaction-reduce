const async_parallel = require('async/parallel');
const async_series = require('async/series');

module.exports = (queries, { series }) => new Promise((resolve, reject) => {
  (series ? async_series : async_parallel)(Object.keys(queries).map(queryName => {
    return (callback) => {
      let tryfunc;
      if (typeof queries[queryName].try === 'undefined') {
        tryfunc = queries[queryName];
      } else {
        tryfunc = queries[queryName].try;
      }
      tryfunc()
        .then(data => {
          if (!data || typeof data === 'undefined') {
            data = 1;
          }
          callback(null, {[queryName]: data})
        })
        .catch(err => callback(null, {[queryName]: 0}))
    }
  }), (err, results) => {
    if (err) {
      reject(err);
    } else {
      let mergedObject = Object.assign({}, ...results);
      let successfulTransactions = Object.keys(mergedObject).reduce((accum, val, index, array) => {
        if (mergedObject[val]) {
          accum[val] = mergedObject[val];
        }
        return accum
      }, {});
      if (Object.keys(successfulTransactions).length < Object.keys(queries).length) {
        async_parallel(Object.keys(successfulTransactions).map(queryName => {
          return (callback) => {
            if (typeof queries[queryName].undo === 'undefined') {
              callback(null)
            } else {
              queries[queryName].undo()
                .then(() => callback(null))
                .catch(err => callback(err))
            }
          }
        }), (err) => {
            if (err) {
              reject(err)
            } else {
              reject(0)
            }
        })
      } else {
        resolve(successfulTransactions)
      }
    }
  })
});
