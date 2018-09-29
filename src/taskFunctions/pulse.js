var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')

let brokenNodes = []
let nodeConnectFailTime = {}
//定时程序，每次执行时取出数据库所有节点判断是否在线
const pulseOnLine = async () => {
    //取出所有节点
    const nodes = await sdao.find('node', {})
    for (var node of nodes) {
        //如果已经不在线，则不处理
        if (brokenNodes.includes(node._id.toString())) {
            continue
        }
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
                    logger.warn("[pulse]:[node%s][off-line]", name)
                    brokenNodes.push(_id.toString())
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
    var toRemove = -1
    for (var nodeId of brokenNodes) {
        const node = await sdao.findone('node', { _id: nodeId })
        if (node == null) {
            toRemove = brokenNodes.indexOf(nodeId)
            continue
        }
        const { _id, name, url, token } = node
        nodeApi.pulse.pulse(url, token, async (code, body) => {
            if (code == 200) {

                // if (nodeConnectFailTime[node._id]==null)
                //   nodeConnectFailTime[node._id]=0
                logger.warn("[pulse]:[node%s][back online]", name)
                var index = brokenNodes.indexOf(_id.toString())
                // console.log(index)
                if (index != -1)
                    brokenNodes.splice(index, 1)
                // console.log(brokenNodes)

            }
            else
                logger.debug("[pulse]:[node %s][remain off-line]", name)

        })
    }
    if (toRemove != -1)
        brokenNodes.splice(toRemove, 1)
}
const runPulse = () => {
    setInterval(pulseOnLine, 5000)
    setInterval(pulseOffLine, 20000)
}
module.exports = {
    runPulse,
    brokenNodes
}