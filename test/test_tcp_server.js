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


