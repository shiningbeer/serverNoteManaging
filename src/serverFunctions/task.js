var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const { taskSelector } = require('../tasks/selector')

const task = {
  add: async (req, res) => {
    var newTask = req.body.newTask
    let user = req.tokenContainedInfo.user
    if (newTask == null)
      return res.sendStatus(415)
    newTask.type = 'zmapPluginScan'
    let taskFunc = taskSelector(newTask.type)
    newTask.user = req.tokenContainedInfo.user
    await taskFunc.add(newTask)
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
    let result = await sdao.findone('task', { _id: id })
    res.json(result)
  },

  nodeTaskResult: async (req, res) => { },

}
module.exports = {
  task,
}