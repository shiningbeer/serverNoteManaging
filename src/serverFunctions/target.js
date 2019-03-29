var { sdao } = require('../util/dao')
var { logger } = require('../util/mylogger')
var fs = require('fs')
const uploadDir = './uploadTargets/'
const target = {
  adddd: async (req, res) => {
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
  uploadDir,
  add: async (req, res) => {
    var file = req.file
    try {
      fs.renameSync(uploadDir + file.filename, uploadDir + file.originalname)
    }
    catch (e) {
      console.log(e)
      return res.sendStatus(501)
    }
    var newTarget = {
      name: file.originalname,
      createdby: 'lele',
      description: '',
      lines:455,
      ipRange:[],
      
      uploadAt: Date.now(),
    }
    await sdao.insert('target', newTarget)
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
    console.log(req.body)
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
    let result = await sdao.findField('target', condition)
    for (var record of result) {
      delete record.ipRange
    }
    res.json(result)
  },
  getZmapResult: async (req, res) => {
    // var condition = req.body.condition
    // if (condition == null)
    // condition = {}
    // let result=await sdao.findField('zmapResults', {complete:true},{results:-1})
    // for(var r of result)
    // delete r.results
    // res.json(result)
    var condition = req.body.condition
    if (condition == null)
      condition = {}
    let result = await sdao.find('target', condition)
    res.json(result)
  }
}
module.exports = {
  target,
}