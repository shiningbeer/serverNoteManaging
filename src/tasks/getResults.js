var dbo = require('../util/dbo')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')
var { brokenNodes } = require('./pulse')
const getZmapResults = async () => {
    //find complete but result not been fully collected zmap task 
    const tasks = await new Promise((resolve, reject) => {
      dbo.findCol('task', { zmapComplete: true, zmapResultCollected: false }, (err, result) => {
        resolve(result)
      })
    })
    // logger.debug(tasks)
    for (var task of tasks) {
      const taskId = task._id.toString()
      const taskName = task.name
      logger.debug(taskId)
  
      //find all its node tasks that have completed but have't fully colllected results
      //find tasks where result count and result received count not equal
      const nodetasks = await new Promise((resolve, reject) => {
        dbo.findCol('nodeTask', { taskId, complete: true, $where: "this.resultCount>this.resultReceived" }, (err, result) => {
          resolve(result)
        })
      })
      //if no nodetask found, it means all collected,set the task zmapResultCollected=true
      if (nodetasks.length == 0) {
        logger.info('【result】: 【Complete】 collecting results for task 【%s】！', task.name)
        dbo.updateCol('task', { _id: taskId }, { zmapResultCollected: true }, (err, rest) => { })
        dbo.updateCol('results', { _id: taskId }, { complete: true,completeAt:Date.now()}, (err, rest) => { })
        continue
      }
      for (var nodetask of nodetasks) {
        const { nodeId, resultReceived, } = nodetask
        const nodetaskid = nodetask._id
        const node = await new Promise((resolve, reject) => {
          dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
            resolve(result)
          })
        })
        if (node == null)
          continue
        const { url, token, _id, name } = node
        if (brokenNodes.includes(_id.toString()))
          continue
        nodeApi.results.get(url, token, nodetaskid, resultReceived, 10, (code, body) => {
          if (code == 200) {
            logger.debug(body)
            logger.info('【result】from node 【%s】:sucessful, nodetask【%s】of task【%s】', name, nodetaskid, taskName)
            dbo.updateCol('nodeTask', { _id: nodetaskid }, { resultReceived: resultReceived + body.length }, (err, rest) => { })
            for (var r of body) {
              dbo.pushCol('results', { _id: taskId }, { results: r }, (e, r) => { })
            }
          }
        })
      }
    }
  }
  const getResults=()=>{
      getZmapResults()
      //other getresult
  }
  const runGetResults=()=>{
      setInterval(getResults,2500)
  }
  module.exports={
      runGetResults
  }