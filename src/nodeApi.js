var request = require('request');
var fs = require('fs');

// var getToken=(user,pw, callback)=>{
//     var param = {
//         username:user,
//         password:pw,
//     }
//     postJson(api.auth,param, callback)
// }
let accessingUrl={}
var postJson = (url, token, param, callback) => {
    if(accessingUrl[url]==true)
        return
    accessingUrl[url]==true
    request.post({
        url: url,
        timeout:2000,
        json: true,
        headers: {
            "content-type": "application/json",
            'token': token
        },
        body: param
    }, (error, response, body) => {
        accessingUrl[url]==false
        error ? callback(600, error) : callback(response.statusCode, body)
    })
}
var postJsonWithTimeout = (url, token, param, timeout,callback) => {
    if(accessingUrl[url]==true)
        return
    request.post({
        url: url,
        timeout:timeout,
        json: true,
        headers: {
            "content-type": "application/json",
            'token': token
        },
        body: param
    }, (error, response, body) => {
        accessingUrl[url]==false
        error ? callback(600, error) : callback(response.statusCode, body)
    })
}

var zmapTask = {
    add: (url_base, token, task, callback) => {
        var param = task
        postJson(url_base + '/zmaptask/add', token, param, callback)
    },
    syncCommand: (url_base, token, taskid, paused, callback) => {
        var param = { taskId: taskid, paused: paused }
        postJson(url_base + '/zmaptask/syncCommand', token, param, callback)
    },
    delete: (url_base, token, id, callback) => {
        var param = { taskId: id }
        postJson(url_base + '/zmaptask/delete', token, param, callback)
    },
    syncProgress: (url_base, token, id, timeout,callback) => {
        var param = { taskId: id }
        postJsonWithTimeout(url_base + '/zmaptask/syncProgress', token, param, timeout,callback)
    },



    // get:(condition={}, callback)=>{
    //     var param={
    //         condition:condition
    //     }
    //     postJson(api.nodeTask.get, param, callback)
    // }

}


// var plugin={
//     add:(file, callback) => {
//         var formData = {
//             file: fs.createReadStream(file),        
//         };
//         request.post({
//             url: api.plugin.add,
//             formData: formData,
//             headers: {
//                 'token':mytoken
//             },
//         }, (error, response, body) => {
//             if(error)
//                 callback(600,'')
//             else
//                 callback(response.statusCode,body)
//         })
//     },
//     del:(pluginName, callback) => {
//         var param = {
//             pluginName: pluginName
//         }
//         postJson(api.plugin.del, param, callback)
//     },
//     get:(callback)=>{
//         postJson(api.plugin.get, {},callback)
//     }
// }

// var setting={
//     add: (key,value,callback) => {
//         console.log(api.setting.add)
//         var param = {
//             key:key,
//             value:value,
//         }
//         postJson(api.setting.add, param, callback)
//     },
//     del:(key, callback) => {
//         var param = {
//             key: key
//         }
//         postJson(api.setting.del, param, callback)
//     },
//     update:(key,value, callback)=>{
//         var param = {
//             key:key,
//             value:value,
//         }
//         postJson(api.setting.update, param, callback)
//     },
//     get:(callback)=>{
//         postJson(api.setting.get, {}, callback)
//     }
// }


var myCallback = (code, body) => {
    console.log(code)
    console.log(body)
}

// nodeTask.add(newnodeTask,myCallback)
// nodeTask.get({},myCallback)


// setting.add("timespan",60,myCallback)
// setting.del('timespan',myCallback)
// setting.update('threadnum',20,myCallback)
// setting.get(myCallback)

// getToken('superbayi','laoye',myCallback)


module.exports = {
    zmapTask,
}
