var { connect } = require('./util/dbo')
var { logger } = require('./util/mylogger')
var { runZmapTask } = require('./tasks/zmap')
var { runPulse } = require('./tasks/pulse')

connect("mongodb://localhost:27017", 'cent', (err) => {
    err ? logger.info('db connection fail!') : logger.info('task runner starts!')
})

runZmapTask()
runPulse()