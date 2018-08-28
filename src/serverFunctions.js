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



const keeper = {
  zmapTaskDistribute: async () => {
    //find all zmaptask started,uncomplete and not paused
    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.findCol('task',{ started: true, zmapComplete: false, paused: false }, (err, result) => {
        resolve(result)
      })
    }) 
    //for each of the task
    for (var task of zmaptasks) {
      //get its nodes
      const {nodes}=task
      //for each of its node
      for (var node of nodes){
        //have uncomplete ip?
        var re = await new Promise((resolve, reject) => {
          dbo.findoneCol('progress--' + task._id.toString(), { node:node._id,complete:false }, (err, result) => {
            resolve(result)
          })
        });
        // null means new nodetask should be distributed
        if(re==null){
          //get a batch of undistributed iprange
          var iprList = await new Promise((resolve, reject) => {
            dbo.findlimitCol('progress--' + task._id.toString(), { node: null }, 10, (err, result) => {
              resolve(result)
            })
          });
          //distribute
          let zmapRange = []
          let zmapRangeId=[]
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
            ipRangeId:zmapRangeId,//this is needed for mark the progress talbe when the ips are completed

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

          //set the batch of iprange distributed
          for (var ipr of iprList) {
            await new Promise((resolve, reject) => {
              dbo.updateCol('progress--' + task._id.toString(), { _id: ipr._id }, { node:node._id }, (err, result) => { resolve(result) })
            })
          }
        }
      }    

    }
  },
  zmapToNodeSync: async () => {
    //first deal deleted
    var deletedNodeTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { deleted: true }, (err, result) => {
        resolve(result)
      })
    });

    for (var nodetask of deletedNodeTasks) {
      
      // if not received, delete directly
      if (!nodetask.received) {
        await new Promise((resolve, reject) => {
          dbo.deleteCol('zmapNodeTask', { _id: nodetask._id}, (err, result) => { resolve(result) })
        })
        continue
      }
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: nodetask.nodeId }, (err, result) => {
          resolve(result)
        })
      })

      //if the node is missing, just delete the task
      if (t_node == null) {
        await new Promise((resolve, reject) => {
          dbo.deleteCol('zmapNodeTask', { _id: nodetask._id }, (err, result) => { resolve(result) })

        })
        continue
      }
      //access the node to delete the node side task
      nodeApi.zmapTask.delete(t_node.url, t_node.token, nodetask._id, (code, body) => {
        // if return code is right, update the nodetask
        if (code == 200)        
          dbo.deleteCol('zmapNodeTask', { _id: nodetask._id }, (err, result) => {})
      })
    }

    //then deal the not received
    var notReceivedNodeTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { received: false }, (err, result) => {
        resolve(result)
      })
    });
    for (var nodetask of notReceivedNodeTasks) {
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: nodetask.nodeId }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      //access the node to send the task
      let newNodeTask={
        taskId:nodetask._id.toString(),
        port:nodetask.port,
        ipRange:nodetask.ipRange,
        paused:false

      }
      nodeApi.zmapTask.add(t_node.url, t_node.token, newNodeTask, (code, body) => {
        // if return code is right, update the nodetask
        if (code == 200)        
          dbo.updateCol('zmapNodeTask', { _id: nodetask._id}, { received: true, needToSync: false }, (err, rest) => {})
      })
      
    }
    //last to deal with the needToSync
    var needToSyncNodeTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { needToSync: true, complete: false }, (err, result) => {
        resolve(result)
      })
    });
    for (var nodetask of needToSyncNodeTasks) {
      //take out the node
      var t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: nodetask.nodeId }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      
      nodeApi.zmapTask.syncCommand(t_node.url, t_node.token, nodetask._id.toString(), nodetask.paused, (code, body) => {
        // if return code is right, update the nodetask
        if (code == 200)        
          dbo.updateCol('zmapNodeTask', { _id: nodetask._id }, { needToSync: false }, (err, rest) => {})
      })
    }
  },
  zmapSyncProgress: async () => {
    //find all zmaptask started,uncomplete and not paused
    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.findCol('task',{ started: true, zmapComplete: false, paused: false }, (err, result) => {
        resolve(result)
      })
    })    
    //for each of the task
    for (var task of zmaptasks){
      //get its uncompleted, received and synced nodetasks
      var nodetasks = await new Promise((resolve, reject) => {
        dbo.findCol('zmapNodeTask', { received:true,needToSync:false,deleted:false}, (err, result) => {
          resolve(result)
        })
      });
      //totalprogress should be the complete count the iprange of the progress table, plus sum of the progress of ongoing nodetasks
      
      //for each, acess the node to sycn
      let totalProgress=0
      let totalGoWrong=false
      for (var nodetask of nodetasks) {
        //if it is complete
        if(nodetask.complete&&!completeRecorded){
          for(var ip_id of nodetask.ipRangeId){            
            await new Promise((resolve, reject) => {
              dbo.updateCol('progress--'+task._id.toString(),{_id:ip_id},{complete:true},(err,rest)=>{
                resolve(err)
              })})
          }
          await new Promise((resolve, reject) => {
            dbo.updateCol('zmapNodeTask',{_id:nodetask._id},{completeRecorded:true},(err,rest)=>{
              resolve(err)
            })})
          continue
          //写到这里
          
        }

        //take out the node
        var t_node = await new Promise((resolve, reject) => {
          dbo.findoneCol('node', { _id: nodetask.nodeId }, (err, result) => {
            resolve(result)
          })
        })
        
        //if the node is missing, omit
        if (t_node == null)
          continue
        //get the sync info, set the timeout longer as it may take time
        nodeApi.zmapTask.syncProgress(t_node.url, t_node.token, nodetask._id.toString(), 120000, (code, body) => {
          if (code == 200){
            let {
              goWrong,
              progress,
              complete,
              running,
              latestResult,
            } = body
            console.log(body)
            //update the sever side nodetask
            dbo.updateCol('zmapNodeTask',{_id:nodetask._id},{progress,goWrong,complete,running},(err, result) => {})
                    //record the results
            for (var r of latestResult)
              dbo.pushCol('task',{_id:nodetask.taskId},{zmapResult:r},(err, result) => {})
          }
          else{
            //this task's result may not be completely transfered to the server
            //this single nodetask should be marked and cannot be deleted, until the results is ensured transfered.
          }            
        })       
      }
      //sleep 1 second for waiting progress result be taken back, if the progress still not updated ,no problem ,wait for next time
      
        //collect info to update the main task progress
        

      // for(var nodetask of nodetasks){
      //   const {progress, complete,goWrong}=nodetask
      //   console.log(progress, complete,goWrong)
      //   totalProgress=totalProgress+progress
      //   if(goWrong)
      //     totalGoWrong=true
      //   //if complete, the nodetask's ips of the progress table should be marked as complete
      //   if(complete){
          

      //   } 
      // }
      //get complete count of the progress table
      var completeCount = await new Promise((resolve, reject) => {
        dbo.getCount('progress--'+task._id.toString(),{complete:true},(err, result) => {
          resolve(result)
        })
      });
      //if the complete count of the progress table = ipTotal, the task is complete
      if(completeCount==task.ipTotal)
        dbo.updateCol('task',{_id:task._id},{zmapComplete:true,zmapProgress:task.ipTotal},(err,rest)=>{})
      else{
        totalProgress=totalProgress+completeCount
        dbo.updateCol('task',{_id:task._id},{zmapProgress:totalProgress,goWrong:totalGoWrong},(err,rest)=>{})
      }

    }
  },
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
    console.log('begin delete')
    //delete progress table created when start the task
    dbo.dropCol('progress--' + taskId, (err, result) => { })
    //delete the sub tasks produced by this task
    dbo.updateCol('zmapNodeTask', { taskId }, { deleted: true }, (err, result) => {  console.log('set deleted')})
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
    console.log(nodes)
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
    //create the progress table for the task
    for (var ipr of allIpRange) {
      var ipR = { ipr, complete: false,node:null }
      await new Promise((resolve, reject) => {
        dbo.insertCol('progress--' + task._id.toString(), ipR, (err, rest) => { resolve(rest) })
      })
    }
    //add the nodes
    for(var node of nodes)
      dbo.pushCol('task',{_id:task._id},{nodes:node},(err,rest)=>{})
    //update the task
    dbo.updateCol('task',{_id:task._id}, { started: true, paused: false }, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  pause: async (req, res) => {
    var { taskId } = req.body
    if (taskId == null)
      return res.sendStatus(415)

    //set the related sub tasks which are not completed as paused
    await new Promise((resolve, reject) => {
      dbo.updateCol('zmapNodeTask', { taskId, complete: false }, { paused: true, needToSync: true,goWrong:false }, (err, result) => { resolve(err) })
    });
    await new Promise((resolve, reject) => {
      dbo.updateCol('scanNodeTask', { taskId, complete: false }, { paused: true, needToSync: true,goWrong:false }, (err, result) => { resolve(err) })
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
