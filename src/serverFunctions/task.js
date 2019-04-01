var { sdao } = require('../util/dao')
const { sdao: sdao_cidr } = require('../util/dao_cidr')
const { sdao: sdao_ipv4 } = require('../util/dao_ipv4')
var { logger } = require('../util/mylogger')
const { taskSelector } = require('../tasks/selector')
var elasticsearch = require('elasticsearch');

const task = {
  add: async (req, res) => {
    var newTask = req.body.newTask
    if (newTask == null)
      return res.sendStatus(415)
    const { type } = newTask
    // if (type == 'zmapPlugin') {
    //   res.json('ok')
    //   return
    // }

    // console.log(newTask)

    // let taskFunc = taskSelector(type)
    // newTask.user = req.tokenContainedInfo.user
    // await taskFunc.add(newTask)
    newTask.user = req.tokenContainedInfo.user
    if (type == 'port') {
      let ports = newTask.port.split(';')
      ports.map(async (item, index) => {
        let atask = {
          ...newTask,
          started: false,
          createdAt: Date.now(),
          startAt: null,
          completedAt: null,
          goWrong: false,
          paused: true,
          progress: 0,
          complete: false,
          deleted: false,
        }
        index==0 ?null:atask.name = `${atask.name}(${index + 1})`
        atask.port = item
        await sdao.insert('task', atask)
      })
    }
    else {
      let plugins = newTask.selectedPlugins
      plugins.map(async (item, index) => {
        let atask = {
          ...newTask,
          started: false,
          createdAt: Date.now(),
          startAt: null,
          completedAt: null,
          goWrong: false,
          paused: true,
          progress: 0,
          complete: false,
          deleted: false,
        }
        delete atask.selectedPlugins
        atask.plugin=item.name
        atask.name = `${atask.name}(${index + 1})`
        atask.port = item.port
        await sdao.insert('task', atask)
      })
    }


    res.json('ok')
  },
  delete: async (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)
    //delete progress table created when start the task
    // await sdao.dropCol('progress--' + taskId)
    //delete the sub tasks produced by this task
    // await sdao.update('nodeTask', { taskId }, { deleted: true })
    //delete the task it self
    await sdao.update('task', { _id: taskId }, { deleted: true })
    // await sdao_cidr.delete('taskInfo', { name: taskId.toString() })
    // await sdao_cidr.dropCol(taskId.toString())
    // await sdao_ipv4.delete('taskInfo', { name: taskId.toString() })
    // await sdao_ipv4.dropCol(taskId.toString())
    res.json('ok')
  },

  start: async (req, res) => {
    // console.log(req.body)
    var { taskId, } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    //update the task
    await sdao.update('task', { _id: taskId }, { started: true, paused: false, startAt: Date.now() })
    // await sdao_cidr.update('taskInfo', { name: taskId.toString() }, { pause: false })
    // await sdao_ipv4.update('taskInfo', { name: taskId.toString() }, { pause: false })
    res.json('ok')
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)

    //set the task itself as paused
    await sdao.update('task', { _id: taskId }, { paused: true })
    // await sdao_cidr.update('taskInfo', { name: taskId.toString() }, { pause: true })
    // await sdao_ipv4.update('taskInfo', { name: taskId.toString() }, { pause: true })
    res.json('ok')
  },
  resume: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    //set the task itself as not paused
    await sdao.update('task', { _id: taskId }, { paused: false })
    // await sdao_cidr.update('taskInfo', { name: taskId.toString() }, { pause: false })
    // await sdao_ipv4.update('taskInfo', { name: taskId.toString() }, { pause: false })
    res.json('ok')
  },
  get: async (req, res) => {
    var { condition } = req.body
    if (condition == null)
      return res.sendStatus(415)
    let where = {
      ...condition,
      deleted: false,
    }
    let result = await sdao.findsort('task', where, { createdAt: -1 })
    // console.log(result)
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