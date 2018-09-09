
var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const zmapPluginScan = {
  add: async (newTask) => {
    let { type, pluginList, name, targetList, description, user } = newTask
    var ipRangeCount = 0
    for (var target of targetList) {
      ipRangeCount = ipRangeCount + target.lines
    }

    //split the task according to plugins
    for (var plugin of pluginList) {
      let name_without_ext = plugin.name.substring(0, plugin.name.length - 3)
      let realTaskName = name + '--' + name_without_ext
      let newTaskToAdd = {
        //common
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

        //needed by zmap
        targetList,
        port: plugin.port,
        total: ipRangeCount,
        progress: 0,
        complete: false,
        resultCollected: false,


        //needed by plugin
        stage: 'zmap',
        plugin,

      }
      var rest = await sdao.insert('task', newTaskToAdd)

      //create the result document
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
      //merge the ipRange
      let allIpRange = []
      for (var target of targetList) {
        let iprange = await sdao.findone('target', { _id: target._id })
        allIpRange.push(...iprange.ipRange)
      }
      //create the progress table for the task
      for (var ipr of allIpRange) {
        var ipR = { ipr, complete: false, node: null }
        await sdao.insert('progress--' + rest.insertedId.toString(), ipR)
      }
      logger.info('task %s successfully added, type %s, progress table created,two results documents created!', realTaskName, type)
    }
  },
  addSpecialFieldWhenDispatchNodeTask: (task, nodetask) => {
    task.stage == 'zmap' ? nodetask.port = task.port : nodetask.plugin = task.pluing
    return nodetask
  },
}
module.exports = {
  zmapPluginScan
}