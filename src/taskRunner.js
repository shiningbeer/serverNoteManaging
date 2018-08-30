var {connect}= require('./dbo/dbo')
var {logger}=require('./util/mylogger')
var {runZmapTask}=require('./tasks/zmap')

connect("mongodb://localhost:27017", 'centDev2', (err) => {
    err ? logger.info('db connection fail!') : logger.info('task runner starts!')
})
runZmapTask()