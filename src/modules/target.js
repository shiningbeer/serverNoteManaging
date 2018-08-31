var dbo = require('../util/dbo')
var {logger}=require('../util/mylogger')
const target = {
    add: (req, res) => {
      var newTarget = req.body.newTarget
      if (newTarget == null)
        return res.sendStatus(415)
      //todo: verify validity of newTarget
      let newTargetToAdd = {
        ...newTarget,
        usedCount: 8,
        ipTotal: 6555,
        lines: newTarget.ipRange.length,
        createdby: req.tokenContainedInfo.user
      }
      dbo.insertCol('target',newTargetToAdd, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    delete: (req, res) => {
      var id = req.body.targetId
      if (id == null)
        return res.sendStatus(415)
      dbo.deleteCol('target',{_id:id}, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    update: (req, res) => {
      var id = req.body.targetId
      var update = req.body.update
      if (id == null || update == null)
        return res.sendStatus(415)
      dbo.updateCol('target',{_id:id}, update, (err, rest) => {
        err ? res.sendStatus(500) : res.sendStatus(200)
      })
    },
    get: (req, res) => {
      var condition = req.body.condition
      if (condition == null)
        condition = {}
      dbo.findCol('target',condition, (err, result) => {
        res.json(result)
      })
    },
  }
  module.exports={
    target,
  }