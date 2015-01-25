var PythonShell = require('python-shell');
var availableScripts = ['motion_sensor']
var options = {
  scriptPath: '../sensors/'
};

function randomIntInc (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

var readData = function(param, callback){
    if(availableScripts.indexOf(param) > -1){
        PythonShell.run(param+'.py', options, function (err, data) {
              if (err) throw err;
              // console.log("Motion: ",parseInt(data[0]));
              if (data){
                    callback({type:param, value:data, error: false, message:null});
              }
        });
    } else {
        callback({error:true, message:"Invalid sensor"});
    }
}

module.exports = {read:readData}
