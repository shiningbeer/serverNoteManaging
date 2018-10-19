var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
const { taskSelector } = require('../tasks/selector')
const getResults = async () => {
    //取出数据库中所有结果未接受完毕的任务，判断结果是否取回
    const tasks = await sdao.find('task', { resultCollected: false })
    for (var task of tasks) {
        const taskId = task._id.toString()
        const taskName = task.name
        const taskStage = task.stage
        //根据任务类型，选择不同的处理函数
        const taskFunc = taskSelector(task.type)

        //找出该任务已经结束、但结果数和已经收到结果数不一致的子任务
        const nodetask = await sdao.findone('nodeTask', { taskId, complete: true, $where: "this.resultCount>this.resultReceived" })
        //如果没有，说明已发布子任务的结果已经全部传回，再加上如果这个任务已经完成，可以断定该任务的结果全部收到
        if (nodetask==null) {
            if (task.complete == true) {
                taskFunc.markTaskResultCollected(taskStage, taskId, taskName)
            }
        }
    }
    //取出所有在线结点
    const onlineNodes=await sdao.find('node',{online:true})
    for (var thenode of onlineNodes){
        //找到一个该节点的子任务，已经结束，但结果并没有完全传回
        const nodetask = await sdao.findone('nodeTask', { 'node._id':thenode._id.toString(), complete: true, $where: "this.resultCount>this.resultReceived" })

        if(nodetask==null)
            continue
        if (nodetask.resultGetting == true)
            continue
        //将这一条子任务的结果取回1000条
        const { _id,resultReceived, resultCount,taskId } = nodetask
        const { url, token, name} = thenode
        //获取任务信息
        const task=await sdao.findone('task',{_id:taskId})
        const taskId = task._id.toString()
        const taskName = task.name
        const taskFunc = taskSelector(task.type)
        await sdao.update('nodeTask', { _id}, { resultGetting: true })
        //访问节点，取回结果
        nodeApi.task.getResults(url, token, _id.toString(), resultReceived, 1000, async (code, body) => {
            await sdao.update('nodeTask', { _id}, { resultGetting: false })
            if (code == 200) {
                let nowRC = resultReceived + body.length
                logger.info('[result]:[Task %s][node %s][subtask%s][progress %s/%s]', taskName, name, _id.toString(), nowRC, resultCount)
                await sdao.update('nodeTask', { _id}, { resultReceived: nowRC })
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