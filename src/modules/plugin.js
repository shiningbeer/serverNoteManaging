var dbo = require('../util/dbo')
var fs=require('fs')
var {logger}=require('../util/mylogger')
const uploadDir = './uploadPlugins/'
const plugin = {
  uploadDir,
  add: (req, res) => {
    var file = req.file
    try {
      fs.renameSync(uploadDir + file.filename, uploadDir + file.originalname)
    }
    catch (e) {
      return res.sendStatus(501)
    }
    //待做：如果已有同名插件，不添加记录
    //将插件名加入数据库
    var newplugin = {
      name: file.originalname,
      user: req.tokenContainedInfo.user,
      description: '',
      protocal: '',
      usedCount: 0,
      port: '',
      uploadAt: Date.now(),
    }
    dbo.insertCol('plugin',newplugin, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  delete: async (req, res) => {
    var pluginName = req.body.pluginName
    if (pluginName == null)
      return res.sendStatus(415)

      var err = await new Promise((resolve, reject) => {
        fs.unlink(uploadDir + '/' + pluginName, (err) => {
          resolve(err)
        })
      })
      if (err)
        return res.sendStatus(500)
      dbo.deleteCol('plugin',{name:pluginName}, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })


  },
  update: (req, res) => {
    const { name, update } = req.body
    if (name == null || update == null)
      return res.sendStatus(415)
    dbo.updateCol('plugin',{name}, update, (err, rest) => {
      err ? res.sendStatus(500) : res.json('ok')
    })
  },
  get: async (req, res) => {
    let plugins
    try {
      plugins = fs.readdirSync(uploadDir)
    }
    catch (e) {
      return res.sendStatus(500)
    }

    let result = []
      for (var item of plugins) {
        var oneplugin = await new Promise((resolve, reject) => {
          dbo.findoneCol('plugin',{name:item}, (err, rest) => {
            err ? resolve(null) : resolve(rest)
          })
        })
        if (oneplugin != null)
          result.push(oneplugin)
      }
      res.json(result)
  },
}
module.exports={
  plugin
}