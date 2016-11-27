# stream_reader

//This is a full example for a tcp client using stream_reader and pack_parser package.
//The pack format is: 
//
//    |------------------------------------------------------|
//    | Flag(4 bytes) | Type(1 byte) | Length(4 byte) | Data |
//    |------------------------------------------------------|
//
// Flag: pack flag, must be string "Test"
// Type:  1 -- Echo, 2 -- Long string data
// Length: Length for data
// Data: Data

var net = require('net');
var PackParser = require('pack_parser');
var StreamReader = require('stream_reader');

var PACK_TYPE_ECHO = 1;
var PACK_TYPE_STR = 2;

var HOST = '127.0.0.1';
var PORT = 8888;

var client = new net.Socket();

var sockStreamReader = new StreamReader();
                      
client.connect(PORT, HOST, function() {

    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
    
    //Build a echo pack to send
    var paserWriter = PackParser.CreateWriter().bigEndian();
    var dataStr = "Hello, world!"
    var outPack = paserWriter.fstring("Test").byte(PACK_TYPE_ECHO).UInt32(dataStr.length).fstring(dataStr).pack();
    console.log('Send ' + outPack.length + ' bytes TO: ' + HOST + ':' + PORT);
    client.write(outPack);
    
    var loopStr = "This is a test loop string";
    var dataLen = Buffer.byteLength(loopStr, paserWriter.getEncoding()) * 1024;
    
    //Pack and send head
    outPack = paserWriter.fstring("Test").byte(PACK_TYPE_STR).UInt32(dataLen).pack();    
    console.log('Send ' + outPack.length + ' head bytes TO: ' + HOST + ':' + PORT);
    client.write(outPack);
    
    //Send data
    for(var i = 0; i < 1024; i++){
        var data = new Buffer(loopStr, paserWriter.getEncoding());
        client.write(data);
    }

    setTimeout(function(){ //Close after 10 seconds
        
        client.end();
    }, 10 * 1000);
});


client.on('data', function(data) {
    
    //If no more task in StreamReader, register protocol handle body
    if( sockStreamReader.taskEmpty() )
        registerProtocolBody();
    
     //When socket data coming, push to StreamReader
    sockStreamReader.push(data);    
});

client.on('close', function() {
    console.log('Connection closed');
});
    
client.on("error",function(err){
    console.error('Error occurred:', err.message);
});

function registerProtocolBody(){
    
    sockStreamReader.read(9, function(headData){

        //Parse head to object head
        var parserReader = PackParser.CreateReader(headData).bigEndian();
        var head = parserReader.fstring('flag', 4).byte('type').UInt32('length').unpack(); 

        //Check flag field
        if(head.flag != "Test"){ 
            console.error("Bad pack flag" + head.flag);
            return;
        }

        switch( head.type ){
            case PACK_TYPE_ECHO:

                //Read data according head.length
                sockStreamReader.read(head.length, function(data){

                    var dataStr = data.toString();
                    console.info("Echo pack coming with string: " + dataStr);
                });
                break;
            default:
                console.error("Unrecongized pack type: " + head.type);                                
        }
    });
}

//This is a full example for a tcp server using stream_reader and pack_parser package.
//The pack format is: 
//
//    |------------------------------------------------------|
//    | Flag(4 bytes) | Type(1 byte) | Length(4 byte) | Data |
//    |------------------------------------------------------|
//
// Flag: pack flag, must be string "Test"
// Type:  1 -- Echo, 2 -- Long string data
// Length: Length for data
// Data: Data

var server = require('net').createServer();
var StreamReader = require('stream_reader');
var PackParser = require('pack_parser');

var PACK_TYPE_ECHO = 1;
var PACK_TYPE_STR = 2;

function newConn(sock)
{
    var sockStreamReader = new StreamReader();
    
    sock.on("data", function(data){ 
        
        console.info("Data come in: " + data.length + " bytes");
        
        //If no more task in StreamReader, register protocol handle body
        if( sockStreamReader.taskEmpty() )
            registerProtocolBody();
        
        //When socket data coming, push to StreamReader
        sockStreamReader.push(data);
                
    });
  
    sock.on("error",function(err){
        console.error('Error occurred:', err.message);
    });
    
    sock.on("close",function(){
        console.error('connection closed');
    });
    
    function registerProtocolBody(){
        
        //Read pack head with fixed length 9 bytes
        sockStreamReader.read(9, function(headData){

            console.info("Pack head received");

            //Parse head to object head
            var parserReader = PackParser.CreateReader(headData).bigEndian();
            var head = parserReader.fstring('flag', 4).byte('type').UInt32('length').unpack(); 

            //Check flag field
            if(head.flag != "Test"){ 
                console.error("Bad pack flag" + head.flag);
                return;
            }

            switch( head.type ){
                case PACK_TYPE_ECHO:

                    //Read data according head.length
                    sockStreamReader.read(head.length, function(data){

                        var dataStr = data.toString();
                        console.info("Echo pack coming with string: " + dataStr);

                        //Build a echo pack to send
                        var paserWriter = PackParser.CreateWriter().bigEndian();
                        var outPack = paserWriter.fstring(head.flag).byte(head.type).UInt32(data.length).fstring(dataStr).pack();
                        sock.write(outPack);
                    });
                    break;

                case PACK_TYPE_STR:

                    var total = 0;
                    sockStreamReader.loopRead(head.length, 1024, function(data){

                        var dataStr = data.toString();                        
                        console.info("Long data pack come in: " + dataStr);
                        
                        total += data.length;
                        if(total == head.length)
                            console.info("Long data finished!");
                        //So you can handle data as your wish
                    }); 
                    break;
            }
        });
    }
   
}

function createSrv(port){
    
    server.on('listening', function() {
        console.info('Server is listening on port ' + port);
    });
    
    server.on('connection', function(socket) {
        newConn(socket);
        console.info('Server has a new connection');
    });
    
    server.on('close', function() {
        console.info('Server is now closed');
    });
    
    server.on('error', function(err) {
        console.error('Error occurred:', err.message);
    });
    
    server.listen(port);    
}


createSrv(8888);



