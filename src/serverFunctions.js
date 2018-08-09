var moment = require('moment')
var dbo = require('./serverdbo')
var nodeApi = require('./nodeApi')
var jwt = require('jwt-simple')
var fs = require('fs')

const OPER_STATUS = {
  new: 'new',
  run: 'run',
  pause: 'pause',
  complete: 'complete',
  delete: 'delete'
}
const IMPL_STATUS = {
  wrong: 'wrong',
  waiting: 'waiting',
  running: 'running',
  complete: 'complete',
}
const ZMAP_STATUS = {
  wrong: 'wrong',
  waiting: 'waiting',
  running: 'running',
  complete: 'complete',
}
const SYNC_STATUS = {
  ok: 'ok',
  not_received: 'not received',
  not_sync: 'not sync'
}

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
  await new Promise((resolve, reject) => {
    dbo.nodeTask.update_by_taskId(taskId, { operStatus: newOperStatus }, (err, result) => {
      resolve(err)
    })
  });
  //get all the nodetasks of this task
  var nodetasks = await new Promise((resolve, reject) => {
    dbo.nodeTask.get({ taskId }, (err, result) => {
      resolve(result)
    })
  });
  //sync the task state with nodes
  let allOK = true
  for (var nodetask of nodetasks) {
    //get the nodes' info
    var nodeInfo = await new Promise((resolve, reject) => {
      dbo.node.getOne(nodetask.node._id, (err, result) => {
        resolve(result)
      })
    });
    //access the node api to sync task status
    var syncCode = await new Promise((resolve, reject) => {
      nodeApi.nodeTask.changeOper(nodeInfo.url, nodeInfo.token, nodetask._id, newOperStatus, (code, body) => {
        resolve(code)
      })
    });
    let implStatus = syncCode == 200 ? IMPL_STATUS.waiting : IMPL_STATUS.wrong
    let syncStatus = syncCode == 200 ? SYNC_STATUS.ok : SYNC_STATUS.not_sync
    console.log(syncCode)
    if (syncCode != 200)
      allOK = false
    dbo.nodeTask.update_by_nodeTaskId(nodetask._id, { syncStatus, implStatus }, (err, rest) => { })

  }
  //in the end, update the status of task itself
  let implStatus = allOK ? IMPL_STATUS.waiting : IMPL_STATUS.wrong
  dbo.task.update_by_taskId(taskId, { operStatus: newOperStatus, implStatus }, (err, rest) => {
    err ? res.sendStatus(500) : res.json('ok')
  })
}

const task = {
  add: (req, res) => {
    var newTask = req.body.newTask
    if (newTask == null)
      return res.sendStatus(415)
    //todo: verify validity of newtask
    //todo: verify if the plugin designated exists in local disk, if not, return the message 'missing plugin' to the server 
    let { pluginList, name } = newTask
    delete newTask.pluginList
    delete newTask.name
    for (var plugin of pluginList) {
      let name_without_ext = plugin.name.substring(0, plugin.name.length - 3)
      let newTaskToAdd = {
        ...newTask,
        name: name + '--' + name_without_ext,
        plugin,
        createdAt: Date.now(),
        user: req.tokenContainedInfo.user,
        percent: 0,
        operStatus: OPER_STATUS.new,
        implStatus: IMPL_STATUS.waiting,
      }
      dbo.task.add(newTaskToAdd, (err, rest) => { })
    }
    res.json('ok')
  },
  delete: (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)
    dbo.task.del(taskId, (err, rest) => { })
    var asyncActions = async () => {
      //get all the nodetasks of this task
      var nodetasks = await new Promise((resolve, reject) => {
        dbo.nodeTask.get({ taskId }, (err, result) => {
          resolve(result)
        })
      });
      //notify all the node to delete the nodetask
      for (var nodetask of nodetasks) {
        //get all the node info
        var nodeInfo = await new Promise((resolve, reject) => {
          dbo.node.getOne(nodetask.node._id, (err, result) => {
            resolve(result)
          })
        });
        //access the node api to delete the nodetask
        var syncCode = await new Promise((resolve, reject) => {
          nodeApi.nodeTask.delete(nodeInfo.url, nodeInfo.token, nodetask._id, (code, body) => {
            resolve(code)
          })
        });
        console.log(syncCode)
        //if return code is right, delete the server's nodetask
        if (syncCode == 200) {
          dbo.nodeTask.del_by_nodeTaskId(nodetask._id, (err, result) => { })
        }
        //otherwise, put operStatus as delete,syncStatus as not_sync, wait for the timing task to delete it later
        else {
          dbo.nodeTask.update_by_nodeTaskId(nodetask._id, { operStatus: OPER_STATUS.delete, syncStatus: SYNC_STATUS.not_sync }, (err, result) => { })
        }


      }
    }
    asyncActions()

    res.json('ok')


  },
  start: (req, res) => {
    var task = req.body.task
    var nodes = req.body.nodeList
    if (task == null || nodes == null)
      return res.sendStatus(415)
    var { targetList, plugin } = task
    //the following codes assume that the db operation will not go wrong, there is nothing has done for db exception.
    var asyncActions = async () => {
      let allIpRange = [], totalsum = 0

      //merge all the ip of targets
      for (var target of targetList) {
        var iprange = await new Promise((resolve, reject) => {
          dbo.target.getOne(target._id, (err, result) => {
            resolve(result)
          })
        });
        allIpRange.push(...iprange.ipRange)
        totalsum = totalsum + iprange.ipTotal
      }

      //dispatch the lines according to node counts.
      var { ipDispatch } = require('./ipdispatch2')
      let dispatchList = ipDispatch(allIpRange, nodes.length)
      console.log(dispatchList)
      //allot each node with a nodetask with dispatched ip
      let allOK = true
      for (let i = 0; i < nodes.length; i++) {
        // structure of nodeTask table
        let newNodeTask = {
          taskId: task.id,
          taskName: task.name,
          node: nodes[i],
          ipRange: dispatchList[i],
          plugin,
          ipCount: 65555,
          ipTotal: 0,
          createdAt: Date.now(),
          operStatus: OPER_STATUS.run,
          syncStatus: SYNC_STATUS.not_received,
          implStatus: IMPL_STATUS.waiting,
          zmapStatus: ZMAP_STATUS.waiting,
          progress: 0,
          keyLog: [],
          threadsDemand: 10000,
          threadsAllot: 0,
        }
        //get the url and token of this node.
        var nodeInfo = await new Promise((resolve, reject) => {
          dbo.node.getOne(nodes[i]._id, (err, result) => {
            resolve(result)
          })
        });
        //save the nodetask,and get its id after insertion of the document.
        var insertedId = await new Promise((resolve, reject) => {
          dbo.nodeTask.add(newNodeTask, (err, rest) => {
            resolve(rest.insertedId)
          })
        });
        //access the node api to issue the nodetask with newNodeTask as parameter.
        newNodeTask.nodeTaskId = insertedId
        delete newNodeTask.node
        delete newNodeTask._id
        delete newNodeTask.syncStatus
        var syncCode = await new Promise((resolve, reject) => {
          nodeApi.nodeTask.add(nodeInfo.url, nodeInfo.token, newNodeTask, (code, body) => {
            resolve(code)
          })
        });
        //mark the nodetask according to return code
        let implStatus = syncCode == 200 ? IMPL_STATUS.waiting : IMPL_STATUS.wrong
        let syncStatus = syncCode == 200 ? SYNC_STATUS.ok : SYNC_STATUS.not_received
        if (syncCode != 200)
          allOK = false
        dbo.nodeTask.update_by_nodeTaskId(insertedId, { syncStatus, implStatus }, (err, rest) => { })

      }
      //change the task status according to the above results
      let implStatus = allOK ? IMPL_STATUS.waiting : IMPL_STATUS.wrong
      dbo.task.update_by_taskId(task.id, { startAt: Date.now(), operStatus: OPER_STATUS.run, implStatus }, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })

    }
    asyncActions()
  },
  pause: (req, res) => {
    changeOper(req, res, OPER_STATUS.pause)
  },
  resume: (req, res) => {
    changeOper(req, res, OPER_STATUS.run)
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
    console.log(id)
    if (id == null)
      return res.sendStatus(415)
    dbo.nodeTask.get({ taskId: id }, (err, result) => {
      err ? res.sendStatus(500) : res.json(result)
    })
  },
  nodeTaskResult: (req, res) => {
    var { nodeTaskId, nodeId, skip, limit } = req.body
    if (nodeTaskId == null || skip == null || limit == null || nodeId == null)
      return res.sendStatus(415)

    var asyncActions = async () => {
      var anode = await new Promise((resolve, reject) => {
        dbo.node.getOne(nodeId, (err, result) => {
          resolve(result)
        })
      })
      let { url, token } = anode
      var taskResult = await new Promise((resolve, reject) => {
        nodeApi.nodeTask.getResult(url, token, nodeTaskId, skip, limit, (code, body) => {
          //待做，如果code不为200，设置该节点不在线
          console.log(code, body)
          if (code == 200) {
            resolve(body)
          }
          else
            resolve({ code: code, body: body })
        })
      })

      res.json(taskResult)

    }
    asyncActions()

  },
  syncNode: async () => {
    //取出所有node
    var nodes = await new Promise((resolve, reject) => {
      dbo.node.get({}, (err, rest) => {
        resolve(rest)
      })
    })
    //依次访问节点服务器
    for (var anode of nodes) {
      let { url, token } = anode
      nodeApi.nodeTask.syncTask(url, token, (code, body) => {
        //待做，如果code不为200，设置该节点不在线
        if (code == 200) {
          //将取回的nodetask数据更新到数据库
          //todo update node db of synctime
          for (var nodeTask of body) {
            console.log(nodeTask)
            let { nodeTaskId, keyLog, progress, ipTotal, implStatus, threadsAllot, zmapStatus } = nodeTask
            dbo.nodeTask.update_by_nodeTaskId(nodeTaskId, { keyLog, progress, threadsAllot, ipTotal, implStatus, zmapStatus, syncTime: Date.now() }, (err, rest) => { })
          }
        }
      })
    }
    //取得所有未完成任务
    var unfinishedTasks = await new Promise((resolve, reject) => {
      dbo.task.get({
        implStatus: { $ne: IMPL_STATUS.complete },
        operStatus: OPER_STATUS.run,
      }, (err, rest) => {
        resolve(rest)
      })
    })
    for (var task of unfinishedTasks) {
      //找出该任务所有的节点任务
      dbo.nodeTask.get({ taskId: task._id.toString() }, (err, rest) => {
        let flag_complete = true//判断是否所有子任务都完成
        let flag_err = false//判断是否有出错的子任务
        let err_msg = ''
        let sum_ipTotal = 0
        let sum_ipProgress = 0
        let sum_threads = 0
        for (var nodetask of rest) {
          let { threadsAllot, ipTotal, progress, implStatus } = nodetask
          if (implStatus != IMPL_STATUS.complete)
            flag_complete = false
          if (implStatus == IMPL_STATUS.wrong) {
            flag_err = true
          }
          sum_ipProgress = sum_ipProgress + progress
          sum_ipTotal = sum_ipTotal + ipTotal
          sum_threads = sum_threads + threadsAllot
        }
        if (flag_complete) {
          //标记任务已完成
          dbo.task.update_by_taskId(task._id, { implStatus: IMPL_STATUS.complete, operStatus: OPER_STATUS.complete }, (err, rest) => { })
        }

        if (flag_err) {
          //标记任务出错，记录错误信息
          dbo.task.update_by_taskId(task._id, { implStatus: IMPL_STATUS.wrong }, (err, rest) => { })
        }
        //记录进度和总数
        sum_ipTotal == 0 ? percent = 0 : percent = (sum_ipProgress / sum_ipTotal) * 100

        dbo.task.update_by_taskId(task._id, { progress: sum_ipProgress, ipTotal: sum_ipTotal, percent: percent, threads: sum_threads }, (err, rest) => { })
        if (percent == 100)
          dbo.task.update_by_taskId(task._id, { implStatus: IMPL_STATUS.complete, operStatus: OPER_STATUS.complete }, (err, rest) => { })

      })
    }
  },
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
  dbo.connect("mongodb://localhost:27017", 'cent', callback)
}
module.exports = {
  myMiddleWare,
  user,
  task,
  node,
  target,
  plugin,
  connectDB,

}
