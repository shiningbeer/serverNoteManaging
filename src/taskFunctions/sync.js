var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')


//本程序需要定时执行，每次执行时，将nodetask表的子任务发送给节点
const sendToNode = async () => {
  //找出所有节点没有接收到的子任务
  var notReceivedNodeTasks = await sdao.find('nodeTask', { received: false, deleted: false })
  for (var nodetask of notReceivedNodeTasks) {
    const { _id, nodeId, port, ipRange, ipRangeId, taskId, taskName, type, plugin } = nodetask
    //获取节点信息
    const t_node = await sdao.findone('node', { _id: nodeId })
    //如果节点不存在，则撤回该任务
    if (t_node == null) {
      //将其所带的ip在进度表中重置，异步（没有带await）
      for (var ip_id of ipRangeId) {
        sdao.update('progress--' + taskId, { _id: ip_id }, { node: null })
      }
      //将任务标注为删除，留待deleteMarked程序处理
      sdao.update('nodeTask', { _id }, { deleted: true })
      logger.warn('【撤回】:【任务%s】【节点%s】【子任务%s】【原因：节点不存在】!', taskName, name, _id)
      continue
    }
    const { url, token, name, } = t_node
    //如果节点断开连接，撤回该任务
    if (brokenNodes.includes(nodeId.toString())) {
      for (var ip_id of ipRangeId) {
        sdao.update('progress--' + taskId, { _id: ip_id }, { node: null })
      }
      sdao.update('nodeTask', { _id }, { deleted: true })
      logger.warn('【撤回】:【任务%s】【节点%s】【子任务%s】【原因：节点不在线】!', taskName, name, _id.toString())
      continue
    }

    //传递给节点的属性
    let newNodeTask = {
      taskId: _id.toString(),
      port,
      ipRange,
      paused: false,
      type,
      plugin

    }
    //访问节点
    nodeApi.task.add(url, token, newNodeTask, async (code, body) => {
      //如果接收成功，则更新子任务为已接收，否则什么都不做，留待下一次对其操作 
      if (code == 200) {
        logger.warn('【发送成功】:【任务%s】【节点%s】【子任务%s】!', taskName, name, _id.toString())
        await sdao.update('nodeTask', { _id }, { received: true, needToSync: false })
      }

    })

  }
}
//本程序是定时执行的程序，每次执行时将nodeTask表中标注删除的子任务删除
const deleteMarked = async () => {
  //找出所有标注为删除的子任务
  var deletedNodeTasks = await sdao.find('nodeTask', { deleted: true })

  for (var nodetask of deletedNodeTasks) {
    const { _id, nodeId, taskId, taskName } = nodetask

    //取出节点信息
    var t_node = await await sdao.findone('node', { _id: nodeId })

    //如果节点不存在，直接删除子任务
    if (t_node == null) {
      await sdao.delete('nodeTask', { _id: _id })
      continue
    }
    const name = t_node.name
    //如果任务还没接收到，所以没必要访问节点去通知，可以直接删除
    if (!nodetask.received) {
      await sdao.delete('nodeTask', { _id })
      logger.warn('【删除】node【%s】: direct deleted not received nodetask(%s) of task(%s)!', name, _id, taskId)
      logger.warn('【删除】:【任务%s】【节点%s】【子任务%s】!', taskName, name, _id.toString())
      continue
    }
    //如果节点不在线，则暂不处理
    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    //访问节点，通知节点删除任务
    nodeApi.task.delete(t_node.url, t_node.token, _id, async (code, body) => {
      //如果返回成功，则更新表，将其删除，否则留待下次处理，什么也不做 
      if (code == 200) {
        logger.warn('【删除】:【任务%s】【节点%s】【子任务%s】!', taskName, name, _id.toString())
        await sdao.delete('nodeTask', { _id: _id })
      }
    })
  }
}
//这是定时程序，每次执行时将nodetask表中注明需要同步的子任务，把paused同步到节点
const syncCommandToNode = async () => {
  //找出所有需要同步的子任务
  var needToSyncNodeTasks = await sdao.find('nodeTask', { needToSync: true, complete: false, deleted: false })
  for (var nodetask of needToSyncNodeTasks) {
    const { _id, nodeId, paused, taskName } = nodetask
    //如果节点不在线，则不处理
    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    //取出节点
    const t_node = await sdao.findone('node', { _id: nodeId })
    //如果节点不存在，不处理
    if (t_node == null)
      continue
    const { url, token, name } = t_node
    //访问节点以同步paused属性
    nodeApi.task.syncCommand(url, token, _id.toString(), paused, async (code, body) => {
      // 如果返回正确，则更新数据库，标注其已同步，否则不处理。
      if (code == 200) {
        logger.info('【Pause/Resume】 to node【%s】:sucessful!', name)
        logger.warn('【暂停/】:【任务%s】【节点%s】【子任务%s】!', taskName, name, _id.toString())
        await sdao.update('nodeTask', { _id: _id }, { needToSync: false })
      }
    })
  }
}
const syncProgressFromNode = async () => {
  //find all task started,uncomplete and not paused
  var ongoingTasks = await sdao.find('task', { started: true, complete: false, paused: false })
  //for each of the task
  for (var task of ongoingTasks) {
    //get all its uncompleted nodetasks, 
    var nodetasks = await sdao.find('nodeTask', { taskId: task._id.toString(), received: true, complete: false, deleted: false })

    for (var nodetask of nodetasks) {

      //converge the nodetasks progress and status to the task
      const { _id, ipRangeId, nodeId, taskId } = nodetask
      //if node is broken, the nodetask should be canceled
      const t_node = await sdao.findone('node', { _id: nodeId })

      //if the node is missing, omit
      if (t_node == null) {
        //put back its ip
        for (var ip_id of ipRangeId) {
          await sdao.update('progress--' + taskId, { _id: ip_id }, { node: null })
        }
        //set it deleted
        await sdao.update('nodeTask', { _id }, { deleted: true })
        logger.warn('【sent】to node【%s】: canceled nodetask(%s) of task【%s】!', name, _id, taskId)
        continue
      }
      const { url, token, name } = t_node
      const t_node_id = t_node._id
      if (brokenNodes.includes(nodeId.toString())) {
        //put back its ip
        for (var ip_id of ipRangeId) {
          await sdao.update('progress--' + taskId, { _id: ip_id }, { node: null })
        }
        //set it deleted
        await sdao.update('nodeTask', { _id }, { deleted: true })
        logger.warn("【progress】from node【%s】: canceled nodetask(%s) of task(%s)!", name, _id.toString(), taskId)
        continue
      }
      //then access the nodes to sync progress
      //take out the node

      //get the sync info, set the timeout longer as it may take time
      nodeApi.task.syncProgress(url, token, _id.toString(), 120000, async (code, body) => {
        if (code == 200) {
          logger.info('【progress】from node【%s】：nodetask(%s) of task(%s)!', name, _id, taskId)
          let {
            goWrong,
            progress,
            complete,
            running,
            resultCount,
          } = body

          logger.debug(body)
          if (complete) {
            for (var ip_id of ipRangeId) {
              await sdao.update('progress--' + taskId.toString(), { _id: ip_id }, { complete: true })
            }
            logger.warn('【Complete!】of node【%s】： nodetask(%s) of task(%s)!', name, _id, taskId)
          }
          //update the sever side nodetask
          await sdao.update('nodeTask', { _id: _id }, { progress, goWrong, complete, running, resultCount })

        }

      })
    }
  }
}




const runSync = () => {

  setInterval(() => {
    sendToNode()
    syncCommandToNode()
    syncProgressFromNode()
  }, 2500);
  setInterval(() => {
    deleteMarked()
  }, 10000)
}
module.exports = {
  runSync
}

