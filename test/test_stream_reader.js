var StreamReader = require('../stream_reader');

var r = new StreamReader();

r.read(8, function(data){
    console.log(data.toString());
}).read(4,function(data){
    console.log(data.toString());
});

r.loopRead(100, 3, function(data, index){
    console.log("The " + index + " data come in: " + data.toString());
});

r.push(new Buffer("test"));
r.push(new Buffer(" abcd"));
r.push(new Buffer(" 123456789"));
r.push(new Buffer(" abcdefghi"));
r.push(new Buffer(" 123456789"));
r.clear();
console.log("--Clear");

r.push(new Buffer(" abcdefghi"));
r.push(new Buffer(" 123456789"));
r.push(new Buffer(" abcdefghi"));

console.log("--After push data");

r.read(8, function(data){
    console.log(data.toString());
}).read(4,function(data){
    console.log(data.toString());
});

r.loopRead(100, 3, function(data, index){
    console.log("The " + index + " data come in: " + data.toString());
});
