
var dbo = require('../util/dbo')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')



const sendToNode = async () => {
  //find nodetasks
  var notReceivedNodeTasks = await new Promise((resolve, reject) => {
    dbo.findCol('nodeTask', { received: false, deleted: false }, (err, result) => {
      resolve(result)
    })
  });
  for (var nodetask of notReceivedNodeTasks) {
    const { _id, nodeId, port, ipRange, ipRangeId, taskId } = nodetask
    const t_node = await new Promise((resolve, reject) => {
      dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
        resolve(result)
      })
    })
    //if the node is missing, omit
    if (t_node == null) {
      //put back its ip
      for (var ip_id of ipRangeId) {
        dbo.updateCol('progress--' + taskId, { _id: ip_id }, { node: null }, (err, rest) => { })
      }
      //set it deleted
      dbo.updateCol('nodeTask', { _id }, { deleted: true }, (err, result) => { })
      logger.warn('【sent】to node【%s】: canceled nodetask(%s) of task【%s】!', name, _id, taskId)
      continue
    }
    const { url, token, name, } = t_node
    //for nodetask with broken node
    if (brokenNodes.includes(nodeId.toString())) {
      //put back its ip
      for (var ip_id of ipRangeId) {
        dbo.updateCol('progress--' + taskId, { _id: ip_id }, { node: null }, (err, rest) => { })
      }
      //set it deleted
      dbo.updateCol('nodeTask', { _id }, { deleted: true }, (err, result) => { })
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
      paused: false

    }
    //    logger.debug(_id)
    nodeApi.task.add(url, token, newNodeTask, (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【send】to node 【%s】: received successful nodetask(%s) of task(%s) !', name, _id.toString(), taskId)
        dbo.updateCol('nodeTask', { _id }, { received: true, needToSync: false }, (err, rest) => { })
      }

    })

  }
}
const deleteMarked = async () => {
  var deletedNodeTasks = await new Promise((resolve, reject) => {
    dbo.findCol('nodeTask', { deleted: true }, (err, result) => {
      resolve(result)
    })
  });

  for (var nodetask of deletedNodeTasks) {
    const { _id, nodeId, taskId } = nodetask

    //take out the node
    var t_node = await new Promise((resolve, reject) => {
      dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
        resolve(result)
      })
    })

    //if the node is missing, just delete the task
    if (t_node == null) {
      await new Promise((resolve, reject) => {
        dbo.deleteCol('nodeTask', { _id: _id }, (err, result) => { resolve(result) })

      })
      continue
    }
    const name = t_node.name
    // if not received, delete directly
    if (!nodetask.received) {
      await new Promise((resolve, reject) => {
        dbo.deleteCol('nodeTask', { _id }, (err, result) => { resolve(result) })
      })
      logger.warn('【deleteCommand】to node【%s】: direct deleted not received nodetask(%s) of task(%s)!', name, _id, taskId)
      continue
    }
    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    //access the node to delete the node side task
    nodeApi.task.delete(t_node.url, t_node.token, _id, (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【deleteCommand】to node【%s】:delete successful nodetask(%s) of task(%s)!', name, _id, taskId)
        dbo.deleteCol('nodeTask', { _id: _id }, (err, result) => { })
      }
    })
  }
}
const syncCommandToNode = async () => {
  //first deal deletedG



  //last to deal with the needToSync
  var needToSyncNodeTasks = await new Promise((resolve, reject) => {
    dbo.findCol('nodeTask', { needToSync: true, complete: false, deleted: false }, (err, result) => {
      resolve(result)
    })
  });
  for (var nodetask of needToSyncNodeTasks) {
    //take out the node
    const { _id, nodeId, paused } = nodetask

    if (brokenNodes.includes(nodeId.toString())) {
      continue
    }
    const t_node = await new Promise((resolve, reject) => {
      dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
        resolve(result)
      })
    })
    //if the node is missing, omit
    if (t_node == null)
      continue
    const { url, token, name } = t_node
    nodeApi.task.syncCommand(url, token, _id.toString(), paused, (code, body) => {
      // if return code is right, update the nodetask
      if (code == 200) {
        logger.info('【Pause/Resume】 to node【%s】:sucessful!', name)
        dbo.updateCol('nodeTask', { _id: _id }, { needToSync: false }, (err, rest) => { })
      }
    })
  }
}
const syncProgressFromNode = async () => {
  //find all task started,uncomplete and not paused
  var zmaptasks = await new Promise((resolve, reject) => {
    dbo.findCol('task', { started: true, zmapComplete: false, paused: false }, (err, result) => {
      resolve(result)
    })
  })
  //for each of the task
  for (var task of zmaptasks) {
    //get all its uncompleted nodetasks, 
    var nodetasks = await new Promise((resolve, reject) => {
      dbo.findCol('nodeTask', { taskId: task._id.toString(), received: true, complete: false, deleted: false }, (err, result) => {
        resolve(result)
      })
    });

    for (var nodetask of nodetasks) {

      //converge the nodetasks progress and status to the task
      const { _id, ipRangeId, nodeId, taskId } = nodetask
      //if node is broken, the nodetask should be canceled
      const t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
          resolve(result)
        })
      })

      //if the node is missing, omit
      if (t_node == null) {
        //put back its ip
        for (var ip_id of ipRangeId) {
          dbo.updateCol('progress--' + taskId, { _id: ip_id }, { node: null }, (err, rest) => { })
        }
        //set it deleted
        dbo.updateCol('nodeTask', { _id }, { deleted: true }, (err, result) => { })
        logger.warn('【sent】to node【%s】: canceled nodetask(%s) of task【%s】!', name, _id, taskId)
        continue
      }
      const { url, token, name } = t_node
      const t_node_id = t_node._id
      if (brokenNodes.includes(nodeId.toString())) {
        //put back its ip
        for (var ip_id of ipRangeId) {
          dbo.updateCol('progress--' + taskId, { _id: ip_id }, { node: null }, (err, rest) => { })
        }
        //set it deleted
        dbo.updateCol('nodeTask', { _id }, { deleted: true }, (err, result) => { })
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
              await new Promise((resolve, reject) => {
                dbo.updateCol('progress--' + taskId.toString(), { _id: ip_id }, { complete: true }, (err, rest) => {
                  resolve(err)
                })
              })
            }
            logger.warn('【Complete!】of node【%s】： nodetask(%s) of task(%s)!', name, _id, taskId)


          }
          //update the sever side nodetask
          dbo.updateCol('nodeTask', { _id: _id }, { progress, goWrong, complete, running, resultCount }, (err, result) => { })

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

