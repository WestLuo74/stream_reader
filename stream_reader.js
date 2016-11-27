/*
本模块用于流式数据的读取，在通过read或loopRead注册多个指定读取长度后，在指定长度数据到达后回调对应函数
loopRead用于长数据的分片处理，每次返回指定长度的小片
*/

//返回变量类型
function getType(obj){  
        switch(obj){  
            case null:  
                return "null";  
            case undefined:  
                return "undefined";  
        }  
        var s=Object.prototype.toString.call(obj);  
        switch(s){  
           case "[object String]":  
               return "string";  
           case "[object Number]":  
               return "number";  
           case "[object Boolean]":  
               return "boolean";  
           case "[object Array]":  
               return "array";  
           case "[object Date]":  
               return "date";  
           case "[object Function]":  
               return "function";  
           case "[object RegExp]":  
               return "regExp";  
           case "[object Object]":  
               return "object";  
           default:  
               return "object";  
       }  
   }  

var StreamReader = function (bufferLimit) {
    var _bufferLimit = bufferLimit || (1024 * 32);
	var self = this;
    var _buffers = []; //缓存数组，每个节点为一个push传入的一个Buffer
    var _curBuffer; //当前正在
    var _curBufferOffset = 0;
    var _bufferDataTotal = 0
    var _tasks = []; //读取任务{type: 'once' | 'loop', total: xx, packLen:yy, index:zz, cbFunc: function() }
    var _curTask;
    
    this.taskEmpty = function(){
        return (_curTask == undefined) && (_tasks.length == 0);
    };
    
    function getDataFromBuffers(len)
    {
        var ret = new Buffer(len);
        
        var offset = 0;
        while(len > 0){
            var copyLen = 0;  //本次从当前Buffer中copy出去的数据长度
            var curBuffLeftLen = 0; //当前buffer剩余数据长度
            
            if(_curBuffer)
                curBuffLeftLen = _curBuffer.length - _curBufferOffset;

            copyLen = len;
            if(copyLen > curBuffLeftLen)
                copyLen = curBuffLeftLen;
            
            if(copyLen > 0){
                
                _curBuffer.copy(ret, offset, _curBufferOffset, _curBufferOffset + copyLen);
            
                _curBufferOffset += copyLen;
                offset += copyLen;
                len -= copyLen;
                curBuffLeftLen -= copyLen;
            }

            if(curBuffLeftLen == 0){
                _curBuffer = _buffers.shift();
                _curBufferOffset = 0;
            }

        }
        
        _bufferDataTotal -= ret.length;
        return ret;
    }
    
    function refreshCurTask()
    {

        if(_tasks.length > 0)
            _curTask = _tasks.shift();
        else
            _curTask = undefined;        
    }
    
    //返回满足任务的数据长度
    function taskWantDataLen(task){
        
        var ret = task.packLen;
        var taskLeftLen = task.total - task.packLen * task.index;
        if(taskLeftLen < ret)
            ret = taskLeftLen;
        return ret;
    }

    function callLoopTask(task){
        var readlen = taskWantDataLen(task);
        
        var retData = getDataFromBuffers(readlen);
        task.cbFunc(retData, task.index);
        task.index++;
        
        //是否已经读完总数
        if(taskWantDataLen(task) <= 0)
            refreshCurTask();
    }
    
    var inShedule = false; //To avoid schedule recursively
    
    function schedule(){

        if(inShedule)
            return;
        else
            inShedule = true;
        
        if(!_curTask)
            refreshCurTask();
        
        //缓存数据达到要求的数据量
        while(_curTask && (_bufferDataTotal >= taskWantDataLen(_curTask))){
        
            if(_curTask.type == 'once'){ //单次任务
                var retData = getDataFromBuffers(_curTask.packLen);
                _curTask.cbFunc(retData);
                refreshCurTask();
            }else{ //多次任务
                callLoopTask(_curTask);
            }            
        }
        
        inShedule = false;
    }

    /*流读取函数
        调用格式： StreamReader.read(len, function(data){...})
            可连续调用：StreamReader.read(4, func1).read(10, func2)
        参数：len为要读取的长度，
            cbFunc 为读取到指定长度或出错后的回调，回调的格式为cbFunc(data),data为Buffer格式
    */
    this.read = function(len, cbFunc){
        
        if(getType(cbFunc) != 'function')//如果没有带回调，则定义回调为空函数
            cbFunc = function(){};
        
        _tasks.push({
            type:'once',
            total: len,
            packLen:len,
            index:0,
            cbFunc: cbFunc
        });
     
        schedule();
        return this;
    };

    /*多次流读取函数
        调用格式： StreamReader.loopRead(total, packLen, function(data){...})
            可连续调用：StreamReader.loopRead(4, func1).read(100, 10, func2)
        参数：total为要读取的总长度， packLen为每次读取的长度，最后一次读取可能小于packLen
            cbFunc 为读取到指定长度或出错后的回调，回调的格式为cbFunc(data, index),
                data为Buffer格式
    */
    this.loopRead = function(total, packLen, cbFunc){
        
        if(getType(cbFunc) != 'function')//如果没有带回调，则定义回调为空函数
            cbFunc = function(){};
        
        _tasks.push({
            type:'loop',
            total: total,
            packLen: packLen,
            index:0,
            cbFunc: cbFunc
        });
     
        schedule();
        return this;
    };
        
    this.push = function(data){
        
        //缓冲区不足，拒绝缓存数据
        if((data.length + _bufferDataTotal) > _bufferLimit)
            return false;
        
        _buffers.push(data);
        _bufferDataTotal += data.length;
        
        schedule();
        return true;
    };
    
    this.clear = function(){
        
        _buffers = []; //缓存数组，每个节点为一个push传入的一个Buffer
        _curBuffer = undefined; //当前正在
        _curBufferOffset = 0;
        _bufferDataTotal = 0
        
        _tasks = []; //读取任务{type: 'once' | 'loop', total: xx, packLen:yy, index:zz, cbFunc: function() }
        _curTask = undefined;
        
        return this;
    }
    
};


module.exports = StreamReader;
