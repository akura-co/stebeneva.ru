var _ = require('underscore')
//var async = require('async')
var express = require('express')
var bodyParser = require('body-parser')
var sharp = require('sharp')
var multer = require('multer')
var fs = require('fs')
var uniqid = require('uniqid')
var packageName = require('../package').name
var config = _.extend(require('../config'), require(__dirname + '/../../.' + packageName))
var db = require('../db')
var loadConfig = require('../loadConfig')

module.exports = express.Router().
  use(bodyParser.json()).
  use(bodyParser.urlencoded({extended: true})).
  use(express.static(__dirname + '/ui')).//, {maxAge: '1 day'})).
  use((req, res, next) => {
      if (req.headers.authorization !== 'Basic ' + Buffer.from(config.auth.username + ':' + config.auth.password).toString('base64'))
        return res.set('WWW-Authenticate', 'Basic realm="' + packageName + '"').sendStatus(401)
      next()
    },
    multer({
      dest: '/tmp/',
      limits: {
        fileSize: 1 << 27, //134MB
      }
    }).any()
  ).
  get('/', (req, res) => {
    loadConfig((err, data) => {
      res.render(__dirname + '/index', {config: data})
    })
  }).
  post('/add', (req, res) => {
    var file = _.findWhere(req.files, {fieldname: 'file'})
    var filename = 'auto' + uniqid() + '.png'
    db.count('photo', {sectionId: req.body.sectionId}, (err, count) => {
      db.insert('photo', {created: {now: true}, sectionId: req.body.sectionId, filename: filename, position: count + 1}, (err, data) => {
        var photo = {id: data.insertId}
        var tmp = '/var/lib/mysql-files/stebeneva.ru/' + filename
        sharp(file.path).
          resize(config.slideSize.width, config.slideSize.height).
          toFile(tmp, () => {
            db.query('update ?? set ?? = load_file(?) where ?', ['photo', 'content', tmp, {id: photo.id}], () => {
              fs.unlink(file.path, () => {
                fs.unlink(tmp, () => {
                  db.select('photo', photo.id, ['id', 'created', 'sectionId', 'filename', 'frontpage', 'position'], (err, data) => {
                    res.json(_.extend({type: 'photo'}, data))
                  })
                })
              })
            })
          })
      })
    })
  }).
  post('/update', (req, res) => {
    function updatePosition (d, done) {
      if (_.isUndefined(d.position))
        return done()
      db.select('photo', d.id, ['sectionId', 'position'], (err, photo) => {
        db.query('update photo set position = position - 1 where ? and position > ?', [{sectionId: photo.sectionId}, photo.position], () => {
          db.query('update photo set position = position + 1 where ? and position >= ?', [{sectionId: photo.sectionId}, d.position], () => {
            done()
          })
        })
      })
    }
    updatePosition(req.body, () => {
      db.update('photo', +req.body.id, _.pick(req.body, _.without(loadConfig.photoField, ['id', 'content'])), () => {
        res.json({})
      })
    })
  }).
  post('/delete', (req, res) => {
    db.select('photo', +req.body.id, ['id', 'sectionId', 'position'], (err, photo) => {
      if (!photo)
        return res.sendStatus(400)
      db.delete('photo', photo.id, () => {
        db.query('update photo set position = position - 1 where ? and position > ?', [{sectionId: photo.sectionId}, photo.position], () => {
          res.json({})
        })
      })
    })
  })
