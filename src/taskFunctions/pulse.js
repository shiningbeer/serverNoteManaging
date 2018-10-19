var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')

let nodeConnectFailTime = {}
//定时程序，每次执行时取出数据库所有节点判断是否在线
const pulseOnLine = async () => {
    //取出在线节点
    const nodes = await sdao.find('node', {online:true})
    for (var node of nodes) {
        //访问节点
        const { url, token, _id, name } = node
        nodeApi.pulse.pulse(url, token, async (code, body) => {
            //如果返回不成功，则判断次数，连续3次返回不成功则判断为不在线
            if (code != 200) {
                if (nodeConnectFailTime[_id] == null)
                    nodeConnectFailTime[_id] = 1
                else
                    nodeConnectFailTime[_id] = nodeConnectFailTime[_id] + 1

                logger.warn("[pulse]:[node %s][fail times:%s]", name, nodeConnectFailTime[_id])
                if (nodeConnectFailTime[_id] == 30) {
                    logger.warn("[pulse]:[node %s][off-line]", name)
                    await sdao.update('node',{_id},{online:false})
                    nodeConnectFailTime[_id] = 0
                }
            }
            else {
                nodeConnectFailTime[_id] = 0
                logger.debug("[pulse]:[node %s][online]", name)
            }
        })
    }
}
const pulseOffLine = async () => {
    const nodes = await sdao.find('node', {online:false})
    for (var node of nodes) {
        const { url, token, _id, name } = node
        nodeApi.pulse.pulse(url, token, async (code, body) => {
            if (code == 200) {
                logger.warn("[pulse]:[node %s][back online]", name)
                await sdao.update('node',{_id},{online:true})
            }
            else {
                logger.debug("[pulse]:[node %s][remain off-line]", name)
            }
        })
    }
}
const runPulse = () => {
    setInterval(pulseOnLine, 5000)
    setInterval(pulseOffLine, 20000)
}
module.exports = {
    runPulse,
}