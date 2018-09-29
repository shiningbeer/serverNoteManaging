const { zmapScan } = require('./zmapScan')
const { pluginScan } = require('./pluginScan')
const { zmapPluginScan } = require('./zmapPluginScan')
//为了多态而创建的选择器，在程序中可根据类型的不同返回不同的任务处理函数，但在调用程序中却可以使用相同的调用语句
//在java中可用接口实现，在js中只能暂且用函数来实现
const taskSelector = (type) => {
    switch (type) {
        case 'zmap':
            return zmapScan
        case 'plugin':
            return pluginScan
        case 'zmapPlugin':
            return zmapPluginScan
        default:
            return null
    }
}
module.exports = {
    taskSelector
}