var dbo = require('../util/dbo')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
const dispatchZmap = async () => {
    //find all zmaptask started,uncomplete and not paused
    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.findCol('task', { started: true, zmapComplete: false, paused: false }, (err, result) => {
        resolve(result)
      })
    })
    //for each of the task
    for (var task of zmaptasks) {
      //get its nodes
      const { nodes } = task
      //for each of its node
      for (var node of nodes) {
        //if broken,next
        if (brokenNodes.includes(node._id.toString()))
          continue
        //have any uncomplete ip?
        var re = await new Promise((resolve, reject) => {
          dbo.findoneCol('progress--' + task._id.toString(), { node: node._id, complete: false }, (err, result) => {
            resolve(result)
          })
        });
        var completeCount = await new Promise((resolve, reject) => {
          dbo.getCount('progress--' + task._id.toString(), { complete: true }, (err, result) => {
            resolve(result)
          })
        });
        var totalcount = await new Promise((resolve, reject) => {
          dbo.getCount('progress--' + task._id.toString(), {}, (err, result) => {
            resolve(result)
          })
        });
  
        // null means new nodetask should be distributed
        if (re == null && completeCount != totalcount) {
          //get a batch of undistributed iprange
          var iprList = await new Promise((resolve, reject) => {
            dbo.findlimitCol('progress--' + task._id.toString(), { node: null }, 10, (err, result) => {
              resolve(result)
            })
          });
          //length=0 means ips are all sent, but the last batch has not yet complete
          if (iprList.length == 0)
            continue
          //distribute
          let zmapRange = []
          let zmapRangeId = []
          for (var ipr of iprList) {
            zmapRange.push(ipr.ipr)
            zmapRangeId.push(ipr._id.toString())
          }
  
          let newZmapTask = {
            //info need not send to node
            nodeId: node._id,
            needToSync: false,
            received: false,
            taskId: task._id.toString(),
            ipRangeId: zmapRangeId,//this is needed for mark the progress talbe when the ips are completed
            resultCount: 0,
            resultReceived: 0,
            //task basic info          
            ipRange: zmapRange,
            port: task.port,
            ipTotal: zmapRange.length,
  
            //sync from node
            goWrong: false,
            progress: 0,
            complete: false,
            running: false,
  
            //sync to nod
            paused: false,
            deleted: false,
          }
          var result = await new Promise((resolve, reject) => {
            dbo.insertCol('nodeTask', newZmapTask, (err, result) => { resolve(result) })
          })
          //   logger.debug(result)
          //set the batch of iprange distributed
          for (var ipr of iprList) {
            await new Promise((resolve, reject) => {
              dbo.updateCol('progress--' + task._id.toString(), { _id: ipr._id }, { node: node._id }, (err, result) => { resolve(result) })
            })
          }
          logger.info('【distribution】for node【%s】: nodetask(%s) of task【%s】(%s)', node.name, result.insertedId, task.name, task._id)
        }
      }
  
    }
  }
const dispatch=()=>{
    dispatchZmap()
    //other dispatch
}
  const runDispatch=()=>{
      setInterval(dispatch,1000)
  }
  module.exports={
    runDispatch,
  }