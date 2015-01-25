<?php

function randomIntInc (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

var readData = function(){
    return randomIntInc(0,100);
}

module.exports = {read:readData}
?>