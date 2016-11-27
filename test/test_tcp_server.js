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
var StreamReader = require('../stream_reader');
var PackParser = require('pack_parser');

var PACK_TYPE_ECHO = 1;
var PACK_TYPE_STR = 2;

function newConn(sock)
{
    var sockStreamReader = new StreamReader();
    
    sock.on("data", function(data){ 
        
        //When socket data coming, push to StreamReader
        sockStreamReader.push(data);
        
        console.info("Data come in: " + data.length);        
    });
  
    sock.on("error",function(err){
        console.error('Error occurred:', err.message);
    });
    
    sock.on("close",function(){
        console.error('connection closed');
    });
    
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
                
                //This a example for read a long data, avoid push too much data in StreamReader
                var total = head.length;
                var readLen = 0;
                var lenLeft = total - readlen;
                
                function readLongData(){
                    
                    var len = 1024;
                    lenLeft = total - readlen;
                    if(lenLeft < len)
                        len = lenLeft;
                    
                    //Read max 1K data
                    sockStreamReader.read(len, function(data){
                        
                        //So you can handle data as your wish
                        var dataStr = data.toString();
                        console.info("Long data pack in " + readLen + "/" + total + ": " + dataStr);
                        
                        //writeToFile(data);
                        
                        readLen += data.length();
                        if(readLen < total)
                            readLongData(); //read again
                        else
                            console.info("Long data pack finished");
                    });
        
                };
                    
                readLongData();
                break;
        }
    });
}

function createSrv(port){
    
    server.on('listening', function() {
        console.info('Server is listening on port ' + port);
    });
    
    server.on('connection', function(socket) {
        conn = newConn(socket);
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


