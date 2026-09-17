/*
 * El proyecto con el que arranca el IDE la primera vez.
 *
 * No es un "hola mundo": es un diagnóstico pequeño pero completo, con
 * salience, encadenamiento de reglas y un retract, para que al pulsar Paso
 * se vea de verdad cómo la agenda se reordena y la memoria de trabajo cambia.
 */

export const EXAMPLE_PROJECT = [
  {
    name: 'averias.clp',
    text: `; Diagnóstico de un coche que no arranca.
; Pulsa Ejecutar para ver el resultado, o Paso para ir regla a regla.

(deftemplate sintoma
   (slot nombre)
   (slot presente (allowed-values si no)))

(deftemplate diagnostico
   (slot causa)
   (slot confianza))

(defrule bateria-descargada
   (sintoma (nombre motor-no-gira) (presente si))
   (sintoma (nombre luces-debiles) (presente si))
   =>
   (printout t "Las luces débiles con el motor parado apuntan a la batería." crlf)
   (assert (diagnostico (causa bateria) (confianza alta))))

(defrule sin-combustible
   (sintoma (nombre motor-gira) (presente si))
   (sintoma (nombre deposito-vacio) (presente si))
   =>
   (assert (diagnostico (causa combustible) (confianza alta))))

(defrule informar
   (declare (salience -10))
   ?d <- (diagnostico (causa ?c) (confianza ?nivel))
   =>
   (printout t "Diagnóstico: " ?c " (confianza " ?nivel ")" crlf)
   (retract ?d))
`,
  },
  {
    name: 'caso.clp',
    text: `; Los síntomas del caso concreto que estamos diagnosticando.
; Cambia algún "si" por "no" y vuelve a ejecutar para ver otra rama.

(deffacts caso-actual
   (sintoma (nombre motor-no-gira) (presente si))
   (sintoma (nombre luces-debiles) (presente si))
   (sintoma (nombre motor-gira) (presente no))
   (sintoma (nombre deposito-vacio) (presente no)))
`,
  },
];
