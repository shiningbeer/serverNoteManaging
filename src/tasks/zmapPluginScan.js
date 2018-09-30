
var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
//针对zmap及plugin合成任务的任务函数
const zmapPluginScan = {
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
        ptCreated:false,

        //这些属性在zmap阶段给予zmap的属性，在zmap阶段完成之后，转而给予plugin扫描的属性
        targetList,
        port: plugin.port,
        total: ipRangeCount,
        progress: 0,
        complete: false,
        resultCollected: false,
        plugin,

        //指示任务所在的阶段，最初为zmap
        stage: 'zmap',

      }
      var rest = await sdao.insert('task', newTaskToAdd)

      //将结果文档预先插入数据表，该类任务拥有两个结果文档
      let newResut = {
        _id: rest.insertedId,
        port: newTaskToAdd.port,
        results: [],
        complete: false,
        startAt: null,
        completeAt: null,
        taskName: realTaskName
      }
      await sdao.insert('zmapResults', newResut)
      delete newResut.port
      newResut.plugin = plugin.name
      await sdao.insert('pluginResults', newResut)
      //插入任务的同时，为该任务建立进度表，进度表由该任务的所有目标合成   
      logger.info('[creating progress table]:[Task %s][stage %s]', realTaskName, 'zmap')
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
      await sdao.update('task', { _id: rest.insertedId}, { ptCreated:true})
      logger.info('[progress table created]:[Task %s][stage %s]', realTaskName, 'zmap')
    }
  },
  addSpecialFieldWhenDispatchNodeTask: (task, nodetask) => {
    //派发节点任务时，根据任务阶段的不同赋予不同属性
    task.stage == 'zmap' ? nodetask.port = task.port : nodetask.plugin = task.plugin
    task.stage == 'zmap' ? nodetask.type = 'zmap' : nodetask.type = 'plugin'
    return nodetask
  },
  //任务分发时，因为zmap阶段每一行ip为范围地址，不宜多，而plugin阶段一行为一个ip，必须多给
  getIpBatchCount: (stage) => {
    if (stage == 'zmap')
      return 10
    else
      return 200
  },
  markTaskResultCollected: async (stage, taskId, taskName, ) => {
    //确定结果已经完全取回时，如果是plugin阶段，直接标注即可
    if (stage == 'plugin') {
      logger.info('[result complete]:[Task%s][stage:%s]', taskName, stage)
      await sdao.update('task', { _id: taskId }, { resultCollected: true })
      await sdao.update('pluginResults', { _id: taskId }, { complete: true, completeAt: Date.now() })

    }
    //如果是zmap阶段，则需要以zmap阶段的结果作为目标，使任务继续完成plugin阶段的任务，因此需要在这里把任务改装成plugin
    else {
      //首先，标注zmap阶段完成
      logger.info('[result complete]:[Task%s][stage:%s]', taskName, stage)
      await sdao.update('zmapResults', { _id: taskId }, { complete: true, completeAt: Date.now() })
      let zmapResult = await sdao.findone('zmapResults', { _id: taskId })
      //给任务属性重新赋值，标注为plugin阶段
      await sdao.update('task', { _id: taskId }, { ptCreated:false,toES:false,complete: false, stage: 'plugin', progress: 0, targetList: taskId, total: zmapResult.results.length })
      logger.info('[creating progress table]:[Task %s][stage %s]', taskName, stage)
      //以Zmap阶段的结果来重建进度表
      await sdao.dropCol('progress--' + taskId.toString())
      for (var r of zmapResult.results) {
        var ipR = { ipr: r, complete: false, node: null }
        await sdao.insert('progress--' + taskId.toString(), ipR)
      }
      await sdao.update('task', { _id: taskId }, { ptCreated:true})
      logger.info('[progress table created]:[Task %s][stage %s]', taskName, stage)
    }
  },
  recordResult: async (stage, taskId, result) => {
    //根据任务阶段不同，异步插入结果
    if (stage == 'plugin') {
      sdao.push('pluginResults', { _id: taskId }, { results: {$eash:result} })
    }
    else {
      sdao.push('zmapResults', { _id: taskId }, { results: {$eash:result} })
    }
  },

}
module.exports = {
  zmapPluginScan
}