var async = require("async");
var _=require("underscore");
var S = require('string');
var moment = require('moment');
var loggers=require('./loggers')();

var get_pautas_main_sponsorFn=function(id_entidad,pautas){
    return _.filter(pautas,function(pauta){
        return pauta.idMainSponsor==id_entidad;
    });
}

var get_pautas_sponsorFn=function(id_entidad,pautas){
    return _.filter(pautas,function(pauta){
        return pauta.idSponsor==id_entidad;
    });
}

var filtrarMuletos=function(pautas){
    var muletos = _.filter(pautas,function(pauta){
        return pauta.muleto;
    });
    pautas=_.difference(pautas,muletos);
    return muletos;
};

var pathYversion2NombreArchivo=function(path, version){
    var carpetas= path.split("/");
    return "v"+version+"-"+carpetas[carpetas.length-1];
};

var getPautaVisualizacion=function(pauta){
    var pautaVisualizacion = _.clone(pauta);
    pautaVisualizacion.nombreArchivo=pathYversion2NombreArchivo(pauta.urlArchivo+pauta.nombreArchivo,pauta.version);
    pautaVisualizacion .path=pauta.urlArchivo+pauta.nombreArchivo;

    return pautaVisualizacion;
}





var utilsModule={
    /** SEPARA Y ORDENA POR PRIORIDAD LAS PAUTAS DE CADA MAIN SPONSOR - DEVUELVE LA LISTA ORDENADA POR PRIORIDAD DE MAIN SPONSOR */
    separarPautasPorMainSponsor: function(pautas){

        var pautasPorEntidad=[];
        //separamos las pautas por main sponsor
        var ids_entidades= _.filter(_.map(pautas,function(pauta){
            return pauta.idMainSponsor;
        }));

        _.each(ids_entidades,function(id_entidad){
            pautasPorEntidad.push(get_pautas_main_sponsorFn(id_entidad,pautas));
        });

        //Ordenamos las listas de pautas de cada main sponsor, por la prioridad del Main Sponsor
        var ordenadas_prioridad_main_sponsor = _.sortBy(pautasPorEntidad,function(elem){
            return (elem[0].prioridadMainSponsor);
        });

        return ordenadas_prioridad_main_sponsor;
    },
    separarPautasPorSponsor: function(pautas){

        var pautasPorEntidad=[];
        //separamos las pautas por main sponsor
        var ids_entidades= _.filter(_.map(pautas,function(pauta){
            return pauta.idSponsor;
        }));

        _.each(ids_entidades,function(id_entidad){
            pautasPorEntidad.push(get_pautas_sponsorFn(id_entidad,pautas));
        });

        //Ordenamos las listas de pautas de cada main sponsor, por la prioridad del Main Sponsor
        var ordenadas_prioridad_sponsor = _.sortBy(pautasPorEntidad,function(elem){
            return (elem[0].prioridadSponsor);
        });

        return ordenadas_prioridad_sponsor ;
    },
    cortarYOrdenarPautasPorTiempoPorEntidad: function(pautasPorEntidad, muletosPorMainSponsor,muletosPorMainSponsorPropias,contadorTiempo){

        var listasEntidades_aux=[];

        _.each(pautasPorEntidad,function(listaEntidad){

            var listaEntidad_aux=[];
            var tiempoSponsor=listaEntidad[0].segundosSponsor;

            var indice=0;

            var muletos=filtrarMuletos(listaEntidad);

            while (tiempoSponsor > 0 && contadorTiempo.tiempoDisponible()>0){

                if (listaEntidad.length>0){

                    var pauta=listaEntidad[indice];

                    //si le quedan repeticiones y entran en el tiempo que resta o no entra pero no es completa, la agrego a la lista de pautas de esa entidad
                    if ((pauta.completa && tiempoSponsor >= pauta.duracion && contadorTiempo.tiempoDisponible() >= pauta.duracion) || (!pauta.completa)) {
                        if ( pauta.repeticion >0 ){

                            var pautaVisualizacion= getPautaVisualizacion(pauta);

                            //agrego la pauta a la lista al final, y descuento el tiempo de la pauta
                            var tiempoDisponible;
                            if (tiempoSponsor <= contadorTiempo.tiempoDisponible())
                                tiempoDisponible=tiempoSponsor; //corta por que se acaba el tiempo del sponsor y no del bloque de 3600
                            else
                                tiempoDisponible=contadorTiempo.tiempoDisponible(); // corta por el total del bloque de 3600

                            //seteo la duracion que pusieron en el video, si el video que subieron dura mas que
                            //el tiempo contratado se corta, si no entra pero no es completa, se reproduce el tiempo que tiene
                            if (tiempoDisponible<pauta.duracion){ // se que si pasa esto es porque no es completa la pauta

                                pautaVisualizacion.mediaOptions=tiempoDisponible;
                                tiempoSponsor =  0;
                                //descuento el tiempo que use de la pauta, del general
                                contadorDeTiempo.descontarTiempo(tiempoDisponible);

                            }else{

                                pautaVisualizacion.mediaOptions=pauta.duracion;
                                tiempoSponsor=tiempoSponsor-pauta.duracion;
                                //descuento el tiempo que use de la pauta, del general
                                contadorDeTiempo.descontarTiempo(pauta.duracion);
                            }

                            listaEntidad_aux.push(pautaVisualizacion);

                            //descuento repeticiones de pautas
                            pauta.repeticion=pauta.repeticion-1;
                        }
                        else
                            listaEntidad=listaEntidad.splice(indice,1); //saco la pauta de la lista
                    } else {
                        //si la pauta es copleta y no queda tiempo para ella, tambien la saco
                        listaEntidad=listaEntidad.splice(indice,1); //saco la pauta de la lista
                    }
                }
                if ((listaEntidad.length<=0) && (tiempoSponsor > 0) && (contadorDeTiempo.getTiempoDisponible()>0)){
                    //relleno con muletos, si no tengo de ese sponsor, luego rellenare el tiempo restante con pautas muletos del main sponsor o administrador
                    if (muletos.length>0){
                        this.rellenarConMuletos(contadorDeTiempo,tiempoSponsor,muletos, listaEntidad_aux);

                    }
                    tiempoSponsor = 0;

                }
                indice=indice+1;
                if (listaEntidad.length!=0) indice=(indice % listaEntidad.length ); //para que no desborde de la lista, si llega al final vuelvea cero



            }

            //guardo la lista que tiene ordenadas las pautas con muletos y repeticiones
            if (listaEntidad_aux.length>0)
                listasEntidades_aux.push(listaEntidad_aux);


        });

        //Ahora hago el merge de todas las sublistas sacando de a uno de cada sublista.

        var listaFinal = [];

        //ordeno el arreglo por prioridades de los sponsors duenos de las pautas
        _.sortBy(listasEntidades_aux,function(listaEntidad){
            return listaEntidad[0].prioridadSponsor;
        });

        listaFinal=this.mergePautas(listasEntidades_aux);
        return listaFinal;
    },
    tiempoTotalUtilizado: function(pautasOrdenadas){
        return _.reduce(pautasOrdenadas, function(memo, pauta){ return memo + pauta.mediaOptions; }, 0);
    },
    /** Agrega a la lista pautas, las pautas muletos necesarias para rellenar el tiempo tiempoRestante.
     La ultima la corta con los segundos necesarios para terminar en 0.	 */
    rellenarConMuletos: function(contadorDeTiempo, tiempoRestanteSponsors,muletos, pautas) {
        var indice_muletos=0;
        while (tiempoRestanteSponsors >0 && contadorDeTiempo.getTiempoDisponible()>0 ){

            if (muletos.length>0){
                var muleto = muletos[indice_muletos];
                var muleto_nuevo= getPautaVisualizacion(muleto);

                var tiempoDisponible;
                if (tiempoRestanteSponsors < contadorDeTiempo.getTiempoDisponible())
                    tiempoDisponible = tiempoRestanteSponsors;
                else
                    tiempoDisponible = contadorDeTiempo.getTiempoDisponible();

                if (muleto.duracion <= tiempoDisponible){ //si entra, pongo el muleto entero

                    tiempoRestanteSponsors=tiempoRestanteSponsors-muleto.duracion;
                    muleto_nuevo.mediaOptions=muleto.duracion;
                    contadorDeTiempo.descontarTiempo(muleto.duracion);
                }else { // si no entra pongo de esta pauta solo el tiempo restante

                    tiempoRestanteSponsors =  0;
                    contadorDeTiempo.descontarTiempo(tiempoDisponible);
                    muleto_nuevo.mediaOptions=tiempoDisponible;
                }
                pautas.push(muleto_nuevo);
                indice_muletos=indice_muletos+1;
                indice_muletos=(indice_muletos % muletos.length ); //para que no desborde de la lista, si llega al final vuelvea cero
            } else {
                tiempoRestanteSponsors =  0;
            }
        }
    },
    mostrarLista: function(lista){
        var ret=" | ";
        var duracion=0;
        _.each(lista,function(pauta){
            ret=ret+"Pauta: "+pauta.nombreArchivo;
            ret=ret+" reproduce: "+pauta.mediaOptions+" | ";
            duracion=duracion+pauta.mediaOptions;
        });

        ret=ret+"\n Tiempo total del segmento: "+duracion+" segundos";
        return ret;
    },
    pathYversion2NombreArchivo:pathYversion2NombreArchivo,
    /** Metodo que hace merge de listas de listas de pautas, donde el orden de las listas es la prioridad,
     *  y el orden de las sublistas es la prioridad de las pautas */
    mergePautas : function(listas) {

        var indice = 0;
        var listaFinal = [];

        while (listas.length > 0) {
            var lista = listas[indice];
            if (lista.length > 0) {
                var pauta = lista[0];
                // guardo la pauta en la lista final
                listaFinal.push(pauta);
                lista=lista.splice(0,1);
                indice++;
            } else {
                listas.splice(indice,1);
                // no aumento el indice porque sino pierdo un elemento
            }
            if (listas.length != 0)
                indice = (indice % listas.length); // para que no desborde de la lista, si llega al final vuelvea cero
        }
        return listaFinal;

    }
}

module.exports=utilsModule;