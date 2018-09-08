var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const addTask = {
  compo: async (user,newTask) => {
    let { pluginList, name, targetList, description } = newTask
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
        type: 'compo',
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

        // targetList:{
        //   zmap:targetList,
        //   scan:null
        // },
        // port: plugin.port,
        // total:{
        //   zmap:ipRangeCount,
        //   scan:null,
        // },
        // progress:{
        //   zmap:0,
        //   scan:0
        // },
        // complete:{
        //   zmap:false,
        //   scan:false,
        // },
        // resultCollected:{
        //   zmap:false,
        //   scan:false
        // },

        // plugin,


        //needed by zmap
        targetList,
        port: plugin.port,
        zmapTotal: ipRangeCount,
        zmapProgress: 0,
        zmapComplete: false,
        zmapResultCollected: false,

        //needed by scan
        plugin,
        scanTotal: -1,
        scanProgress: 0,
        scanComplete: false,

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
      await sdao.insert('results', newResut)
    }
  },
  zmap: async (user,newTask) => { },
  scan: async (user,newTtask) => { }
}
const task = {
  add: async (req, res) => {
    var newTask = req.body.newTask
        let user= req.tokenContainedInfo.user
    if (newTask == null)
      return res.sendStatus(415)
   let type='compo' 
    switch (type) {
      case 'compo':
        await addTask.compo(user,newTask)
        break
      case 'zmap':
        await addTask.zmap(user,newTask)
        break
      case 'scan':
        await addTask.scan(user,newTask)
        break
      default:
        wrong = true
    }
    res.json('ok')
  },
  delete: async (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)
    //delete progress table created when start the task
    await sdao.dropCol('progress--' + taskId)
    //delete the sub tasks produced by this task
    await sdao.update('nodeTask', { taskId }, { deleted: true })
    //delete the task it self
    await sdao.delete('task', { _id: taskId })
    res.json('ok')
  },

  start: async (req, res) => {
    var task = req.body.task
    var nodes = req.body.nodeList
    if (task == null || nodes == null)
      return res.sendStatus(415)
    var { targetList, plugin } = task
    //merge all the ip of targets
    let allIpRange = []
    for (var target of targetList) {
      let iprange = await sdao.findone('target', { _id: target._id })
      allIpRange.push(...iprange.ipRange)
    }
    //create the progress table for the task
    for (var ipr of allIpRange) {
      var ipR = { ipr, complete: false, node: null }
      await sdao.insert('progress--' + task._id.toString(), ipR)
    }
    //add the nodes
    for (var node of nodes) {
      await sdao.push('task', { _id: task._id }, { nodes: node })
    }
    await sdao.update('results', { _id: task._id }, { startAt: Date.now() })
    //update the task
    await sdao.update('task', { _id: task._id }, { started: true, paused: false })
    res.json('ok')
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)

    //set the related sub tasks which are not completed as paused
    await sdao.update('nodeTask', { taskId, complete: false }, { paused: true, needToSync: true, goWrong: false })
    //set the task itself as paused
    await sdao.update('task', { _id: taskId }, { paused: true })
    res.json('ok')
  },
  resume: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    //set the related sub tasks which are not completed as not paused
    await sdao.update('nodeTask', { taskId, complete: false }, { paused: false, needToSync: true })
    //set the task itself as not paused
    await sdao.update('task', { _id: taskId }, { paused: false })
    res.json('ok')
  },
  get: async (req, res) => {
    var condition = req.body
    if (condition == null)
      condition = {}
    let result = await sdao.findsort('task', condition, { createdAt: -1 })
    res.json(result)
  },
  getDetail: async (req, res) => {
    var id = req.body.id
    if (id == null)
      return res.sendStatus(415)
    let result=await sdao.findone('task', { _id: id })
    res.json(result)
  },

  nodeTaskResult: async (req, res) => { },

}
module.exports = {
  task,
}