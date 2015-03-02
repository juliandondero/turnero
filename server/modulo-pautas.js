var pg = require('pg');
var async = require("async");
var _=require("underscore");
var S = require('string');
var moment = require('moment');
var SponsorUtils=require('./sponsor-utils');
var FileDownloader=require('./http-file-downloader.js');
var config = require('./config/environment');
var fs=require('fs');
var loggers=require('./loggers')();

var bloque = 3600;
/* Obtiene el id del nodo */
var averiguarNodoFn=function(callback){
    var node_id=undefined;
    var query="SELECT * FROM nodo n WHERE n.nombre=$1::varchar ";
    context.client.query(query,[context.nombreNodo], function(err, result) {
        if(err) {
            console.error('Error running query: '+queryNodo, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                callback("No se encontro nodo con nombre"+nombreNodo,null);
            } else {

                node_id=result.rows[0].id;
                context.node_id=node_id;
                callback(null,"averiguarNodoFn - OK");
            }
        }
    });

};

/* Obtiene las pautas del nodo */
var getPautasGrupoFn=function(callback){
    context.pautas=[];
    var query="SELECT pp.id as id, pp.nombre_archivo as path,pp.version as version,pp.estado as estado,pp.completa as completa,pp.publicidad_pauta_tipo as tipo, pp.muleto as muleto, pp.repeticion as repeticion, pp.prioridad as prioridadPauta,"
        +
        " pp.fecha_desde as fechaDesde, pp.fecha_hasta fechaHasta, pp.duracion as duracion,pp.url_archivo as urlArchivo, pge.publicidad_grupo as grupo,pms.id as idMainSponsor, ps.id as idSponsor, ps.prioridad AS prioridadSponsor, pms.prioridad as prioridadMainSponsor" +
        " FROM publicidad_grupo_entidad pge JOIN publicidad_grupo pg ON (pge.publicidad_grupo = pg.id ) " +
        " JOIN publicidad_contrato pc ON (pg.id=pc.publicidad_grupo) " +
        " JOIN publicidad_pauta pp ON (pc.id=pp.publicidad_contrato) " +
        " JOIN publicidad_sponsor ps ON (pc.entidad=ps.id) " +
        " JOIN publicidad_main_sponsor pms ON (ps.publicidad_main_sponsor=pms.id) WHERE pge.entidad=$1::bigint AND  pc.fecha_desde::DATE <= $2::DATE AND pc.fecha_hasta::DATE >= $2::DATE AND NOT pc.muleto AND pp.estado='1' AND (pp.publicidad_pauta_tipo=$3::smallint OR pp.publicidad_pauta_tipo='0')";
    context.client.query(query,[context.node_id,context.fechaActual,context.tipoPuesto], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                callback(null,"No se encontron pautas por grupo");
            } else {

                _.each(result.rows,function(row){
                    context.pautas.push(
                        {
                            id: row.id,
                            nombreArchivo:row.path,
                            estado:row.estado,
                            completa:row.completa,
                            repeticion:row.repeticion,
                            prioridadPauta:row.prioridadPauta,
                            fechaDesde:row.fechaDesde,
                            fechaHasta:row.fechaHasta,
                            duracion:row.duracion,
                            grupo:row.grupo,
                            idMainSponsor:row.idMainSponsor,
                            idSponsor: row.idSponsor,
                            prioridadSponsor:row.prioridadSponsor,
                            prioridadMainSponsor:row.prioridadMainSponsor,
                            tiempoSponsor:context.tiempos[row.idSponsor],
                            tiempoMainSponsor:context.tiempos[row.idMainSponsor],
                            muleto: row.muleto,
                            tipo:row.tipo,
                            version:row.version,
                            urlArchivo:S(row.urlarchivo).endsWith("/")?row.urlarchivo:row.urlarchivo+"/"

                        }
                    );
                });

                callback(null,"getPautasGrupoFn - OK");
            }
        }
    });

};

var getTiemposSponsorFn=function(callback){
    context.tiempos={};
    var query="SELECT pc.entidad as id, SUM (pc.segundos) as segundos " +
        " FROM publicidad_grupo_entidad pge JOIN publicidad_grupo pg ON (pge.publicidad_grupo = pg.id ) " +
        " JOIN publicidad_contrato pc ON (pg.id=pc.publicidad_grupo)  WHERE pge.entidad=$1::bigint AND pc.fecha_desde::DATE <= $2::DATE AND pc.fecha_hasta::DATE >= $2::DATE" +
        " GROUP BY pc.entidad";
    context.client.query(query,[context.node_id,context.fechaActual], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                error="No se obtuvieron los tiempos de las entidades";
                callback(error,null);
            } else {



                _.each(result.rows,function(row){
                    context.tiempos[row.id]=row.segundos;
                });


                callback(null,"getTiemposSponsorFn - OK");
            }
        }
    });

};

var getAdministradorIdFn=function(callback){

    if (context.pautas.length<=0){
        //Si no hay pautas registradas
        var query="SELECT id as idAdministrador FROM publicidad_administrador";
        context.client.query(query,[], function(err, result) {
            if(err) {
                console.error('Error running query: '+query, err);
                callback(err,null);
            } else {
                if (result==undefined || result.rows.length<=0){
                    callback("No se encontro administrador",null);
                } else {

                    context.idAdministrador=result.rows[0].idadministrador;
                    callback(null,"getAdministradorIdFn - OK");
                }
            }
        });
    } else {
        //Si hay pautas registradas
        var query="SELECT pa.id as idAdministrador FROM publicidad_main_sponsor pms JOIN publicidad_administrador pa ON (pms.publicidad_administrador = pa.id) WHERE pms.id=$1::bigint";
        context.client.query(query,[context.pautas[0].idMainSponsor], function(err, result) {
            if(err) {
                console.error('Error running query: '+query, err);
                callback(err,null);
            } else {
                if (result==undefined || result.rows.length<=0){
                    error="No se encontro administrador";
                    callback(error,null);
                } else {

                    context.idAdministrador=result.rows[0].idadministrador;
                    callback(null,"getAdministradorIdFn - OK");
                }
            }
        });
    }



};



/* Obtiene las pautas del nodo */
var getSponsorsDeMainSponsorsFn=function(callback){
    context.sponsorsDeMainSponsors={};
    var query=" SELECT er.entidad as idEntidad, er.entidad_relacion as idSponsor FROM entidad_relacion er WHERE er.tipo_relacion='31'";
    context.client.query(query,[], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){

                callback(null,"No se encontron sponsors de main sponsors ");
            } else {


                _.each(result.rows,function(row){
                    context.sponsorsDeMainSponsors[row.identidad]=row.idsponsor;
                });

                callback(null,"getSponsorsDeMainSponsorsFn - OK");
            }
        }
    });

};



/* Obtiene las pautas del nodo */
var getSponsorsDeAdministradorFn=function(callback){

    var query= " SELECT er.entidad as idAdmin, er.entidad_relacion as idMainSponsor FROM entidad_relacion er WHERE tipo_relacion='30' AND entidad=$1::bigint";
    context.client.query(query,[context.idAdministrador], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                error="No se encontron sponsors de administrador ";
                callback(error,null);
            } else {
                var idMainSponsor=result.rows[0].idmainsponsor;
                var idSponsorOficialAdmin=context.sponsorsDeMainSponsors[idMainSponsor];
                if (idSponsorOficialAdmin!=undefined){
                    context.sponsorsDeMainSponsors[result.rows[0].idadmin]=idSponsorOficialAdmin;

                    callback(null,"getSponsorsDeAdministradorFn - OK");
                } else {
                    var err="PROBLEMA: No se encontro el sponsor oficial del administrador...";

                    callback(err,null)
                }


            }
        }
    });

};



/* Busco pautas muleto de contratos muletos del sponsor oficial del administrador... */
var getPautasMuletoAdministradorFn=function(callback){

    context.muletosAdministrador=[];

    var query="SELECT pp.id as id, pp.nombre_archivo as path,pp.version as version,pp.estado as estado,pp.completa as completa,pp.publicidad_pauta_tipo as tipo, pp.muleto as muleto, pp.repeticion as repeticion, pp.prioridad as prioridadPauta,"
        +
        " pp.fecha_desde as fechaDesde, pp.fecha_hasta fechaHasta, pp.duracion as duracion,pp.url_archivo as urlArchivo, pge.publicidad_grupo as grupo,pms.id as idMainSponsor, ps.id as idSponsor, ps.prioridad AS prioridadSponsor, pms.prioridad as prioridadMainSponsor" +
        " FROM publicidad_grupo_entidad pge JOIN publicidad_grupo pg ON (pge.publicidad_grupo = pg.id ) " +
        " JOIN publicidad_contrato pc ON (pg.id=pc.publicidad_grupo) " +
        " JOIN publicidad_pauta pp ON (pc.id=pp.publicidad_contrato) " +
        " JOIN publicidad_sponsor ps ON (pc.entidad=ps.id) " +
        " JOIN publicidad_main_sponsor pms ON (ps.publicidad_main_sponsor=pms.id) WHERE ps.id=$1::bigint AND pge.entidad=$2::bigint AND  pc.fecha_desde::DATE <= $3::DATE AND pc.fecha_hasta::DATE >= $3::DATE AND pc.muleto AND pp.estado='1'";
    context.client.query(query,[context.sponsorsDeMainSponsors[context.idAdministrador],context.node_id,context.fechaActual], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                callback(null,"No se encontron pautas muleto del administrador");
            } else {

                _.each(result.rows,function(row){
                    context.muletosAdministrador.push(
                        {
                            id: row.id,
                            nombreArchivo:row.path,
                            estado:row.estado,
                            completa:row.completa,
                            repeticion:row.repeticion,
                            prioridadPauta:row.prioridadpauta,
                            fechaDesde:row.fechadesde,
                            fechaHasta:row.fechahasta,
                            duracion:row.duracion,
                            grupo:row.grupo,
                            idMainSponsor:row.idmainsponsor,
                            idSponsor: row.idsponsor,
                            prioridadSponsor:row.prioridadsponsor,
                            prioridadMainSponsor:row.prioridadmainsponsor,
                            tiempoSponsor:context.tiempos[row.idsponsor],
                            tiempoMainSponsor:context.tiempos[row.idmainsponsor],
                            muleto: true,
                            tipo:row.tipo,
                            version:row.version,
                            urlArchivo:S(row.urlarchivo).endsWith("/")?row.urlarchivo:row.urlarchivo+"/"

                        }
                    );
                });

                callback(null,"getPautasMuletoAdministradorFn - OK");
            }
        }
    });

};



/* Busco pautas muleto de contratos muletos del sponsor oficial del administrador... */
var getPautasMuletoFn=function(callback){

    context.muletosPorMainSponsor={};
    context.muletosPorMainSponsorPropias={};

    var query="SELECT pp.id as id, pp.nombre_archivo as path,pp.version as version,pp.estado as estado,pp.completa as completa,pp.publicidad_pauta_tipo as tipo, pp.muleto as muleto, pp.repeticion as repeticion, pp.prioridad as prioridadPauta,"
        +
        " pp.fecha_desde as fechaDesde, pp.fecha_hasta fechaHasta, pp.duracion as duracion,pp.url_archivo as urlArchivo, pge.publicidad_grupo as grupo,pms.id as idMainSponsor, ps.id as idSponsor, ps.prioridad AS prioridadSponsor, pms.prioridad as prioridadMainSponsor" +
        " FROM publicidad_grupo_entidad pge JOIN publicidad_grupo pg ON (pge.publicidad_grupo = pg.id ) " +
        " JOIN publicidad_contrato pc ON (pg.id=pc.publicidad_grupo) " +
        " JOIN publicidad_pauta pp ON (pc.id=pp.publicidad_contrato) " +
        " JOIN publicidad_sponsor ps ON (pc.entidad=ps.id) " +
        " JOIN publicidad_main_sponsor pms ON (ps.publicidad_main_sponsor=pms.id) WHERE pge.entidad=$1::bigint AND  pc.fecha_desde::DATE <= $2::DATE AND pc.fecha_hasta::DATE >= $2::DATE AND pc.muleto AND pp.estado='1'";
    context.client.query(query,[context.node_id,context.fechaActual], function(err, result) {
        if(err) {
            console.error('Error running query: '+query, err);
            callback(err,null);
        } else {
            if (result==undefined || result.rows.length<=0){
                callback(null,"No se encontron pautas muletos");
            } else {

                _.each(result.rows,function(row){

                    var pauta=    {
                        id: row.id,
                        nombreArchivo:row.path,
                        estado:row.estado,
                        completa:row.completa,
                        repeticion:row.repeticion,
                        prioridadPauta:row.prioridadpauta,
                        fechaDesde:row.fechadesde,
                        fechaHasta:row.fechahasta,
                        duracion:row.duracion,
                        grupo:row.grupo,
                        idMainSponsor:row.idmainsponsor,
                        idSponsor: row.idsponsor,
                        prioridadSponsor:row.prioridadsponsor,
                        prioridadMainSponsor:row.prioridadmainsponsor,
                        tiempoSponsor:context.tiempos[row.idsponsor],
                        tiempoMainSponsor:context.tiempos[row.idmainsponsor],
                        muleto: true,
                        tipo:row.tipo,
                        version:row.version,
                        urlArchivo:S(row.urlarchivo).endsWith("/")?row.urlarchivo:row.urlarchivo+"/"

                    };



                    // si son muletos de contratos muletos que no son propios del
                    // sponsor del main sponsors, los guardo en muletosPorMainSponsors
                    if (pauta.idSponsor!=context.sponsorsDeMainSponsors[pauta.idMainSponsor]) {

                        if (context.muletosPorMainSponsor[pauta.idMainSponsor]!=undefined) {
                            context.muletosPorMainSponsor[pauta.iddMainSponsor].push(pauta);
                        } else {
                            var pautasMuletosPorMainSponsor = [];
                            pautasMuletosPorMainSponsor.push(pauta);
                            context.muletosPorMainSponsor[pauta.idMainSponsor]=pautasMuletosPorMainSponsor;
                        }
                    } else {
                        // si son muletos de contratos muletos que son propios del
                        // sponsor del main sponsors
                        if (context.muletosPorMainSponsorPropias[pauta.idMainSponsor]!=undefined) {
                            context.muletosPorMainSponsorPropias[pauta.idMainSponsor].push(pauta);
                        } else {
                            var pautasMuletosPorMainSponsor = [];
                            pautasMuletosPorMainSponsor.push(pauta);
                            context.muletosPorMainSponsorPropias[pauta.idMainSponsor]=pautasMuletosPorMainSponsor;
                        }
                    }

                });

                callback(null,"getPautasMuleto - OK");
            }
        }
    });

};


/* Busco pautas muleto de contratos muletos del sponsor oficial del administrador... */
var logInfoFn=function(callback){

    loggers.sponsor_logger.info("****************** INFO *****************");
    loggers.sponsor_logger.info("NODO: "+context.node_id);
    loggers.sponsor_logger.info("idAdministrador: "+context.idAdministrador);
    loggers.sponsor_logger.info("id sponsor oficial del administrador: "+context.sponsorsDeMainSponsors[context.idAdministrador]);
    loggers.sponsor_logger.info("Sponsors Oficiales Encontrados: "+Object.keys(context.sponsorsDeMainSponsors).length);
    loggers.sponsor_logger.info("Pautas: " + context.pautas.length);
    loggers.sponsor_logger.info("Muletos Administrador: " + context.muletosAdministrador.length );
    loggers.sponsor_logger.info("Muletos por Main Sponsor: " + Object.keys(context.muletosPorMainSponsor).length);
    loggers.sponsor_logger.info("Muletos por Main Sponsor Propios: " + Object.keys(context.muletosPorMainSponsorPropias).length);

    loggers.sponsor_logger.info("****************** FIN INFO *****************");

    callback(undefined,undefined);

};

var callbackFn=function(callbackPautas){
    return function(error,contexto){

        if (error!=undefined){
            context.client.end();
            loggers.sponsor_logger.error(error);
        }

        _.each(contexto,function(cont){
            if (cont!=undefined)
                loggers.sponsor_logger.info(cont);
        });

        if (error==undefined){
            callbackPautas(context);

        }

    };
};


/* Armamos la lista de reproduccion */
var armarListaReproduccion=function(contexto,callback){

    loggers.sponsor_logger.info("Armando lista de reproduccion...");
    var contadorDeTiempo = {
        tiempo:bloque,
        getTiempoDisponible:function() {
            return this.tiempo;
        },
        descontarTiempo:function(tiempoADescontar) {
            this.tiempo=this.tiempo-tiempoADescontar;
        }
    };

    var listaTodas=[];

    // Tenemos las pautas separadas por main sponsors y sus tiempos | MP1 | MP2 | MP3(ZETTI) | MP4 (COMERCIO) ordenadas por prioridad del Main Sponsor
    var pautasPorEntidadMainSponsors=SponsorUtils.separarPautasPorMainSponsor(contexto.pautas);

    _.each(pautasPorEntidadMainSponsors,function(pautasPorMainSponsor){

        var pautasPorEntidad = SponsorUtils.separarPautasPorSponsor(pautasPorMainSponsor);
        var pautasOrdenadas = SponsorUtils.cortarYOrdenarPautasPorTiempoPorEntidad(	pautasPorEntidad, contexto.muletosPorMainSponsor,context.muletosPorMainSponsorPropias,contadorDeTiempo);

        // relleno el espacio que queda de la lista del main sponsor, con
        // sus contratos muletos (no propios) o si no tiene, con muletos
        // propios

        var id_main_sponsor = pautas[0].idMainSponsor;
        var tiempoTotalUtilizado = SponsorUtils.tiempoTotalUtilizado(pautasOrdenadas);

        if ((contexto.muletosPorMainSponsor[id_main_sponsor]!=undefined) && (contexto.muletosPorMainSponsor[id_main_sponsor].length > 0)) {
            // relleno con contratos muletos que no son propios del main sponsor
            SponsorUtils.rellenarConMuletos(contadorDeTiempo,contexto.tiempos[id_main_sponsor] - tiempoTotalUtilizado,
                contexto.muletosPorMainSponsor[id_main_sponsor],pautasOrdenadas);
        } else {
            if (contexto.muletosPorMainSponsorPropias[id_main_sponsor]!= undefined && (contexto.muletosPorMainSponsorPropias[id_main_sponsor].length > 0)) // relleno con contratos muletos que si son propios del main sponsor
                SponsorUtils.rellenarConMuletos(contadorDeTiempo,context.tiempos[id_main_sponsor]-tiempoTotalUtilizado,	contexto.muletosPorMainSponsorPropias[id_main_sponsor],	pautasOrdenadas);
        }

        listaTodas.push(pautasOrdenadas);

    });

    // Hago el merge de todas las pautas totales entre Main Sponsors,
    // Comercios y Administradores, estan ordenadas por prioridad
    var listaReproduccion = SponsorUtils.mergePautas(listaTodas);

    // Relleno con muletos del administrador, este deberá tener un contrato
    // muleto con su respectivo sponsor

    SponsorUtils.rellenarConMuletos(contadorDeTiempo,contadorDeTiempo.getTiempoDisponible(), contexto.muletosAdministrador,	listaReproduccion);

    listaReproduccion= _.map(listaReproduccion,function(pauta){
        var lan_path=config.sponsor.url_videos+pauta.nombreArchivo;

        var pauta_min={
            id:pauta.id,
            path:pauta.path,
            lan_path:(lan_path==undefined)?"":lan_path,
            mediaOptions:pauta.mediaOptions
        };

        return pauta_min;
    });

    if (callback!=undefined)
        callback(listaReproduccion);


};

var getPautasAReproducir=function(url_conection,nombreNodo,tipoPuesto,puestoVenta,callbackPautas) {

    loggers.sponsor_logger.info("Iniciando el modulo de pautas...");

    var cliente = new pg.Client(url_conection);
    loggers.sponsor_logger.info("Conectando a base dedatos...: ");

    cliente.connect(function (err) {
        if (err) {
            loggers.sponsor_logger.error('No se pudo conectar con postgres', err);
            return;
        }

        context = {
            client: cliente,
            nombreNodo: nombreNodo,
            tipoPuesto: tipoPuesto,
            puestoVenta: puestoVenta,
            fechaActual: (new moment()).format("YYYY-MM-DD")
        };

        async.series([
                averiguarNodoFn,
                getTiemposSponsorFn,
                getPautasGrupoFn,
                getAdministradorIdFn,
                getSponsorsDeMainSponsorsFn,
                getSponsorsDeAdministradorFn,
                getPautasMuletoAdministradorFn,
                getPautasMuletoFn,
                logInfoFn


            ],
            callbackFn(callbackPautas));


    });
}

var filtrarPautasInexistentes=function(context){

    context.pautas= _.filter(context.pautas,function(pauta){
        var path= SponsorUtils.pathYversion2NombreArchivo(pauta.nombreArchivo,pauta.version);
        path=config.sponsor.dir_videos+path;
        return fs.existsSync(config.sponsor.dir_videos+path);
    });

    _.each(_.keys(context.muletosPorMainSponsor),function(idMainSponsor){
        context.muletosPorMainSponsor[idMainSponsor]= _.filter(context.muletosPorMainSponsor[idMainSponsor],function(pauta){
            var path= SponsorUtils.pathYversion2NombreArchivo(pauta.nombreArchivo,pauta.version);
            return fs.existsSync(config.sponsor.dir_videos+path);
        });
    });

    _.each(_.keys(context.muletosPorMainSponsorPropias),function(idMainSponsor){
        context.muletosPorMainSponsorPropias[idMainSponsor]= _.filter(context.muletosPorMainSponsorPropias[idMainSponsor],function(pauta){
            var path= SponsorUtils.pathYversion2NombreArchivo(pauta.nombreArchivo,pauta.version);
            return fs.existsSync(config.sponsor.dir_videos+path);
        });
    });

    context.muletosAdministrador= _.filter(context.muletosAdministrador,function(pauta){
        var path= SponsorUtils.pathYversion2NombreArchivo(pauta.nombreArchivo,pauta.version);
        return fs.existsSync(config.sponsor.dir_videos+path);
    });

}

/* Módulo de pautas, obtiene pautas publicitarias */
var moduloPautasFunction=function(url_conection){

    return {
        getListaReproduccion: function(nombre_nodo,puestoVenta,tipoPuesto,callbackListaReproduccion){
            var callbackPautas=function(context){

                filtrarPautasInexistentes(context);

                armarListaReproduccion(context,callbackListaReproduccion);
            };

            getPautasAReproducir(url_conection,nombre_nodo,tipoPuesto,puestoVenta,callbackPautas);
        },
        loguearPautaReproducida:function (pautaReproducida,puestoVenta, nombre_nodo,callback_success,callback_error) {


            var cliente = new pg.Client(url_conection);

            cliente.connect(function (err) {
                if (err) {
                    console.error('No se pudo conectar con postgres', err);
                    return;
                }

                var fecha_actual = (new moment()).format("YYYY-MM-DD HH:mm:ss");

                var segundos = pautaReproducida.mediaOptions;

                var node_id=undefined;

                var query="SELECT * FROM nodo n WHERE n.nombre=$1::varchar ";

                cliente.query(query,[nombre_nodo], function(err, result) {
                    if(err) {

                        loggers.sponsor_logger.error('Error running query: '+queryNodo, err);
                        callback_error(err);

                    } else {

                        if (result==undefined || result.rows.length<=0){
                            if (callback_error!=undefined)
                                callback_error(err);

                        } else {

                            node_id=result.rows[0].id;

                            //una vez que tenemos el nodo, logueamos la pauta

                            var query="INSERT INTO publicidad_visualizaciones (id,publicidad_pauta,fecha,segundos,puesto_venta,nodo_creacion)"
                                + " VALUES (nextval('publicidad_visualizaciones_sq'),$1,$2::TIMESTAMP,$3,$4,$5)";


                            cliente.query(query,[pautaReproducida.id,fecha_actual,segundos,puestoVenta,node_id], function(err, result) {
                                if(err) {
                                    loggers.sponsor_logger.error('Error running query: '+query, err);
                                    if (callback_error!=undefined)
                                        callback_error(err);
                                } else {
                                    if (callback_success!=undefined)
                                        callback_success();
                                }
                            });

                        }
                    }
                });

            });
        },
        descargar_pautas: function(puestos,callback_success,callback_error){

            _.each(puestos,function(puesto){

                var callbackPautas=function(context){

                    var pautas_a_descargar=context.pautas;
                    // (ya estan incluidas en muletos por main sponsors propias, ver)  pautas_a_descargar= _.union(pautas_a_descargar,(context.muletosAdministrador!=undefined)?context.muletosAdministrador:[]);

                    pautas_a_descargar= _.union(pautas_a_descargar, _.flatten(_.values(context.muletosPorMainSponsor),0));
                    pautas_a_descargar= _.union(pautas_a_descargar, _.flatten(_.values(context.muletosPorMainSponsorPropias),0));


                    loggers.sponsor_logger.info("Pautas a descargar: "+pautas_a_descargar.length);

                    //armo la lista de archivos
                    var files= _.map(pautas_a_descargar,function(pauta){
                        var path=pauta.urlArchivo+pauta.nombreArchivo;

                        return {
                            url:path,
                            name: SponsorUtils.pathYversion2NombreArchivo(path,pauta.version),
                            dest:config.sponsor.dir_videos
                        };
                    });

                    FileDownloader.download_files(files,callback_success,callback_error);

                };

                getPautasAReproducir(url_conection,puesto.nombreNodo,puesto.tipoPuesto,puesto.puestoVenta,callbackPautas);

            });

        }
    }

}


module.exports=moduloPautasFunction;