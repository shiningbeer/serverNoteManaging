var dbo = require('../util/dbo')
var {logger}=require('../util/mylogger')
const node = {
    add: (req, res) => {
      var newNode = req.body.newNode
      let newNodeToAdd = {
        ...newNode,
        user: req.tokenContainedInfo.user,
        ipLeft: 0,
        createdAt: Date.now(),
      }
      if (newNode == null)
        return res.sendStatus(415)
      //todo: verify validity of newnode
      dbo.insertCol('node',newNodeToAdd, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    delete: (req, res) => {
      var id = req.body.nodeId
      if (id == null)
        return res.sendStatus(415)
      dbo.deleteCol('node',{_id:id}, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    update: (req, res) => {
      var id = req.body.nodeId
      var update = req.body.update
      if (id == null || update == null)
        return res.sendStatus(415)
      dbo.updateCol('node',{_id:id}, update, (err, rest) => {
        err ? res.sendStatus(500) : res.sendStatus(200)
      })
    },
    get: (req, res) => {
      var condition = req.body.condition
      if (condition == null)
        condition = {}
      dbo.findCol('node',condition, (err, result) => {
        res.json(result)
      })
    },
 }
module.exports={
  node,  
}
