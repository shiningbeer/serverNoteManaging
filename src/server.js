var express = require('express')
var bodypaser = require('body-parser')
var multer = require('multer')
const { myMiddleWare } = require('./serverFunctions/middleware')
const { user } = require('./serverFunctions/user')
const { task } = require('./serverFunctions/task')
const { node } = require('./serverFunctions/node')
const { target } = require('./serverFunctions/target')
const { plugin } = require('./serverFunctions/plugin')
const { adao } = require('./util/dao')

var { logger } = require('./util/mylogger')


var app = express()
app.use(bodypaser.urlencoded({
  extended: false
}))
app.use(bodypaser.json({ limit: '50mb' }));
app.use(bodypaser.urlencoded({ limit: '50mb', extended: true }));
app.use(myMiddleWare.verifyToken)
app.all('*', myMiddleWare.header);

var upload = multer({
  dest: plugin.uploadDir
})




//user
app.post('/user/add', user.add)
app.post('/user/delete', user.delete)
app.post('/user/modpw', user.modpw)
app.post('/user/gettoken', user.getToken)
app.post('/user/get', user.get)

//task
app.post('/task/add', task.add)
app.post('/task/delete', task.delete)
app.post('/task/start', task.start)
app.post('/task/pause', task.pause)
app.post('/task/resume', task.resume)
app.post('/task/get', task.get)
app.post('/task/getdetail', task.getDetail)
app.post('/task/getResult', task.getResult)



//node
app.post('/node/add', node.add)
app.post('/node/delete', node.delete)
app.post('/node/update', node.update)
app.post('/node/get', node.get)

//target
app.post('/target/add', target.add)
app.post('/target/delete', target.delete)
app.post('/target/update', target.update)
app.post('/target/get', target.get)

//plugin
app.post('/plugin/add', upload.single('file'), plugin.add)
app.post('/plugin/delete', plugin.delete)
app.post('/plugin/update', plugin.update)
app.post('/plugin/get', plugin.get)



//start server at localhost on the designated port
var server = app.listen(1978, function () {
  // var host = server.address().address
  // var port = server.address().port
  adao.connect("mongodb://localhost:27017", 'cent', (err) => {
    err ? logger.info('db connection fail!') : logger.info('server starts!')
  })


})

