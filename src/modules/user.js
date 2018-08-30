var dbo = require('../dbo/dbo')
var {logger}=require('../util/mylogger')
const user = {
    add: (req, res) => {
      var newUser = req.body.newUser
      if (newUser == null)
        return res.sendStatus(415)
      let newUserToAdd = {
        ...newUser,
        taskCount: 0,
        lastLoginAt: Date.now(),
        lastLoginIp: '21.34.56.78'
      }
      //todo: verify validity of newUser
      dbo.user.add(newUserToAdd, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    delete: (req, res) => {
      var id = req.body.userId
      if (id == null)
        return res.sendStatus(415)
      dbo.user.del(id, (err, rest) => {
        err ? res.sendStatus(500) : res.json('ok')
      })
    },
    modpw: (req, res) => {
      var id = req.body.userId
      var pw = req.body.pw
      if (id == null || pw == null)
        return res.sendStatus(415)
      dbo.user.update(id, { password: pw }, (err, rest) => {
        err ? res.sendStatus(500) : res.sendStatus(200)
      })
    },
    getToken: (req, res) => {
      var user = req.body.userName
      var pw = req.body.password
      if (user == null || pw == null)
        return res.sendStatus(415)
      dbo.user.get({ name: user, password: pw }, (err, result) => {
        if (err)
          res.sendStatus(500)
        else {
          if (result.length < 1)
            res.sendStatus(401)
          else {
            let userInfo = result[0]
            let token = jwt.encode({ user: userInfo.name, type: userInfo.authority }, 'secrettt')
            res.send({
              status: 'ok',
              type: 'account',
              currentAuthority: userInfo.authority,
              currentUser: userInfo.name,
              token: token
            })
          }
        }
      })
    },
    get: (req, res) => {
      var condition = req.body.condition
      if (condition == null)
        condition = {}
      dbo.user.get(condition, (err, result) => {
        err ? res.sendStatus(500) : res.json(result)
      })
    },
  }
  module.exports={
    user,
  }