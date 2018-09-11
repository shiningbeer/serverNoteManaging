var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
var { taskSelector } = require('../tasks/selector')
const dispatchZmap = async () => {
  //find all zmaptask started,uncomplete and not paused
  var unFinishedTasks = await sdao.find('task', { started: true, complete: false, paused: false })
  //for each of the task
  for (var task of unFinishedTasks) {
    //get its nodes
    const { nodes, type,stage } = task
    const taskFunc = taskSelector(type)
    //for each of its node
    for (var node of nodes) {
      //if broken,next
      if (brokenNodes.includes(node._id.toString()))
        continue
      //have any uncomplete ip?
      var re = await sdao.findone('progress--' + task._id.toString(), { node: node._id, complete: false })
      var completeCount = await sdao.getCount('progress--' + task._id.toString(), { complete: true })
      var totalcount = await sdao.getCount('progress--' + task._id.toString(), {})

      // null means new nodetask should be distributed
      if (re == null && completeCount != totalcount) {
        //get a batch of undistributed iprange
        const batchCount=taskFunc.getIpBatchCount(stage)
        var iprList = await sdao.findlimit('progress--' + task._id.toString(), { node: null }, batchCount)
        //length=0 means ips are all sent, but the last batch has not yet complete
        if (iprList.length == 0)
          continue
        //distribute
        let range = []
        let rangeId = []
        for (var ipr of iprList) {
          range.push(ipr.ipr)
          rangeId.push(ipr._id.toString())
        }

        let newNodeTask = {
          //info need not send to node
          nodeId: node._id,
          needToSync: false,
          received: false,
          taskId: task._id.toString(),
          ipRangeId: rangeId,//this is needed for mark the progress talbe when the ips are completed
          resultCount: 0,
          resultReceived: 0,
          //task basic info          
          ipRange: range,
          ipTotal: range.length,

          //sync from node
          goWrong: false,
          progress: 0,
          complete: false,
          running: false,

          //sync to nod
          paused: false,
          deleted: false,
        }
        newNodeTask = taskFunc.addSpecialFieldWhenDispatchNodeTask(task, newNodeTask)
        var result = await sdao.insert('nodeTask', newNodeTask)
        //set the batch of iprange distributed
        for (var ipr of iprList) {
          await sdao.update('progress--' + task._id.toString(), { _id: ipr._id }, { node: node._id })
        }
        logger.info('【distribution】for node【%s】: nodetask(%s) of task【%s】(%s)', node.name, result.insertedId, task.name, task._id)
      }
    }

  }
}
const dispatch = () => {
  dispatchZmap()
  //other dispatch
}
const runDispatch = () => {
  setInterval(dispatch, 1000)
}
module.exports = {
  runDispatch,
}