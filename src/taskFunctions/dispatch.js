var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
var { taskSelector } = require('../tasks/selector')
//这是需要定时执行的程序，每次执行时为数据库中每一个未完成的任务根据条件创建节点子任务
//经过本程序的处理，针对每一个未完成的任务，会在nodetask表中为其每一个节点创建一个子任务，或者不创建（如果已有并且未完成），
//它将保证，nodetask表中，每个任务的每一个节点，只有一个子任务是未完成的，或者没有（任务快结束，剩余ip有够每个节点都分配）
const dispatch = async () => {
  //先排出所有符合分配节点任务的任务，已开始，未结束，没暂停
  var unFinishedTasks = await sdao.find('task', { started: true, complete: false, paused: false })
  for (var task of unFinishedTasks) {
    //假如该任务的进度表已经完全分配了，那该任务无法再分配任务
    var notDispatchedIpCount = await sdao.getCount('progress--' + task._id.toString(), { node: null })
    if (notDispatchedIpCount == 0)
      continue
    //取出需要的属性
    const { nodes, type, stage } = task
    //根据任务类型选择任务函数
    const taskFunc = taskSelector(type)
    //遍历其绑定的节点
    for (var node of nodes) {
      //如果节点是断开的，则无视
      if (brokenNodes.includes(node._id.toString()))
        continue
      //判断是否应该向该节点分发子任务的依据是，不存在该节点未完成的子任务
      var re = await sdao.findone('nodeTask', { nodeId: node._id.toString(), complete: false })
      var ntc=await sdao.getCount('nodeTask', { nodeId: node._id.toString(), complete: false })
      if(ntc>1)
        logger.fatal('[wrong]:[Task %s][node %s][uncomplete task greater than 1]', task.name, node.name)

      //这里的任务都是未结束的，如果这个节点的子任务全完成了，那么应该向它派发新的子任务 
      if (re == null) {
        //获取派发批次的量，zmap和plugin是不同的
        const batchCount = taskFunc.getIpBatchCount(stage)
        var iprList = await sdao.findlimit('progress--' + task._id.toString(), { node: null }, batchCount)
        //开始分配，这里需要保存这些ip的id，因为后续会用到。如果因为节点断开取消该任务，要将进度表中的这些ip重新置null
        let range = []
        let rangeId = []
        for (var ipr of iprList) {
          range.push(ipr.ipr)
          rangeId.push(ipr._id.toString())
        }

        let newNodeTask = {
          //以下这些属性不需要发送给节点，这是用来管理任务的，对节点透明
          nodeId: node._id.toString(),
          needToSync: false,
          received: false,
          taskId: task._id.toString(),
          taskName: task.name,
          ipRangeId: rangeId,
          resultCount: 0,
          resultReceived: 0,
          sending:false,
          resultGetting:false,
          //任务基本信息
          ipRange: range,
          ipTotal: range.length,

          //需要从节点获取的信息，预先写好字段
          goWrong: false,
          progress: 0,
          complete: false,
          running: false,

          //由于用户操作或其它原因产生变化，需要同步到节点的字段
          paused: false,
          deleted: false,
        }
        //根据任务类型，添加其它需要的字段
        newNodeTask = taskFunc.addSpecialFieldWhenDispatchNodeTask(task, newNodeTask)
        //创建任务
        var result = await sdao.insert('nodeTask', newNodeTask)
        //在进度表中设置这些ip分配给了这个节点
        for (var ipr of iprList) {
          
          sdao.update('progress--' + task._id.toString(), { _id: ipr._id }, { node: node._id })
        }
        logger.info('[dispatch]:[Task %s][node %s][subtask %s]', task.name, node.name, result.insertedId)
      }
    }

  }
}
const runDispatch = () => {
  setInterval(dispatch, 1000)
}
module.exports = {
  runDispatch,
}