var dbo = require('../util/dbo')
var { logger } = require('../util/mylogger')
const addTask = {
  compo: (newTask) => {
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
        user: req.tokenContainedInfo.user,
        goWrong: false,
        paused: true,
        nodes: [],

        targetList:{
          zmap:targetList,
          scan:null
        },
        port: plugin.port,
        total:{
          zmap:ipRangeCount,
          scan:null,
        },
        progress:{
          zmap:0,
          scan:0
        },
        complete:{
          zmap:false,
          scan:false,
        },
        resultCollected:{
          zmap:false,
          scan:false
        },

        plugin,
        // //needed by zmap
        // targetList,
        // port: plugin.port,
        // zmapTotal: ipRangeCount,
        // zmapProgress: 0,
        // zmapComplete: false,
        // zmapResultCollected: false,

        // //needed by scan
        // plugin,
        // scanTotal: -1,
        // scanProgress: 0,
        // scanComplete: false,

      }
      dbo.insertCol('task', newTaskToAdd, (err, rest) => {

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
        dbo.insertCol('results', newResut, (e, r) => { })
      })
    }
  },
  zmap: (newTask) => { },
  scan: (newTtask) => { }
}
const task = {
  add: (req, res) => {
    var newTask = req.body.newTask
    if (newTask == null)
      return res.sendStatus(415)
    let { type } = newTask
    let wrong=false
    switch (type) {
      case null:
        addTask.compo(newTask)
        break
      case 'zmap':
        addTask.zmap(newTask)
        break
      case 'scan':
        addTask.scan(newTask)
        break
      default:
        wrong=true
    }
    wrong?res.sendStatus(500):res.json('ok')

  },
  delete: async (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)
    //delete progress table created when start the task
    dbo.dropCol('progress--' + taskId, (err, result) => { })
    //delete the sub tasks produced by this task
    dbo.updateCol('nodeTask', { taskId }, { deleted: true }, (err, result) => { })
    //delete the task it self
    dbo.deleteCol('task', { _id: taskId }, (err, rest) => { err ? res.sendStatus(500) : res.json('ok') })
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
      var iprange = await new Promise((resolve, reject) => {
        dbo.findoneCol('target', { _id: target._id }, (err, result) => {
          resolve(result)
        })
      });
      allIpRange.push(...iprange.ipRange)
    }
    //create the progress table for the task
    for (var ipr of allIpRange) {
      var ipR = { ipr, complete: false, node: null }
      await new Promise((resolve, reject) => {
        dbo.insertCol('progress--' + task._id.toString(), ipR, (err, rest) => { resolve(rest) })
      })
    }
    //add the nodes
    for (var node of nodes)
      dbo.pushCol('task', { _id: task._id }, { nodes: node }, (err, rest) => { })
    dbo.updateCol('results', { _id: task._id }, { startAt: Date.now() }, (err, rest) => { })
    //update the task
    dbo.updateCol('task', { _id: task._id }, { started: true, paused: false }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)

    //set the related sub tasks which are not completed as paused
    await new Promise((resolve, reject) => {
      dbo.updateCol('nodeTask', { taskId, complete: false }, { paused: true, needToSync: true, goWrong: false }, (err, result) => { resolve(err) })
    });
    //set the task itself as paused
    dbo.updateCol('task', { _id: taskId }, { paused: true }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  resume: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    //set the related sub tasks which are not completed as not paused
    await new Promise((resolve, reject) => {
      dbo.updateCol('nodeTask', { taskId, complete: false }, { paused: false, needToSync: true }, (err, result) => { resolve(err) })
    });
    //set the task itself as not paused
    dbo.updateCol('task', { _id: taskId }, { paused: false }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  get: (req, res) => {
    var condition = req.body
    if (condition == null)
      condition = {}
    dbo.findsortCol('task', condition, { createdAt: -1 }, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
  getDetail: (req, res) => {
    var id = req.body.id
    if (id == null)
      return res.sendStatus(415)
    dbo.findoneCol('task', { _id: id }, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },

  nodeTaskResult: (req, res) => {
    // var { nodeTaskId, nodeId, skip, limit } = req.body
    // if (nodeTaskId == null || skip == null || limit == null || nodeId == null)
    //   return res.sendStatus(415)

    // var asyncActions = async () => {
    //   var anode = await new Promise((resolve, reject) => {
    //     dbo.node.getOne(nodeId, (err, result) => {
    //       resolve(result)
    //     })
    //   })
    //   let { url, token } = anode
    //   var taskResult = await new Promise((resolve, reject) => {
    //     nodeApi.zmapTask.getResult(url, token, nodeTaskId, skip, limit, (code, body) => {
    //       //待做，如果code不为200，设置该节点不在线
    //       if (code == 200) {
    //         resolve(body)
    //       }
    //       else
    //         resolve({ code: code, body: body })
    //     })
    //   })

    //   res.json(taskResult)

    // }
    // asyncActions()

  },

}
module.exports = {
  task,
}