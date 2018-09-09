var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const collectZmap = async () => {

    var zmaptasks = await sdao.find('task', { started: true, zmapComplete: false, paused: false })
    for (var task of zmaptasks) {
      let totalProgress = 0//totalprogress should be the complete count the iprange of the progress table, plus sum of the progress of ongoing nodetasks
      let totalGoWrong = false
      var nodetasks = await sdao.find('nodeTask', { taskId: task._id.toString(), received: true, complete: false, deleted: false })
  
      for (var nodetask of nodetasks) {
  
        const { progress, goWrong, taskId } = nodetask
        totalProgress = totalProgress + progress
        if (goWrong)
          totalGoWrong = true
      }
      //after converging the nodetasks, get complete count of the progress table
      var completeCount =  await sdao.getCount('progress--' + task._id.toString(), { complete: true })
      var totalcount =  await sdao.getCount('progress--' + task._id.toString(), {})
  
      //the two equals mean the task is complete
      if (completeCount == totalcount) {
        logger.warn("【TotalComplete!】--【%s】(%s)!", task.name, task._id)
        await sdao.update('task', { _id: task._id }, { zmapComplete: true, zmapProgress: totalcount })
      }
      else {
        totalProgress = totalProgress + completeCount
        await sdao.update('task', { _id: task._id }, { zmapProgress: totalProgress, goWrong: totalGoWrong })
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