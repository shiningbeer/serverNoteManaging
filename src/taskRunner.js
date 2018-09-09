var { adao } = require('./util/dao')
var { logger } = require('./util/mylogger')
var { runSync } = require('./taskFunctions/sync')
var { runPulse } = require('./taskFunctions/pulse')
var { runDispatch } = require('./taskFunctions/dispatch')
var { runGetResults } = require('./taskFunctions/getResults')
var { runCollect } = require('./taskFunctions/collect')

adao.connect("mongodb://localhost:27017", 'cent', (err) => {
    err ? logger.info('db connection fail!') : logger.info('task runner starts!')
})
//the whole set of run task
runPulse()//pulse to the nodes to see if the nodes are on line
runDispatch()//split the task into nodetasks and dispatch them to the nodes
runSync()//sync commands to the nodes and sync progress from the nodes
runCollect()//collect progress from all nodetasks to the task, and mark the task complete when all its nodetasks complete
runGetResults()//fetch all results