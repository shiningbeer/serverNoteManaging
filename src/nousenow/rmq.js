// var amqp = require('amqplib/callback_api')
// amqp.connect('amqp://localhost', function(err, conn) {
//   conn.createChannel(function(err, ch) {
//     var q = 'hello';

//     ch.assertQueue(q, {durable: false});
//     // Note: on Node 6 Buffer.from(msg) should be used
//     var a={}
//     a.b='aa'
//     a=JSON.stringify(a)
//     ch.sendToQueue(q, new Buffer(a));
//     console.log(" [x] Sent 'Hello World!'");
//   });
// });
var a=[]
a.push(1)
a.push(2)
console.log(a.indexOf(1))
a.splice(-1,1)
console.log(a)