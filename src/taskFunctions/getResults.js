var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
const { taskSelector } = require('../tasks/selector')
const getResults = async () => {
    //取出数据库中所有结果未接受完毕的任务，循环处理
    const tasks = await sdao.find('task', { resultCollected: false })
    for (var task of tasks) {
        const taskId = task._id.toString()
        const taskName = task.name
        const taskStage = task.stage
        //根据任务类型，选择不同的处理函数
        const taskFunc = taskSelector(task.type)

        //找出该任务已经结束、但结果数和已经收到结果数不一致的子任务
        const nodetasks = await sdao.find('nodeTask', { taskId, complete: true, $where: "this.resultCount>this.resultReceived" })
        //如果没有，说明已发布子任务的结果已经全部传回，再加上如果这个任务已经完成，可以断定该任务的结果全部收到
        if (nodetasks.length==0) {
            if (task.complete == true) {
                taskFunc.markTaskResultCollected(taskStage, taskId, taskName)
            }
            continue
        }
        let nodetask=null
        //找到第一个节点在线的子任务
        for(var eachnt of nodetasks){
            if(eachnt.online){
                nodetask=eachnt
                break
            }
            else
                continue
        }
        if(nodetask==null)
            continue
        if (nodetask.resultGetting == true)
            continue
        //将这一条子任务的结果取回1000条
        const { nodeId, resultReceived, resultCount } = nodetask
        const nodetaskid = nodetask._id
        //取得node信息
        const node = await sdao.findone('node', { _id: nodeId })
        if (node == null)
            continue
        const { url, token, _id, name,online } = node
        if (!online)
            continue
        await sdao.update('nodeTask', { _id: nodetaskid }, { resultGetting: true })
        //访问节点，取回结果
        nodeApi.task.getResults(url, token, nodetaskid, resultReceived, 1000, async (code, body) => {
            await sdao.update('nodeTask', { _id: nodetaskid }, { resultGetting: false })
            if (code == 200) {
                let nowRC = resultReceived + body.length
                logger.info('[result]:[Task %s][node %s][subtask%s][progress %s/%s]', taskName, name, nodetaskid, nowRC, resultCount)
                await sdao.update('nodeTask', { _id: nodetaskid }, { resultReceived: nowRC })
                taskFunc.recordResult(taskStage, taskId, body)
            }
        })
    }
}

const runGetResults = async () => {
    await sdao.update('nodeTask',{resultGetting:true},{resultGetting:false})
    setInterval(getResults, 2500)
}
module.exports = {
    runGetResults
}