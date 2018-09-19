var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const collectZmap = async () => {

    var ongoingTasks = await sdao.find('task', { started: true, complete: false, paused: false })
    for (var task of ongoingTasks) {
      //总进度应当为进度表中完成的数字，加上正在进行任务的进度和
      let totalProgress = 0
      let totalGoWrong = false
      var nodetasks = await sdao.find('nodeTask', { taskId: task._id.toString(), received: true, complete: false, deleted: false })
  
      for (var nodetask of nodetasks) {
  
        const { progress, goWrong, taskId } = nodetask
        totalProgress = totalProgress + progress
        if (goWrong)
          totalGoWrong = true
      }
      var completeCount =  await sdao.getCount('progress--' + task._id.toString(), { complete: true })
      var totalcount =  await sdao.getCount('progress--' + task._id.toString(), {})
  
      //如果总进度与总数相等，则说明任务完成
      if (completeCount == totalcount) {
        logger.warn("【任务完成！】:【任务%s】【阶段%s】", task.name, task.stage)
        await sdao.update('task', { _id: task._id }, { complete: true, progress: totalcount })
      }
      else {
        totalProgress = totalProgress + completeCount
        await sdao.update('task', { _id: task._id }, { progress: totalProgress, goWrong: totalGoWrong })
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