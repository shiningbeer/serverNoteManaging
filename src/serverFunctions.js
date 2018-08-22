var moment = require('moment')
var dbo = require('./serverdbo')
var nodeApi = require('./nodeApi')
var jwt = require('jwt-simple')
var fs = require('fs')

const OPER_STATUS = {
  new: 'new',
  wrong:'wrong',
  waiting:'waiting',
  run: 'run',
  pause: 'pause',
  complete: 'complete',
  delete: 'delete'
}
const TASK_STATUS={
  new:'new',
  run: 'run',
  wrong:'wrong',
  pause:'pause',
  complete:'complete',
  delete:'delete'
}
const TASK_STAGE={
  waiting:'waiting',
  runZmap:'runZmap',
  runScan:'runScan',
  complete:'complete'
}
const SCAN_STATUS = {
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
  dbo.task.update_by_taskId(taskId, {paused:newOperStatus}, (err, rest) => {
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
    let { pluginList, name,targetList} = newTask
    var ipRangeCount=0
    for(var target of targetList){
      ipRangeCount=ipRangeCount+target.lines
    }

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
        
        goWrong:false,
        brandNew:true,
        paused:true,

        zmapTotal:ipRangeCount,
        zmapProgress:0,
        zmapComplete:false,

        scanTotal:-1,
        scanProgress:0,
        scanComplete:false
      }
      dbo.task.add(newTaskToAdd, (err, rest) => { })
    }
    res.json('ok')
  },
  delete: async (req, res) => {
    var taskId = req.body.taskId
    if (taskId == null)
      return res.sendStatus(415)
    await new Promise((resolve, reject) => {
      dbo.nodeTask.update_by_taskId(taskId, { deleted:true}, (err, result) => {
        resolve(err)
      })
    });
    dbo.task.del(taskId, (err, rest) => {err ? res.sendStatus(500) : res.json('ok') })    
  },
  syncedToNode:async()=>{
      //get all nodeTasks
      var nodeTasks = await new Promise((resolve, reject) => {
        dbo.nodeTask.get({}, (err, result) => {
          resolve(result)
        })
      });

      //deal the nodetask in turn
      for (var nodetask of nodeTasks) {
        var nodeInfo = await new Promise((resolve, reject) => {
          dbo.node.getOne(nodetask.node._id, (err, result) => {
            resolve(result)
          })
        });
        // for the deleted
        if (nodetask.deleted){
          //if not received, delete directly
          if(!nodetask.taskReceived){
            dbo.nodeTask.del_by_nodeTaskId(nodetask._id, (err, result) => { })
            continue
          }
          //access the node api to delete the nodetask
          var syncCode = await new Promise((resolve, reject) => {
            nodeApi.nodeTask.delete(nodeInfo.url, nodeInfo.token, nodetask._id, (code, body) => {
              resolve(code)
            })
          });
          //if return code is right, delete the server's nodetask
          if (syncCode == 200) 
            dbo.nodeTask.del_by_nodeTaskId(nodetask._id, (err, result) => { })
          //go on to next nodetask
          continue          
        }
        //for the not received by node
        if(!nodetask.taskReceived){
          
          var syncCode = await new Promise((resolve, reject) => {
            nodeApi.nodeTask.add(nodeInfo.url, nodeInfo.token, nodetask, (code, body) => {
              resolve(code)
            })
          });
          // if return code is right, update the nodetask
          if (syncCode == 200) 
            dbo.nodeTask.update_by_nodeTaskId(nodetask._id, { taskReceived:true,needToNotifyOperChanged:false,syncTime: Date.now() }, (err, rest) => { })
          continue
        }
        //for the operation changed, that is ,the paused property of nodetask changed
        if (nodetask.needToNotifyOperChanged){
            var syncCode = await new Promise((resolve, reject) => {
              nodeApi.nodeTask.changeOper(nodeInfo.url, nodeInfo.token, nodetask._id, nodetask.paused, (code, body) => {
                resolve(code)
              })
            });
            if (syncCode == 200) 
              dbo.nodeTask.update_by_nodeTaskId(nodetask._id, { needToNotifyOperChanged:false,syncTime: Date.now()}, (err, rest) => { })
        }
        //for the nodetask needs to start scan but the order and the scan-range not received by the node
        if(nodetask.startScan&&!nodetask.scanRangeReceived){

        }
      }
      
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
      //allot each node with a nodetask with dispatched ip

      for (let i = 0; i < nodes.length; i++) {
        // structure of nodeTask table
        let newNodeTask = {
          taskId: task.id,
          taskName: task.name,
          node: nodes[i],
          plugin,
          createdAt: Date.now(),
          paused:false,

          taskReceived:false,
          scanRangeReceived:false,
          needToNotifyOperChanged: false,
          syncTime: Date.now(),
          goWrong:false,
          deleted:false,

          zmapRange: dispatchList[i],    
          zmapTotal:dispatchList[i].length,
          zmapProgress:0,
          zmapComplete:false,
          zmapResult:[],

          startScan:false,            
          scanRange:[],
          scanComplete:false,          
          scanProgress: 0,
          scanTotal:-1,
          scanResult:[],

          keyLog: [],
        }

        var insertedId = await new Promise((resolve, reject) => {
          dbo.nodeTask.add(newNodeTask, (err, rest) => {
            resolve(rest.insertedId)
          })
        });

      }
      dbo.task.update_by_taskId(task.id, { startAt: Date.now(),brandNew:false,paused:false}, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })

    }
    asyncActions()
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    await new Promise((resolve, reject) => {
      dbo.nodeTask.update_by_taskId(taskId, { paused:true, needToNotifyOperChanged:true}, (err, result) => {
        resolve(err)
      })
    });
    dbo.task.update_by_taskId(taskId, { paused:true }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  resume: async(req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)
    await new Promise((resolve, reject) => {
      dbo.nodeTask.update_by_taskId(taskId, { paused:false,needToNotifyOperChanged:true}, (err, result) => {
        resolve(err)
      })
    });
    dbo.task.update_by_taskId(taskId, { paused:false }, (err, rest) => {
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
  syncFromNode: async () => {
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
            
            let { nodeTaskId, keyLog,goWrong, zmapProgress, zmapResult,zmapComplete,scanProgress,scanComplete } = nodeTask
            dbo.nodeTask.update_by_nodeTaskId(nodeTaskId, { keyLog, goWrong, zmapProgress, zmapComplete,scanProgress,scanComplete, syncTime: Date.now() }, (err, rest) => { })
            for(var item of zmapResult){
            dbo.nodeTask.push_by_nodeTaskId(nodeTaskId,{zmapResult:item},(err, rest) => { })
            }
          }
        }
      })
    }    
  },
  collectNodeTasks:async()=>{
    //get all the task that zmap is not complete
    var zmapUnfinishedTasks = await new Promise((resolve, reject) => {
      dbo.task.get({zmapComplete:false}, (err, rest) => {
        resolve(rest)
      })
    })
    for (var task of zmapUnfinishedTasks) {
      //get all its node tasks
      let sum_progress=0
      dbo.nodeTask.get({ taskId: task._id.toString() }, (err, rest) => {
        let flag_complete = true//判断是否所有子任务都完成
        let flag_err = false//判断是否有出错的子任务
        for (var nodetask of rest) {
          let { goWrong, syncTime,zmapComplete,zmapProgress} = nodetask
          if (!zmapComplete)
            flag_complete = false
          if (goWrong) {
            flag_err = true
          }
          sum_progress = sum_progress + zmapProgress
        }
        dbo.task.update_by_taskId(task._id, { zmapComplete:flag_complete,goWrong:flag_err, zmapProgress:sum_progress}, (err, rest) => { }) 
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
