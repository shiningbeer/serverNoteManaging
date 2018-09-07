var exec = require('child_process').exec;
var arg1 = 'hello'
var arg2 = 'jzhou'
exec('python print.py 192.111.11.1', function (error, stdout, stderr) {
    console.log(stdout.length)
    var a=stdout.split('\n')
    console.log(a)
});