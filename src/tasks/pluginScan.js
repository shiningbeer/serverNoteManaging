
var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const { sdao: sdao_ipv4 } = require('../util/dao_ipv4')

const pluginScan = {
    add: async (newTask) => {
        let { type, pluginList, name, targetList, description, user } = newTask
        var ipRangeCount = 0
        for (var target of targetList) {
            ipRangeCount = ipRangeCount + target.lines
        }

        //将任务根据插件拆分
        for (var plugin of pluginList) {
            let name_without_ext = plugin.name.substring(0, plugin.name.length - 3)
            let realTaskName = name + '--' + name_without_ext
            plugin.port = Number(plugin.port)
            let newTaskToAdd = {
                //一般性的任务属性，和其它类型的任务一致
                type,
                name: realTaskName,
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
                port: plugin.port,
                total: ipRangeCount,
                progress: 0,
                complete: false,
                resultCollected: false,
                plugin,

                stage: 'plugin',

            }
            var rest = await sdao.insert('task', newTaskToAdd)
            let new_task_ipv4 = {
                name: rest.insertedId.toString(),
                port: plugin.port,
                complete: false,
                pause: true,
                allSent: false,
                count: ipRangeCount,
                plugin: plugin.name.substring(0,plugin.name.length-3),
                error: false,
                progress: 0,
                createdby:'webpage'
            }
            //插入任务的同时，为该任务建立进度表，进度表由该任务的所有目标合成   
            logger.info('[creating progress table]:[Task %s][%s]', name, type)
            let allIpRange = []
            for (var target of targetList) {
                let iprange = await sdao.findone('target', { _id: target._id })
                allIpRange.push(...iprange.ipRange)
            }
            //将所有目标创建为进度表，以该任务id来标识
            for (var ipr of allIpRange) {
                var ipR = { ip: ipr, port: plugin.port, plugin: plugin.name.substring(0,plugin.name.length-3)}
                await sdao_ipv4.insert(rest.insertedId.toString(), ipR)
            }
            await sdao.update('task', { _id: rest.insertedId }, { ptCreated: true })
            logger.info('[progress table created]:[Task %s][%s]', realTaskName, type)
            await sdao_ipv4.insert("taskInfo", new_task_ipv4)
        }
    },
    addSpecialFieldWhenDispatchNodeTask: (task, nodetask) => {
        //派发节点任务时，根据任务阶段的不同赋予不同属性
        nodetask.plugin = task.plugin
        nodetask.type = 'plugin'
        return nodetask
    },
    getIpBatchCount: (stage) => {
        return 2000
    },
    getResultBatchCount: (stage) => {
        return 200
    },
    markTaskResultCollected: async (stage, taskId, taskName, ) => {
        //确定结果已经完全取回时，直接标注即可
        logger.info('[result complete]:[Task%s]', taskName)
        await sdao.update('task', { _id: taskId }, { resultCollected: true })
        var count = await sdao.getCount(taskId + '--pr', {})
        await sdao.update('pluginResults', { _id: taskId }, { complete: true, completeAt: Date.now(), lines: count })
    },
    recordResult: async (stage, taskId, results) => {
        for (var result of results) {
            await sdao.insert(taskId + '--pr', result)
        }
    },
}
module.exports = {
    pluginScan
} 
