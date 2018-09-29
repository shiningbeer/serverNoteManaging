var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const { taskSelector } = require('../tasks/selector')
var elasticsearch = require('elasticsearch');

const task = {
  add: async (req, res) => {
    var newTask = req.body.newTask
    if (newTask == null)
      return res.sendStatus(415)
    let taskFunc = taskSelector('zmapPlugin')
    newTask.user = req.tokenContainedInfo.user
    newTask.type='zmapPlugin'
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
    console.log(req.body)
    var { taskId, nodeList } = req.body
    if (taskId == null || nodeList == null)
      return res.sendStatus(415)
    //add the nodes
    for (var node of nodeList) {
      await sdao.push('task', { _id: taskId }, { nodes: node })
    }
    await sdao.update('results', { _id: taskId }, { startAt: Date.now() })
    //update the task
    await sdao.update('task', { _id: taskId }, { started: true, paused: false })
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
    var {condition} = req.body
    if (condition == null)
      return res.sendStatus(415)
    let result = await sdao.findsort('task', condition, { createdAt: -1 })
    res.json(result)
  },
  getDetail: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    let result = await sdao.findone('task', { _id: taskId })
    res.json(result)
  },

  getResult: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    let task = await sdao.findone('task', { _id: taskId })
    let result = []
    if (task.stage == 'zmap') {
      re = await sdao.findone('zmapResults', { _id: taskId })
      result = re.results
    }
    if (task.stage == 'plugin') {
      re = await sdao.findone('pluginResults', { _id: taskId })
      result = re.results

    }
    res.json(result)
  },
  resultToES: async (req, res) => {
    console.log(111)
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    let task = await sdao.findone('task', { _id: taskId })
    let result = []
    if (task.stage == 'zmap') {
      re = await sdao.findone('zmapResults', { _id: taskId })
      result = re.results
    }
    if (task.stage == 'plugin') {
      re = await sdao.findone('pluginResults', { _id: taskId })
      result = re.results

    }
    var client = new elasticsearch.Client({
      host: '192.187.10.150:9200',
      log: 'trace'
    });
    for (var r of result) {
      client.index({
        index: task.name, //相当于database
        type: 'data',  //相当于table
        body: r
      }, (error, response) => {
        // 
        console.log(error)
        console.log(response)
      });
    }
    await sdao.update('task', { _id: taskId }, { toES: true })
    res.json('ok')
  },

}
module.exports = {
  task,
}