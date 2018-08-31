
var dbo = require('../util/dbo')
var nodeApi = require('../util/nodeApi')
var {logger}=require('../util/mylogger')
let brokenNodes=[]
let nodeConnectFailTime={}


const  distribute= async () => {
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
        //if broken,next
        if(brokenNodes.includes(node._id.toString()))
          continue
        //have any uncomplete ip?
        var re = await new Promise((resolve, reject) => {
          dbo.findoneCol('progress--' + task._id.toString(), { node:node._id,complete:false }, (err, result) => {
            resolve(result)
          })
        });
        var completeCount = await new Promise((resolve, reject) => {
          dbo.getCount('progress--'+task._id.toString(),{complete:true},(err, result) => {
            resolve(result)
          })
        });
        var totalcount = await new Promise((resolve, reject) => {
          dbo.getCount('progress--' + task._id.toString(), { }, (err, result) => {
            resolve(result)
          })
        });

        // null means new nodetask should be distributed
        if(re==null&&completeCount!=totalcount){
          //get a batch of undistributed iprange
          var iprList = await new Promise((resolve, reject) => {
            dbo.findlimitCol('progress--' + task._id.toString(), { node: null }, 10, (err, result) => {
              resolve(result)
            })
          });
          //length=0 means ips are all sent, but the last batch has not yet complete
          if(iprList.length==0)
            continue
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
          var result=await new Promise((resolve, reject) => {
            dbo.insertCol('zmapNodeTask', newZmapTask, (err, result) => { resolve(result) })
          })
        //   logger.debug(result)
          //set the batch of iprange distributed
          for (var ipr of iprList) {
            await new Promise((resolve, reject) => {
              dbo.updateCol('progress--' + task._id.toString(), { _id: ipr._id }, { node:node._id }, (err, result) => { resolve(result) })
            })
          }
          logger.info('node--%s: had been distributed a task(%s),nodetask of %s(%s)',node.name,result.insertedId,task._id,task.name)
        }
      }    

    }
  }
  const sendToNode=async ()=>{
    //find nodetasks
    var notReceivedNodeTasks = await new Promise((resolve, reject) => {
        dbo.findCol('zmapNodeTask', { received: false,deleted:false}, (err, result) => {
          resolve(result)
        })
      });
    for (var nodetask of notReceivedNodeTasks) {
        //take out the node        
        const {_id,nodeId,port,ipRange,ipRangeId,taskId}=nodetask
        const t_node = await new Promise((resolve, reject) => {
          dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
            resolve(result)
          })
        })
        //if the node is missing, omit
        if (t_node == null)
          continue
        const {url,token,name,}=t_node
        const t_node_id=t_node._id
        if(brokenNodes.includes(t_node_id.toString()))
          continue
        //access the node to send the task
        let newNodeTask={
          taskId:_id.toString(),
          port,
          ipRange,
          paused:false
  
        }
            //    logger.debug(_id)
        nodeApi.zmapTask.add(url, token, newNodeTask, (code, body) => {
          // if return code is right, update the nodetask
          if (code == 200){
            logger.info('node %s: nodetask(%s) of task(%s) had been sucessfully received!',name,_id.toString(),taskId)
            dbo.updateCol('zmapNodeTask', { _id}, { received: true, needToSync: false }, (err, rest) => {})
          }
          else{
            logger.error('node %s: nodetask(%s) of task(%s) had been faild to send!',name,_id.toString(),taskId)
            if (nodeConnectFailTime[t_node_id]==null)
              nodeConnectFailTime[t_node_id]=1
            else
              nodeConnectFailTime[t_node_id]=nodeConnectFailTime[t_node_id]+1
            if(nodeConnectFailTime[t_node_id]==2){
              logger.warn("node--%s: is broken, the system will not distribute or send task to it!",name)
              brokenNodes.push(t_node_id.toString())
              //put back its ip
              for(var ip_id of ipRangeId){
                dbo.updateCol('progress--'+taskId,{_id:ip_id},{node:null},(err, rest) => {})
              }
               //set the task deleted
               logger.debug(_id)
               dbo.updateCol('zmapNodeTask', {_id }, { deleted: true }, (err, result) => { })
              logger.warn("node--%s: nodetask(%s) of task(%s) had been canceled!",name,_id.toString(),taskId)
            }
              
          }
        })
        
      }
  }
  const deleteMarked=async()=>{
    var deletedNodeTasks = await new Promise((resolve, reject) => {
        dbo.findCol('zmapNodeTask', { deleted: true }, (err, result) => {
          resolve(result)
        })
      });
  
      for (var nodetask of deletedNodeTasks) {
        const {_id, nodeId,taskId}=nodetask
        //take out the node
        var t_node = await new Promise((resolve, reject) => {
          dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
            resolve(result)
          })
        })
  
        //if the node is missing, just delete the task
        if (t_node == null) {
          await new Promise((resolve, reject) => {
            dbo.deleteCol('zmapNodeTask', { _id: _id }, (err, result) => { resolve(result) })
  
          })
          continue
        }
        const t_node_id=t_node._id
        const name=t_node.name
        // if not received, delete directly
        if (!nodetask.received) {
          await new Promise((resolve, reject) => {
            dbo.deleteCol('zmapNodeTask', { _id}, (err, result) => { resolve(result) })
          })
          logger.warn('node--%s: not received nodetask(%s) of task(%s) had been deleted directly!',name,_id,taskId)
          continue
        }
        if(brokenNodes.includes(t_node_id.toString()))
          continue
        //access the node to delete the node side task
        nodeApi.zmapTask.delete(t_node.url, t_node.token, _id, (code, body)=> {
          // if return code is right, update the nodetask
          if (code == 200){
            logger.info('node--%s:delete nodetask(%s) of task(%s) successfully!',name,_id,taskId)
            dbo.deleteCol('zmapNodeTask', { _id: _id }, (err, result) => {})
          }
          else{
            logger.error('node--%s:Failed to delete nodetask(%s) of task(%s) !',name,_id,taskId)
          }
        })
      }
  }
    const zmapToNodeSync= async () => {
    //first deal deletedG
    

    
    //last to deal with the needToSync
    var needToSyncNodeTasks = await new Promise((resolve, reject) => {
      dbo.findCol('zmapNodeTask', { needToSync: true, complete: false,deleted:false }, (err, result) => {
        resolve(result)
      })
    });
    for (var nodetask of needToSyncNodeTasks) {
      //take out the node
      const {_id,nodeId,paused}=nodetask
      const t_node = await new Promise((resolve, reject) => {
        dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
          resolve(result)
        })
      })
      //if the node is missing, omit
      if (t_node == null)
        continue
      const {url,token,name}=t_node
      nodeApi.zmapTask.syncCommand(url, token, _id.toString(), paused, (code, body) => {
        // if return code is right, update the nodetask
        if (code == 200){
          logger.info(name+'--node:change task pause/resume status succeed!')
          dbo.updateCol('zmapNodeTask', { _id: _id }, { needToSync: false }, (err, rest) => {})
        }
        else{
          logger.info(name+'--node:change task pause/resume status fail!')
        }
      })
    }
  }
  const syncProgressFromNode=async ()=>{
      //find all zmaptask started,uncomplete and not paused
    var zmaptasks = await new Promise((resolve, reject) => {
        dbo.findCol('task',{ started: true, zmapComplete: false, paused: false }, (err, result) => {
          resolve(result)
        })
      })    
      //for each of the task
      for (var task of zmaptasks){
        //get all its uncompleted nodetasks, 
        var nodetasks = await new Promise((resolve, reject) => {
          dbo.findCol('zmapNodeTask', { taskId:task._id.toString(),received:true,complete:false,deleted:false}, (err, result) => {
            resolve(result)
          })
        });
        
        for (var nodetask of nodetasks) {
  
          //converge the nodetasks progress and status to the task
          const {_id,ipRangeId,nodeId,taskId}=nodetask
          
          //then access the nodes to sync progress
          //take out the node
          const t_node = await new Promise((resolve, reject) => {
            dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
              resolve(result)
            })
          })
          
          //if the node is missing, omit
          if (t_node == null)
            continue
          const {url,token,name}=t_node
          const t_node_id=t_node._id
          //get the sync info, set the timeout longer as it may take time
          nodeApi.zmapTask.syncProgress(url, token, _id.toString(), 120000, async (code, body) => {
            if (code == 200){
              logger.info('Received progress info of nodetask(%s) of task(%s) from node--%s!',_id,taskId,name)
              let {
                goWrong,
                progress,
                complete,
                running,
                latestResult,
              } = body
  
              // logger.debug(body)            
              if(complete){
                for(var ip_id of ipRangeId){            
                  await new Promise((resolve, reject) => {
                    dbo.updateCol('progress--'+taskId.toString(),{_id:ip_id},{complete:true},(err,rest)=>{
                      resolve(err)
                    })})
                }
              logger.warn('Complete! nodetask(%s) of task(%s) from node--%s!',_id,taskId,name)
              
  
              }
              //update the sever side nodetask
              dbo.updateCol('zmapNodeTask',{_id:_id},{progress,goWrong,complete,running},(err, result) => {})
                      //record the results
              for (var r of latestResult)
                dbo.pushCol('task',{_id:taskId},{zmapResult:r},(err, result) => {})
            }
            else{
                  logger.error('Failed to received progress info of nodetask(%s) of task(%s) from node--%s!',_id,taskId,name)
                if (nodeConnectFailTime[t_node_id]==null)
                  nodeConnectFailTime[t_node_id]=1
                else
                  nodeConnectFailTime[t_node_id]=nodeConnectFailTime[t_node_id]+1
                if(nodeConnectFailTime[t_node_id]==2){
                  logger.warn("node--%s: is broken, the system will not distribute or send task to it!",name)
                  brokenNodes.push(t_node_id.toString())
                  //put back its ip
                  for(var ip_id of ipRangeId){
                    dbo.updateCol('progress--'+taskId,{_id:ip_id},{node:null},(err, rest) => {})                  
                  }
                  //set the task deleted
                  dbo.updateCol('zmapNodeTask', { _id}, { deleted: true }, (err, result) => { })
                logger.warn("node--%s: nodetask(%s) of task(%s) had been canceled!",name,_id.toString(),taskId)
                }            
            }            
          })       
        }
    }
}

  const syncProgressToMainTask= async () => {
    
    var zmaptasks = await new Promise((resolve, reject) => {
        dbo.findCol('task',{ started: true, zmapComplete: false, paused: false }, (err, result) => {
          resolve(result)
        })
      })    
    for(var task of zmaptasks){ 

        let totalProgress=0//totalprogress should be the complete count the iprange of the progress table, plus sum of the progress of ongoing nodetasks
        let totalGoWrong=false

        var nodetasks = await new Promise((resolve, reject) => {
          dbo.findCol('zmapNodeTask', { taskId:task._id.toString(),received:true,complete:false,deleted:false}, (err, result) => {
            resolve(result)
          })
        });


        for (var nodetask of nodetasks) {

          const {progress,goWrong,taskId}=nodetask
          totalProgress=totalProgress+progress
          if(goWrong)
            totalGoWrong=true
        }
      //after converging the nodetasks, get complete count of the progress table
      var completeCount = await new Promise((resolve, reject) => {
        dbo.getCount('progress--'+task._id.toString(),{complete:true},(err, result) => {
          resolve(result)
        })
      });
      var totalcount = await new Promise((resolve, reject) => {
        dbo.getCount('progress--' + task._id.toString(), { }, (err, result) => {
          resolve(result)
        })
      });
      
      //the two equals mean the task is complete
      if(completeCount==totalcount){
        logger.warn("Task--%s(%s) has complete!!",task._id,task.name)
        dbo.updateCol('task',{_id:task._id},{zmapComplete:true,zmapProgress:totalcount},(err,rest)=>{})
      }
      else{
        totalProgress=totalProgress+completeCount
        dbo.updateCol('task',{_id:task._id},{zmapProgress:totalProgress,goWrong:totalGoWrong},(err,rest)=>{})
      }

    }
  }


const runZmapTask=()=>{

  setInterval(() => {
      distribute()
      sendToNode()
    deleteMarked()
    syncProgressFromNode()
    syncProgressToMainTask()
  }, 2500);

}
module.exports={
    runZmapTask
}

