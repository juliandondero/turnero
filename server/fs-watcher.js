var fs= require('fs');
var xml2js=require('xml2js');
var loggers=require('./loggers')();

var jsonParser = new xml2js.Parser();
var json2XmlBuilder = new xml2js.Builder();

var fsWatcherFunction=function(urlXmlEndpointIn,urlXmlEndpointOut,turnos){

    loggers.sponsor_logger.info('Esperando mensajes en: '+urlXmlEndpointIn);
    loggers.sponsor_logger.info('Escribiendo salida en: '+urlXmlEndpointOut);
    var jsonResp;

    fs.watch(urlXmlEndpointIn, function (event, filename) {
        var fileSplited=filename.split(".");
        var extension=fileSplited[fileSplited.length-1];
        loggers.sponsor_logger.info("evento: "+event);
        if (extension=="xml" && event=="change"){
            loggers.sponsor_logger.info('filename provided: ' + filename);

            //parseamos el archivo
            fs.readFile(urlXmlEndpointIn+filename, function(err, data) {

                //borramos el archivo de entrada
                fs.unlink(urlXmlEndpointIn+filename);

                jsonParser.parseString(data, function (err, jsonMessage) {

                    //tenemos el mensaje en json, llamamos a la funcion correspondiente
                    var keys=Object.keys(jsonMessage);
                    if (keys!=undefined && keys.length>0 && keys[0]!=undefined){
                        switch(keys[0]){
                            case "get_actual":
                                jsonResp=get_actual_function(jsonMessage,turnos);
                                break;
                            case "siguiente":
                                jsonResp=siguiente_function(jsonMessage,turnos);
                                break;
                            case "anterior":
                                jsonResp=anterior_function(jsonMessage,turnos);
                                break;
                            case "reset":
                                jsonResp=reset_function(jsonMessage,turnos);
                                break;
                            case "set":
                                jsonResp=set_function(jsonMessage,turnos);
                                break;
                            case "turno_solapado":

                                jsonResp=turno_solapado_function(jsonMessage,turnos);
                                break;
                            case "get_config":
                                jsonResp=get_config_function(turnos);
                                break;
                            default:
                                loggers.sponsor_logger.error("mensaje no reconocido!");
                                break;
                        }


                        var xmlResp = json2XmlBuilder .buildObject(jsonResp);
                        fs.writeFile(urlXmlEndpointOut+filename, xmlResp, function(err) {
                            if(err) {
                                loggers.sponsor_logger.error(err);
                            } else {
                                loggers.sponsor_logger.info(filename+" escrito en directorio...");
                            }
                        });
                    }

                });
            });



        }

    });

}

var get_actual_function=function(jsonMessage,turnos){
    try {
        var cola_id=jsonMessage.get_actual.id_cola[0];
        current=turnos.current(cola_id);
        jsonResp={
            get_actual_response: {
                id_cola:cola_id,
                numero:current.current
            }
        };
    } catch (e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}

var siguiente_function=function(jsonMessage,turnos){
    try {
        var cola_id=jsonMessage.siguiente.id_cola[0];
        var from = jsonMessage.siguiente.from[0];
        current=turnos.next(from,cola_id);

        jsonResp={
            siguiente_response: {
                id_cola:cola_id,
                numero:current.current,
                from: from
            }
        };
    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}


var anterior_function=function(jsonMessage,turnos){
    try {
        var cola_id=jsonMessage.anterior.id_cola[0];
        var from = jsonMessage.anterior.from[0];
        current=turnos.previous(from,cola_id);

        jsonResp={
            anterior_response: {
                id_cola:cola_id,
                numero:current.current,
                from: from
            }
        };
    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}

var reset_function=function(jsonMessage,turnos){
    try {
        var cola_id=jsonMessage.reset.id_cola[0];
        var from = jsonMessage.reset.from[0];
        current=turnos.reset(from,cola_id);

        jsonResp={
            reset_response: {
                id_cola:cola_id,
                numero:current.current,
                from: from
            }
        };
    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}

var set_function=function(jsonMessage,turnos){
    try {

        var cola_id=jsonMessage.set.id_cola[0];
        var from = jsonMessage.set.from[0];
        var numero = jsonMessage.set.numero[0];

        current=turnos.set(from,cola_id,numero);

        jsonResp={
            set_response: {
                id_cola:cola_id,
                numero:current.current,
                from: from
            }
        };
    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}


var turno_solapado_function=function(jsonMessage,turnos){
    try {

        var cola_id=jsonMessage.turno_solapado.id_cola[0];
        var from = jsonMessage.turno_solapado.from[0];
        var numero = jsonMessage.turno_solapado.numero[0];

        current=turnos.set_turno_solapado(from,cola_id,numero);

        jsonResp={
            turno_solapado_response: {
                id_cola:cola_id,
                numero:current.current,
                from: from
            }
        };
    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}
var get_config_function=function(turnos){
    try {

        config=turnos.getConfig();
        colas_array=[];
        for(var cola_id in config.colas){
            colas_array.push(config.colas[cola_id]);
        }
        jsonResp={
            get_config_response: {
                colas:{
                    cola:colas_array
                },
                generador:config.generador,
                pantallas:config.pantallas
            }
        };

    } catch(e){
        loggers.sponsor_logger.error(e);
    }

    return jsonResp;
}
module.exports=fsWatcherFunction;