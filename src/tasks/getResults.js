var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
const getZmapResults = async () => {
    //find complete but result not been fully collected zmap task 
    const tasks = await sdao.find('task', { zmapComplete: true, zmapResultCollected: false })
    // logger.debug(tasks)
    for (var task of tasks) {
        const taskId = task._id.toString()
        const taskName = task.name
        logger.debug(taskId)

        //find all its node tasks that have completed but have't fully colllected results
        //find tasks where result count and result received count not equal
        const nodetasks = await sdao.find('nodeTask', { taskId, complete: true, $where: "this.resultCount>this.resultReceived" })
        //if no nodetask found, it means all collected,set the task zmapResultCollected=true
        if (nodetasks.length == 0) {
            logger.info('【result】: 【Complete】 collecting results for task 【%s】！', task.name)
            await sdao.update('task', { _id: taskId }, { zmapResultCollected: true })
            await sdao.update('results', { _id: taskId }, { complete: true, completeAt: Date.now() })
            continue
        }
        for (var nodetask of nodetasks) {
            const { nodeId, resultReceived, } = nodetask
            const nodetaskid = nodetask._id
            const node = await sdao.findone('node', { _id: nodeId })
            if (node == null)
                continue
            const { url, token, _id, name } = node
            if (brokenNodes.includes(_id.toString()))
                continue
            nodeApi.results.get(url, token, nodetaskid, resultReceived, 10, async (code, body) => {
                if (code == 200) {
                    logger.debug(body)
                    logger.info('【result】from node 【%s】:sucessful, nodetask【%s】of task【%s】', name, nodetaskid, taskName)
                    await sdao.update('nodeTask', { _id: nodetaskid }, { resultReceived: resultReceived + body.length })
                    for (var r of body) {
                        await sdao.push('results', { _id: taskId }, { results: r })
                    }
                }
            })
        }
    }
}
const getResults = () => {
    getZmapResults()
    //other getresult
}
const runGetResults = () => {
    setInterval(getResults, 2500)
}
module.exports = {
    runGetResults
}