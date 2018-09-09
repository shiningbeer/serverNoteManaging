var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
const target = {
  add: async (req, res) => {
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
    await sdao.insert('target', newTargetToAdd)
    res.json('ok')
  },
  delete: async (req, res) => {
    var id = req.body.targetId
    if (id == null)
      return res.sendStatus(415)
    sdao.delete('target', { _id: id })
    res.json('ok')
  },
  update: async (req, res) => {
    var id = req.body.targetId
    var update = req.body.update
    if (id == null || update == null)
      return res.sendStatus(415)
    await sdao.update('target', { _id: id }, update)
    res.json('ok')
  },
  get: async (req, res) => {
    var condition = req.body.condition
    if (condition == null)
      condition = {}
    let result=await sdao.find('target', condition)
    res.json(result)
  },
}
module.exports = {
  target,
}