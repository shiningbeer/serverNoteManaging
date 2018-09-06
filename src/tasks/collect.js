var dbo = require('../util/dbo')
var { logger } = require('../util/mylogger')
const collectZmap = async () => {

    var zmaptasks = await new Promise((resolve, reject) => {
      dbo.findCol('task', { started: true, zmapComplete: false, paused: false }, (err, result) => {
        resolve(result)
      })
    })
    for (var task of zmaptasks) {
  
      let totalProgress = 0//totalprogress should be the complete count the iprange of the progress table, plus sum of the progress of ongoing nodetasks
      let totalGoWrong = false
  
      var nodetasks = await new Promise((resolve, reject) => {
        dbo.findCol('nodeTask', { taskId: task._id.toString(), received: true, complete: false, deleted: false }, (err, result) => {
          resolve(result)
        })
      });
  
  
      for (var nodetask of nodetasks) {
  
        const { progress, goWrong, taskId } = nodetask
        totalProgress = totalProgress + progress
        if (goWrong)
          totalGoWrong = true
      }
      //after converging the nodetasks, get complete count of the progress table
      var completeCount = await new Promise((resolve, reject) => {
        dbo.getCount('progress--' + task._id.toString(), { complete: true }, (err, result) => {
          resolve(result)
        })
      });
      var totalcount = await new Promise((resolve, reject) => {
        dbo.getCount('progress--' + task._id.toString(), {}, (err, result) => {
          resolve(result)
        })
      });
  
      //the two equals mean the task is complete
      if (completeCount == totalcount) {
        logger.warn("【TotalComplete!】--【%s】(%s)!", task.name, task._id)
        dbo.updateCol('task', { _id: task._id }, { zmapComplete: true, zmapProgress: totalcount }, (err, rest) => { })
      }
      else {
        totalProgress = totalProgress + completeCount
        dbo.updateCol('task', { _id: task._id }, { zmapProgress: totalProgress, goWrong: totalGoWrong }, (err, rest) => { })
      }
  
    }
  }
  const collect=()=>{
      collectZmap()
      //other collect
  }
  const runCollect=()=>{
      setInterval(collect,1000)
  }
  module.exports={
      runCollect
  }