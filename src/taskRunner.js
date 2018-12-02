var { adao, sdao } = require('./util/dao')
var { logger } = require('./util/mylogger')
var { runSync } = require('./taskFunctions/sync')
var { runPulse } = require('./taskFunctions/pulse')
var { runDispatch } = require('./taskFunctions/dispatch')
var { runGetResults } = require('./taskFunctions/getResults')
var { runCollect } = require('./taskFunctions/collect')
const { sdao: sdao_cidr } = require('./util/dao_cidr')
const { sdao: sdao_ipv4 } = require('./util/dao_ipv4')

adao.connect("mongodb://localhost:27017", 'cent', async (err) => {
    err ? logger.info('db connection fail!') : logger.info('task runner starts!')
    //the whole set of run task
    // runPulse()//pulse to the nodes to see if the nodes are on line
    // runDispatch()//split the task into nodetasks and dispatch them to the nodes
    // runSync()//sync commands to the nodes and sync progress from the nodes
    // runCollect()//collect progress from all nodetasks to the task, and mark the task complete when all its nodetasks complete
    // runGetResults()//fetch all results
    await sdao_cidr.connect("mongodb://localhost:27017", 'cidrTask')
    await sdao_ipv4.connect("mongodb://localhost:27017", 'ipv4Task')
    setInterval(async () => {
        var tasks_cidr = await sdao_cidr.find('taskInfo', {})
        for (var task of tasks_cidr) {
            var { progress, name } = task
            sdao.update('task', { _id: name }, { progress })

        }
        var tasks_ipv4 = await sdao_ipv4.find('taskInfo', {})
        for (var task of tasks_ipv4) {
            var { progress, name } = task
            sdao.update('task', { _id: name }, { progress })

        }
    }, 1000)

})
