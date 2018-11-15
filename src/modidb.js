var { adao,sdao} = require('./util/dao')
var {adao:dao2}=require('./util/dao')
var { logger } = require('./util/mylogger')
adao.connect("mongodb://localhost:27017", 'cent', async (err) => {
    err ? logger.info('db connection fail!') : logger.info('modifying db')
    
})
dao2.connect("mongodb://localhost:27017", 'results', async (err) => {
    err ? logger.info('db connection fail!') : logger.info('connecting db')
    let re=await sdao.find('zmapResults',{})
    for (var r of re){
        var count=r.results.length
        const {_id}=r
        const id=_id.toString()
        console.log(id,count)

    }
})