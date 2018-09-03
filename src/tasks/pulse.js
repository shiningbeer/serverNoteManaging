var dbo = require('../util/dbo')
var nodeApi = require('../util/nodeApi')
var {logger}=require('../util/mylogger')

let brokenNodes=[]
let nodeConnectFailTime={}
var runPulse=()=>{
setInterval(async ()=>{
const nodes = await new Promise((resolve, reject) => {
          dbo.findCol('node', {}, (err, result) => {
            resolve(result)
          })
        })
// logger.debug(nodes.length)
for(var node of nodes){
    if(brokenNodes.includes(node._id.toString())){
        // logger.debug(node)
        continue
    }
        // logger.debug(node)
    const {url,token,_id,name}=node
    nodeApi.pulse.pulse(url,token,(code,body)=>{
        if(code!=200){
            if (nodeConnectFailTime[_id]==null)
              nodeConnectFailTime[_id]=1
            else
              nodeConnectFailTime[_id]=nodeConnectFailTime[_id]+1
            
            logger.warn("【pulse】to node【%s】: failed for %i time", name,nodeConnectFailTime[_id])
            if(nodeConnectFailTime[_id]==3){
              logger.warn("【pulse】to node【%s】:node regarded as off-line!",name)
              brokenNodes.push(_id.toString())
              nodeConnectFailTime[_id]=0
             
            }
        }
        else{
              logger.debug("【pulse】to node【%s】:node is online!",name)
              
        }     
    })
}
},5000)

setInterval(async()=>{
for(var nodeId of brokenNodes){
        const node = await new Promise((resolve, reject) => {
          dbo.findoneCol('node', { _id: nodeId }, (err, result) => {
            resolve(result)
          })
        })
        const {_id,name,url,token}=node
    nodeApi.pulse.pulse(url,token,(code,body)=>{
        if(code==200){

            // if (nodeConnectFailTime[node._id]==null)
            //   nodeConnectFailTime[node._id]=0
              logger.debug("【pulse】to node【%s】: node back on line!",name)
            var index=brokenNodes.indexOf(_id.toString())
            // console.log(index)
           if(index!=-1)
                brokenNodes.splice(index,1)
            // console.log(brokenNodes)
            
        }
        else
              logger.debug("【pulse】to node【%s】: node remain off-line!",name)

    })
}
},20000)
}
module.exports={
    runPulse,
    brokenNodes
}