var expect = require('chai').expect,
conf = require('../conf')

describe('Config function', function () {
  this.timeout(10000)

  it('should get config json', function (done) {
    conf.
      init().
      then(function (json) {
        expect(json.studio).to.exist
      }).
      then(done, done)
  })

  it('should get all photos if config json is not found', function (done) {
    conf.
      init('photos/not-found-conf.json').
      then(function (json) {
        expect(json.studio).to.exist
      }).
      then(done, done)
  })
})
