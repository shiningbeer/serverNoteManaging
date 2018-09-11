var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')



const sendToNode = async () => {
  //find nodetasks
  var notReceivedNodeTasks = await sdao.find('nodeTask', { received: false, deleted: false })
  for (var nodetask of notReceivedNodeTasks) {
    const { _id, nodeId, port, ipRange, ipRangeId, taskId ,type,plugin} = nodetask
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
    const { url, token, name, } = t_node
    //for nodetask with broken node
    if (brokenNodes.includes(nodeId.toString())) {
      //put back its ip
      for (var ip_id of ipRangeId) {
        await sdao.update('progress--' + taskId, { _id: ip_id }, { node: null })
      }
      //set it deleted
      await sdao.update('nodeTask', { _id }, { deleted: true })
      logger.warn('【sent】to node【%s】: canceled nodetask(%s) of task【%s】!', name, _id, taskId)
      continue
    }


    //take out the node        


    const t_node_id = t_node._id
    if (brokenNodes.includes(t_node_id.toString()))
      continue
    //access the node to send the task
    let newNodeTask = {
      taskId: _id.toString(),
      port,
      ipRange,
      paused: false,
      type,
      plugin

    }
    //    logger.debug(_id)
    nodeApi.task.add(url, token, newNodeTask, async (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【send】to node 【%s】: received successful nodetask(%s) of task(%s) !', name, _id.toString(), taskId)
        await sdao.update('nodeTask', { _id }, { received: true, needToSync: false })
      }

    })

  }
}
const deleteMarked = async () => {
  var deletedNodeTasks = await sdao.find('nodeTask', { deleted: true })

  for (var nodetask of deletedNodeTasks) {
    const { _id, nodeId, taskId } = nodetask

    //take out the node
    var t_node = await await sdao.findone('node', { _id: nodeId })

    //if the node is missing, just delete the task
    if (t_node == null) {
      await sdao.delete('nodeTask', { _id: _id })
      continue
    }
    const name = t_node.name
    // if not received, delete directly
    if (!nodetask.received) {
      await sdao.delete('nodeTask', { _id })
      logger.warn('【deleteCommand】to node【%s】: direct deleted not received nodetask(%s) of task(%s)!', name, _id, taskId)
      continue
    }
    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    //access the node to delete the node side task
    nodeApi.task.delete(t_node.url, t_node.token, _id, async (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【deleteCommand】to node【%s】:delete successful nodetask(%s) of task(%s)!', name, _id, taskId)
        await sdao.delete('nodeTask', { _id: _id })
      }
    })
  }
}
const syncCommandToNode = async () => {
  //first deal deletedG



  //last to deal with the needToSync
  var needToSyncNodeTasks = await sdao.find('nodeTask', { needToSync: true, complete: false, deleted: false })
  for (var nodetask of needToSyncNodeTasks) {
    //take out the node
    const { _id, nodeId, paused } = nodetask

    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    const t_node = await sdao.findone('node', { _id: nodeId })
    //if the node is missing, omit
    if (t_node == null)
      continue
    const { url, token, name } = t_node
    nodeApi.task.syncCommand(url, token, _id.toString(), paused, async (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【Pause/Resume】 to node【%s】:sucessful!', name)
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

