var { sdao } = require('../util/dao')
var nodeApi = require('../util/nodeApi')
var { logger } = require('../util/mylogger')

let brokenNodes = []
let nodeConnectFailTime = {}
const pulseOnLine = async () => {
    const nodes = await sdao.find('node', {})
    for (var node of nodes) {
        if (brokenNodes.includes(node._id.toString())) {
            // logger.debug(node)
            continue
        }
        // logger.debug(node)
        const { url, token, _id, name } = node
        nodeApi.pulse.pulse(url, token, async (code, body) => {
            if (code != 200) {
                if (nodeConnectFailTime[_id] == null)
                    nodeConnectFailTime[_id] = 1
                else
                    nodeConnectFailTime[_id] = nodeConnectFailTime[_id] + 1

                logger.warn("【pulse】to node【%s】: failed for %i time", name, nodeConnectFailTime[_id])
                if (nodeConnectFailTime[_id] == 3) {
                    logger.warn("【pulse】to node【%s】:node regarded as off-line!", name)
                    brokenNodes.push(_id.toString())
                    nodeConnectFailTime[_id] = 0

                }
            }
            else {
                logger.debug("【pulse】to node【%s】:node is online!", name)

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
                logger.info("【pulse】to node【%s】: node back on line!", name)
                var index = brokenNodes.indexOf(_id.toString())
                // console.log(index)
                if (index != -1)
                    brokenNodes.splice(index, 1)
                // console.log(brokenNodes)

            }
            else
                logger.debug("【pulse】to node【%s】: node remain off-line!", name)

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