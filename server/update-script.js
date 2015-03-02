var loggers=require('./loggers')();

var autoUpdateModule=function(){
    var autoupdater = require('auto-updater')({
        pathToJson: '',
        async: true,
        silent: false,
        autoupdate: true,
        check_git: true
    });

// State the events
    autoupdater.on('git-clone',function(){
        loggers.updater_logger.info("You have a clone of the repository. Use 'git pull' to be up-to-date");
    });
    autoupdater.on('check-up-to-date',function(v){
        loggers.updater_logger.info("You have the latest version: " + v);
    });
    autoupdater.on('check-out-dated',function(v_old , v){
        loggers.updater_logger.info("Your version is outdated. "+v_old+ " of "+v);
        autoupdater.forceDownloadUpdate(); // If autoupdate: false, you'll have to do this manually.
        // Maybe ask if the'd like to download the update.
    });
    autoupdater.on('update-downloaded',function(){
        loggers.updater_logger.info("Update downloaded and ready for install");
        autoupdater.forceExtract(); // If autoupdate: false, you'll have to do this manually.
    });
    autoupdater.on('update-not-installed',function(){
        loggers.updater_logger.info("The Update was already in your folder! It's read for install");
        autoupdater.forceExtract(); // If autoupdate: false, you'll have to do this manually.
    });
    autoupdater.on('extracted',function(){
        loggers.updater_logger.info("Update extracted successfully!");
        loggers.updater_logger.info("RESTART THE APP!");
    });
    autoupdater.on('download-start',function(name){
        console.log("Starting downloading: " + name);
    });
    autoupdater.on('download-update',function(name,perc){
        process.stdout.write("Downloading " + perc + "% \033[0G");
    });
    autoupdater.on('download-end',function(name){
        loggers.updater_logger.info("Downloaded " + name);
    });
    autoupdater.on('download-error',function(err){
        loggers.updater_logger.info("Error when downloading: " + err);
    });
    autoupdater.on('end',function(){
        loggers.updater_logger.info("The app is ready to function");
    });

// Start checking
    autoupdater.forceCheck();
};

module.exports=autoUpdateModule;