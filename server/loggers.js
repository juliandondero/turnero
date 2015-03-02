var winston = require('winston');
var config = require('./config/environment');

var configLoggers=function() {
//configuramos loggers
    winston.loggers.add('turnero_logger', {
        console: {
            level: 'silly',
            colorize: true,
            label: 'TURNERO'
        },
        file: {
            filename: config.sponsor.dir_logs+'turnero.log',
            maxsize:10*1024
        }
    });

    winston.loggers.add('spponsor_logger', {
        console: {
            level: 'silly',
            colorize: true,
            label: 'SPONSOR'
        },
        file: {
            filename: config.sponsor.dir_logs+'sponsor.log',
            maxsize:10*1024
        }
    });



    return {
        sponsor_logger:winston.loggers.get('spponsor_logger'),
        turnero_logger:winston.loggers.get('turnero_logger')
    };

};

module.exports=configLoggers;