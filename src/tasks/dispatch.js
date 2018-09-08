var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
const dispatchZmap = async () => {
    //find all zmaptask started,uncomplete and not paused
    var zmaptasks = await sdao.find('task', { started: true, zmapComplete: false, paused: false })
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
        var re = await sdao.findone('progress--' + task._id.toString(), { node: node._id, complete: false })
        var completeCount = await sdao.getCount('progress--' + task._id.toString(), { complete: true })
        var totalcount = await sdao.getCount('progress--' + task._id.toString(), {})
  
        // null means new nodetask should be distributed
        if (re == null && completeCount != totalcount) {
          //get a batch of undistributed iprange
          var iprList = await sdao.findlimit('progress--' + task._id.toString(), { node: null }, 10)
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
          var result = await sdao.insert('nodeTask', newZmapTask)
          //set the batch of iprange distributed
          for (var ipr of iprList) {
            await sdao.update('progress--' + task._id.toString(), { _id: ipr._id }, { node: node._id })
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