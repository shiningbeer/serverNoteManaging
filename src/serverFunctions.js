var moment = require('moment')
var dbo = require('./serverdbo')
var nodeApi = require('./nodeApi')
var jwt = require('jwt-simple')
var fs = require('fs')


const myMiddleWare = {
  verifyToken: (req, res, next) => {
    // the myMiddleWare always run twice out of no reason, one of these not taking my data, so i omiss one of these.
    if (req.get('access-control-request-method') == null) {
      console.log(req.originalUrl + ' has been accessed by %s at %s', req.ip, moment(Date.now()).format('YYYY-MM-DD HH:mm'))
      if (req.originalUrl != '/user/gettoken') {
        var token = req.get('token')
        let tokenContainedInfo
        try {
          tokenContainedInfo = jwt.decode(token, 'secrettt')
        }
        catch (e) {
          console.log('token wrong!')
          return res.sendStatus(401)
        }
        req.tokenContainedInfo = tokenContainedInfo
      }
    }
    next()
  },
}

const user = {
  add: (req, res) => {
    var newUser = req.body.newUser
    if (newUser == null)
      return res.sendStatus(415)
    let newUserToAdd = {
      ...newUser,
      taskCount: 0,
      lastLoginAt: Date.now(),
      lastLoginIp: '21.34.56.78'
    }
    //todo: verify validity of newUser
    dbo.user.add(newUserToAdd, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  delete: (req, res) => {
    var id = req.body.userId
    if (id == null)
      return res.sendStatus(415)
    dbo.user.del(id, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  modpw: (req, res) => {
    var id = req.body.userId
    var pw = req.body.pw
    if (id == null || pw == null)
      return res.sendStatus(415)
    dbo.user.update(id, { password: pw }, (err, rest) => {
      err ? res.sendStatus(500) : res.sendStatus(200)
    })
  },
  getToken: (req, res) => {
    var user = req.body.userName
    var pw = req.body.password
    if (user == null || pw == null)
      return res.sendStatus(415)
    dbo.user.get({ name: user, password: pw }, (err, result) => {
      if (err)
        res.sendStatus(500)
      else {
        if (result.length < 1)
          res.sendStatus(401)
        else {
          let userInfo = result[0]
          let token = jwt.encode({ user: userInfo.name, type: userInfo.authority }, 'secrettt')
          res.send({
            status: 'ok',
            type: 'account',
            currentAuthority: userInfo.authority,
            currentUser: userInfo.name,
            token: token
          })
        }
      }
    })
  },
  get: (req, res) => {
    var condition = req.body.condition
    if (condition == null)
      condition = {}
    dbo.user.get(condition, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
}



const changeOper = async (req, res, newOperStatus) => {
  var { taskId } = req.body
  if (taskId == null)
    return res.sendStatus(415)
  //update operStatus of each nodeTask
  // await new Promise((resolve, reject) => {
  //   dbo.nodeTask.update_by_taskId(taskId, { operStatus: newOperStatus }, (err, result) => {
  //     resolve(err)
  //   })
  // });
  // //get all the nodetasks of this task
  // var nodetasks = await new Promise((resolve, reject) => {
  //   dbo.nodeTask.get({ taskId }, (err, result) => {
  //     resolve(result)
  //   })
  // });
  // //sync the task state with nodes
  // let allOK = true;
  // for (var nodetask of nodetasks) {
  //   //get the nodes' info
  //   var nodeInfo = await new Promise((resolve, reject) => {
  //     dbo.node.getOne(nodetask.node._id, (err, result) => {
  //       resolve(result)
  //     })
  //   });
  //   //access the node api to sync task status
  //   var syncCode = await new Promise((resolve, reject) => {
  //     nodeApi.nodeTask.changeOper(nodeInfo.url, nodeInfo.token, nodetask._id, newOperStatus, (code, body) => {
  //       resolve(code)
  //     })
  //   });
  //   let syncStatus = syncCode == 200 ? SYNC_STATUS.ok : SYNC_STATUS.not_sync
  //   console.log(syncCode)
  //   if (syncCode != 200)
  //     allOK = false
  //   dbo.nodeTask.update_by_nodeTaskId(nodetask._id, { syncStatus, scanStatus }, (err, rest) => { })

  // }
  //in the end, update the status of task itself
  // let status=allOK?TASK_STATUS.run:TASK_STATUS.wrong
  dbo.task.update_by_taskId(taskId, { paused: newOperStatus }, (err, rest) => {
    err ? res.sendStatus(500) : res.json('ok')
  })
}

const keeper = {
  zmapTaskDistribute: async () => {
    //find all zmapIpAllSent=false and not paused and started
    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.task.get({ started: true, zmapIpAllSent: false, paused: false }, (err, result) => {
        resolve(result)
      })
    })

    for (var task of zmaptasks) {
      while (true) {
        //keep finding a useable node until no node available or no ipRange left
        var usableNode = await new Promise((resolve, reject) => {
          dbo.findoneCol('node' + task._id, { continue: true }, (err, result) => {
            resolve(result)
          })
        })
        //if no node available, break
        if (usableNode == null)
          break;
        //else, get a number of ipRange to distribute
        var ips = await new Promise((resolve, reject) => {
          dbo.findlimitCol('ipRange' + task._id, { sent: false }, 10, (err, result) => {
            resolve(result)
          })
        })
        // if no ipRange left
        if (ips.length == 0) {
          await new Promise((resolve, reject) => {
            dbo.task.update_by_taskId(task._id, { zmapIpAllSent: true }, (err, result) => { resolve(result) })
          })
          break;
        }
        //distribute
        let zmapRange = []
        for (var ip of ips) {
          zmapRange.push(ip.ip)
        }

        let newZmapTask = {
          //info need not send to node
          node: usableNode.node,
          needToSync: false,
          received: false,          
          taskId: task._id.toString(),

          //task basic info          
          ipRange: zmapRange,
          port: task.port,
          ipTotal: zmapRange.length,

          //sync from node
          goWrong: false,
          progress: 0,
          complete: false,
          running:false,

          //sync to node
          paused: false,
          deleted: false,


        }
        await new Promise((resolve, reject) => {
          dbo.insertCol('zmapNodeTask', newZmapTask, (err, result) => { resolve(result) })
        })
        await new Promise((resolve, reject) => {
          dbo.updateCol('node' + task._id, { _id: usableNode._id }, { continue: false }, (err, result) => { resolve(result) })
        })
        for (var ip of ips) {
          await new Promise((resolve, reject) => {
            dbo.updateCol('ipRange' + task._id, { _id: ip._id }, { sent: true }, (err, result) => { resolve(result) })
          })
        }
      }

    }
  },
  zmapToNodeSync: async () => {
    //first deal deleted
    var deletedTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { deleted: true }, (err, result) => {
        resolve(result)
      })
    });

    for (var task of deletedTasks) {
      //if not received, delete directly
      if (!task.received) {
        await new Promise((resolve, reject) => {
          dbo.deleteCol('zmapNodeTask', { _id: task._id.toString() }, (err, result) => { resolve(result) })
        })
        continue
      }
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: task.node._id }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, just delete the task
      if (t_node == null) {
        await new Promise((resolve, reject) => {
          dbo.deleteCol('zmapNodeTask', { _id: task._id.toString() }, (err, result) => { resolve(result) })

        })
        continue
      }
      //access the node to delete the node side task
      var syncCode = await new Promise((resolve, reject) => {
        nodeApi.zmapTask.delete(t_node.url, t_node.token, task._id.toString(), (code, body) => {
          resolve(code)
        })
      })
      //if return code is right, delete the server side task
      if (syncCode == 200) {
        await new Promise((resolve, reject) => {
          dbo.deleteCol('zmapNodeTask', { _id: task._id.toString() }, (err, result) => { resolve(result) })

        })
      }
    }

    //then deal the not received
    var notReceivedTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { received: false }, (err, result) => {
        resolve(result)
      })
    });

    for (var task of notReceivedTasks) {
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: task.node._id }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      //access the node to send the task
      var syncCode = await new Promise((resolve, reject) => {
        //delete the property not needed by node
        let newNodeTask={
          taskId:task._id.toString(),
          port:task.port,
          ipRange:task.ipRange,
          paused:false

        }
        nodeApi.zmapTask.add(t_node.url, t_node.token, newNodeTask, (code, body) => {
          resolve(code)
        })
      });
      // if return code is right, update the nodetask
      if (syncCode == 200)        
        await new Promise((resolve, reject) => {
          dbo.updateCol('zmapNodeTask', { _id: task._id}, { received: true, needToSync: false }, (err, rest) => { resolve(rest) })

        })
    }
    //last to deal with the needToSync
    var needToSyncTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { needToSync: true, complete: false }, (err, result) => {
        resolve(result)
      })
    });
    for (var task of needToSyncTasks) {
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: task.node._id }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      var syncCode = await new Promise((resolve, reject) => {
        nodeApi.zmapTask.syncCommand(t_node.url, t_node.token, task._id.toString(), task.paused, (code, body) => {
          resolve(code)
        })
      });
      if (syncCode == 200)
        await new Promise((resolve, reject) => {
          dbo.updateCol('zmapNodeTask', { _id: task._id.toString() }, { needToSync: false }, (err, rest) => { resolve(rest) })

        })
    }
  },
  zmapSyncProgress: async () => {
    //get not paused and not complete and not go wrong zmaptask
    var syncProgressTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { complete: false, paused: false,goWrong:false }, (err, result) => {
        resolve(result)
      })
    });
    for (var task of syncProgressTasks) {
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: task.node._id }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      var syncResult = await new Promise((resolve, reject) => {
        nodeApi.zmapTask.syncProgress(t_node.url, t_node.token, task._id.toString(), (code, body) => {
          code == 200 ? resolve(body) : resolve(null)
        })
      })
      if(syncResult==null)
        continue
      let {
        goWrong,
        progress,
        complete,
        running,
        latestResult,
      } = syncResult
      //update the sever side nodetask
      dbo.updateCol('zmapNodeTask',{_id:task._id},{progress,goWrong,complete,running},(err, result) => {})
      //record the results
      for (var r of latestResult)
        dbo.pushCol('task',{_id:task.taskId},{zmapResult:r},(err, result) => {})
    }
  },
  zmapCollect: async ()=>{
    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.task.get({ started: true, complete: false, paused: false }, (err, result) => {
        resolve(result)
      })
    })
    //if complete, set node continue=true,delete the completed
    //total progress: the number of ip sent - (batch -progress) of each node
    //if progress=total, the task is complete
    for (var task of zmaptasks){
      var sentCount = await new Promise((resolve, reject) => {
        dbo.findCol('ipRange' + task._id, { sent: false }, 10, (err, result) => {
          resolve(result)
        })
      });
    }

  }


}
const task = {
  add: (req, res) => {
    var newTask = req.body.newTask
    if (newTask == null)
      return res.sendStatus(415)
    //todo: verify validity of newtask
    //todo: verify if the plugin designated exists in local disk, if not, return the message 'missing plugin' to the server 
    let { pluginList, name, targetList, description } = newTask
    var ipRangeCount = 0
    for (var target of targetList) {
      ipRangeCount = ipRangeCount + target.lines
    }

    //split the task according to plugins
    for (var plugin of pluginList) {
      let name_without_ext = plugin.name.substring(0, plugin.name.length - 3)
      let newTaskToAdd = {
        //common
        taskType: 'zmapscan',
        name: name + '--' + name_without_ext,
        description,
        started: false,
        createdAt: Date.now(),
        user: req.tokenContainedInfo.user,
        goWrong: false,
        paused: true,
        nodes: [],

        //needed by zmap
        targetList,
        port: plugin.port,
        zmapTotal: ipRangeCount,
        zmapProgress: 0,
        zmapComplete: false,
        zmapIpAllSent: false,

        //needed by scan
        plugin,
        scanTotal: -1,
        scanProgress: 0,
        scanComplete: false,

        //results
        zmapResult:[],
        scanResult:[],
      }
      dbo.insertCol('task',newTaskToAdd, (err, rest) => { })
    }
    res.json('ok')
  },
  delete: async (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)

    //delete the two tables created when start the task
    dbo.dropCol('node' + taskId, (err, result) => { })
    dbo.dropCol('ipRange' + taskId, (err, result) => { })
    //delete the sub tasks produced by this task
    dbo.updateCol('zmapNodeTask', { taskId }, { deleted: true }, (err, result) => { })
    dbo.updateCol('scanNodeTask', { taskId }, { deleted: true }, (err, result) => { })
    //delete the task it self
    dbo.deleteCol('task',{_id:taskId},(err, rest) =>{ err ? res.sendStatus(500) : res.json('ok') })
  },

  start: async (req, res) => {
    var task = req.body.task
    var nodes = req.body.nodeList
    if (task == null || nodes == null)
      return res.sendStatus(415)
    var { targetList, plugin } = task

    //merge all the ip of targets
    let allIpRange = []
    for (var target of targetList) {
      var iprange = await new Promise((resolve, reject) => {
        dbo.target.getOne(target._id, (err, result) => {
          resolve(result)
        })
      });
      allIpRange.push(...iprange.ipRange)
    }
    //create the iptable for the task
    for (var ipr of allIpRange) {
      var ipR = { ip: ipr, sent: false }
      await new Promise((resolve, reject) => {
        dbo.insertCol('ipRange' + task.id, ipR, (err, rest) => { resolve(rest) })
      })
    }
    //create the node table for the task
    for (var node of nodes) {
      var n = { node, continue: true }
      await new Promise((resolve, reject) => {
        dbo.insertCol('node' + task.id, n, (err, rest) => { resolve(rest) })
      })
    }
    dbo.task.update_by_taskId(task.id, { started: true, paused: false }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)

    //set the related sub tasks which are not completed as paused
    await new Promise((resolve, reject) => {
      dbo.updateCol('zmapNodeTask', { taskId, complete: false }, { paused: true, needToSync: true }, (err, result) => { resolve(err) })
    });
    await new Promise((resolve, reject) => {
      dbo.updateCol('scanNodeTask', { taskId, complete: false }, { paused: true, needToSync: true }, (err, result) => { resolve(err) })
    });
    //set the task itself as paused
    dbo.updateCol('task',{_id:taskId}, { paused: true }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  resume: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    //set the related sub tasks which are not completed as not paused
    await new Promise((resolve, reject) => {
      dbo.updateCol('zmapNodeTask', { taskId, complete: false }, { paused: false, needToSync: true }, (err, result) => { resolve(err) })
    });
    await new Promise((resolve, reject) => {
      dbo.updateCol('scanNodeTask', { taskId, complete: false }, { paused: false, needToSync: true }, (err, result) => { resolve(err) })
    });
    //set the task itself as not paused
    dbo.updateCol('task',{_id:taskId}, { paused: false }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  get: (req, res) => {
    var condition = req.body
    if (condition == null)
      condition = {}
    dbo.task.get(condition, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
  getDetail: (req, res) => {
    var id = req.body.id
    if (id == null)
      return res.sendStatus(415)
    dbo.task.getOne(id, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
  getNodeTasks: (req, res) => {
    var id = req.body.id
    if (id == null)
      return res.sendStatus(415)
    dbo.nodeTask.get({ taskId: id }, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
  nodeTaskResult: (req, res) => {
    // var { nodeTaskId, nodeId, skip, limit } = req.body
    // if (nodeTaskId == null || skip == null || limit == null || nodeId == null)
    //   return res.sendStatus(415)

    // var asyncActions = async () => {
    //   var anode = await new Promise((resolve, reject) => {
    //     dbo.node.getOne(nodeId, (err, result) => {
    //       resolve(result)
    //     })
    //   })
    //   let { url, token } = anode
    //   var taskResult = await new Promise((resolve, reject) => {
    //     nodeApi.zmapTask.getResult(url, token, nodeTaskId, skip, limit, (code, body) => {
    //       //待做，如果code不为200，设置该节点不在线
    //       if (code == 200) {
    //         resolve(body)
    //       }
    //       else
    //         resolve({ code: code, body: body })
    //     })
    //   })

    //   res.json(taskResult)

    // }
    // asyncActions()

  },

  collectNodeTasks: async () => {
    //get all the task that zmap is not complete
    var zmapUnfinishedTasks = await new Promise((resolve, reject) => {
      dbo.task.get({ zmapComplete: false }, (err, rest) => {
        resolve(rest)
      })
    })
    for (var task of zmapUnfinishedTasks) {
      //get all its node tasks
      let sum_progress = 0
      dbo.nodeTask.get({ taskId: task._id.toString() }, (err, rest) => {
        let flag_complete = true//判断是否所有子任务都完成
        let flag_err = false//判断是否有出错的子任务
        for (var nodetask of rest) {
          let { goWrong, syncTime, zmapComplete, zmapProgress } = nodetask
          if (!zmapComplete)
            flag_complete = false
          if (goWrong) {
            flag_err = true
          }
          sum_progress = sum_progress + zmapProgress
        }
        dbo.task.update_by_taskId(task._id, { zmapComplete: flag_complete, goWrong: flag_err, zmapProgress: sum_progress }, (err, rest) => { })
        if (flag_complete) {
          //get all the zmapResult from the nodeTasks
          //restore it to db
          //split it to the number of nodetasks
          //give them to each nodetask, and set the start
        }
      })
    }
  }
}
const node = {
  add: (req, res) => {
    var newNode = req.body.newNode
    let newNodeToAdd = {
      ...newNode,
      user: req.tokenContainedInfo.user,
      ipLeft: 0,
      createdAt: Date.now(),
    }
    if (newNode == null)
      return res.sendStatus(415)
    //todo: verify validity of newnode
    dbo.node.add(newNodeToAdd, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  delete: (req, res) => {
    var id = req.body.nodeId
    if (id == null)
      return res.sendStatus(415)
    dbo.node.del(id, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  update: (req, res) => {
    var id = req.body.nodeId
    var update = req.body.update
    if (id == null || update == null)
      return res.sendStatus(415)
    dbo.node.update(id, update, (err, rest) => {
      err ? res.sendStatus(500) : res.sendStatus(200)
    })
  },
  get: (req, res) => {
    var condition = req.body.condition
    if (condition == null)
      condition = {}
    dbo.node.get(condition, (err, result) => {
      res.json(result)
    })
  },
}
const target = {
  add: (req, res) => {
    var newTarget = req.body.newTarget
    if (newTarget == null)
      return res.sendStatus(415)
    //todo: verify validity of newTarget
    let newTargetToAdd = {
      ...newTarget,
      usedCount: 8,
      ipTotal: 6555,
      lines: newTarget.ipRange.length,
      createdby: req.tokenContainedInfo.user
    }
    dbo.target.add(newTargetToAdd, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  delete: (req, res) => {
    var id = req.body.targetId
    if (id == null)
      return res.sendStatus(415)
    dbo.target.del(id, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  update: (req, res) => {
    var id = req.body.targetId
    var update = req.body.update
    if (id == null || update == null)
      return res.sendStatus(415)
    dbo.target.update(id, update, (err, rest) => {
      err ? res.sendStatus(500) : res.sendStatus(200)
    })
  },
  get: (req, res) => {
    var condition = req.body.condition
    if (condition == null)
      condition = {}
    dbo.target.get(condition, (err, result) => {
      res.json(result)
    })
  },
}
const uploadDir = './uploadPlugins/'
const plugin = {
  uploadDir,
  add: (req, res) => {
    var file = req.file
    try {
      fs.renameSync(uploadDir + file.filename, uploadDir + file.originalname)
    }
    catch (e) {
      return res.sendStatus(501)
    }
    //待做：如果已有同名插件，不添加记录
    //将插件名加入数据库
    var newplugin = {
      name: file.originalname,
      user: req.tokenContainedInfo.user,
      description: '',
      protocal: '',
      usedCount: 0,
      port: '',
      uploadAt: Date.now(),
    }
    dbo.plugin.add(newplugin, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  delete: (req, res) => {
    var pluginName = req.body.pluginName
    if (pluginName == null)
      return res.sendStatus(415)

    var asyncActions = async () => {
      var err = await new Promise((resolve, reject) => {
        fs.unlink(uploadDir + '/' + pluginName, (err) => {
          resolve(err)
        })
      })
      if (err)
        return res.sendStatus(500)
      dbo.plugin.del_by_name(pluginName, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })

    }
    asyncActions()

  },
  update: (req, res) => {
    const { name, update } = req.body
    if (name == null || update == null)
      return res.sendStatus(415)
    dbo.plugin.update_by_name(name, update, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  get: (req, res) => {
    let plugins
    try {
      plugins = fs.readdirSync(uploadDir)
    }
    catch (e) {
      return res.sendStatus(500)
    }

    let result = []
    var asyncActions = async () => {
      for (var item of plugins) {
        var oneplugin = await new Promise((resolve, reject) => {
          dbo.plugin.getOne_by_name(item, (err, rest) => {
            err ? resolve(null) : resolve(rest)
          })
        })
        if (oneplugin != null)
          result.push(oneplugin)
      }
      res.json(result)
    }
    asyncActions()


  },
}
const connectDB = (callback) => {
  dbo.connect("mongodb://localhost:27017", 'centDev2', callback)
}
module.exports = {
  myMiddleWare,
  user,
  keeper,
  task,
  node,
  target,
  plugin,
  connectDB,

}
