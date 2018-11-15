var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')

const zmapScan = {
    add: async (newTask) => {
        let { type, port, name, targetList, description, user } = newTask
        var ipRangeCount = 0
        for (var target of targetList) {
            ipRangeCount = ipRangeCount + target.lines
        }
        let newTaskToAdd = {
            //一般性的任务属性，和其它类型的任务一致
            type,
            name,
            description,
            started: false,
            createdAt: Date.now(),
            startAt: null,
            completedAt: null,
            user,
            goWrong: false,
            paused: true,
            nodes: [],
            ptCreated: false,

            targetList,
            port:Number(port),
            total: ipRangeCount,
            progress: 0,
            complete: false,
            resultCollected: false,
            stage: 'zmap',

        }
        var rest = await sdao.insert('task', newTaskToAdd)
        let newResut = {
            _id: rest.insertedId,
            port: newTaskToAdd.port,
            complete: false,
            startAt: null,
            completeAt: null,
            taskName: realTaskName
        }
        await sdao.insert('zmapResults', newResut)

        //插入任务的同时，为该任务建立进度表，进度表由该任务的所有目标合成   
        logger.info('[creating progress table]:[Task %s][%s]', name, type)
        let allIpRange = []
        for (var target of targetList) {
            let iprange = await sdao.findone('target', { _id: target._id })
            allIpRange.push(...iprange.ipRange)
        }
        //将所有目标创建为进度表，以该任务id来标识
        for (var ipr of allIpRange) {
            var ipR = { ipr, complete: false, node: null }
            await sdao.insert('progress--' + rest.insertedId.toString(), ipR)
        }
        await sdao.update('task', { _id: rest.insertedId }, { ptCreated: true })
        logger.info('[progress table created]:[Task %s][%s]', name, type)
    },


    addSpecialFieldWhenDispatchNodeTask: (task, nodetask) => {
        //派发节点任务时，根据任务阶段的不同赋予不同属性
        nodetask.port = task.port
        nodetask.type = 'zmap'
        return nodetask
    },
    getIpBatchCount: (stage) => {
        return 10
    },
    getResultBatchCount: (stage) => {
        return 2000
    },
    markTaskResultCollected: async (stage, taskId, taskName, ) => {
        //确定结果已经完全取回时，直接标注即可
        logger.info('[result complete]:[Task%s]', taskName)
        await sdao.update('task', { _id: taskId }, { resultCollected: true })
      var count=await sdao.getCount(taskId+'--zr',{})
        await sdao.update('zmapResults', { _id: taskId }, { complete: true, completeAt: Date.now(),lines:count })
    },
    recordResult: async (stage, taskId, results) => {
      for (var result of results){
        await sdao.insert(taskId+'--zr', result)
      }
    },
}
module.exports = {
    zmapScan
} 
