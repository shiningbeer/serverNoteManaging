const { zmapScan } = require('./zmapScan')
const { pluginScan } = require('./pluginScan')
const { zmapPluginScan } = require('./zmapPluginScan')
const taskSelector = (type) => {
    switch (type) {
        case 'zmapScan':
            return zmapScan
        case 'pluginScan':
            return pluginScan
        case 'zmapPluginScan':
            return zmapPluginScan
        default:
            return null
    }
}
module.exports = {
    taskSelector
}