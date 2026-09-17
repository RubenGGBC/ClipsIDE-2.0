/*
 * spike.mjs — el mismo recorrido que spike.c, pero cruzando la frontera WASM.
 * Si esto pasa, el núcleo del IDE es viable en el navegador.
 */

import createModule from '../build/clips.mjs';

const mod = await createModule();

// Envolvemos las funciones del puente. Las que devuelven `string` ya las
// convierte Emscripten desde el puntero a char*.
const cw = {
  init:        mod.cwrap('cw_init',        'boolean', []),
  output:      mod.cwrap('cw_output',      'string',  []),
  outputClear: mod.cwrap('cw_output_clear','null',    []),
  load:        mod.cwrap('cw_load',        'boolean', ['string']),
  eval:        mod.cwrap('cw_eval',        'number',  ['string']),
  reset:       mod.cwrap('cw_reset',       'null',    []),
  run:         mod.cwrap('cw_run',         'number',  ['number']),
  facts:       () => JSON.parse(mod.cwrap('cw_facts_json',     'string', [])()),
  agenda:      () => JSON.parse(mod.cwrap('cw_agenda_json',    'string', [])()),
  templates:   () => JSON.parse(mod.cwrap('cw_templates_json', 'string', [])()),
};

let failures = 0;
const check = (label, condition, detail) => {
  console.log(`${condition ? '  ok  ' : 'FALLO '} ${label}${condition || !detail ? '' : `  <- ${detail}`}`);
  if (!condition) failures++;
};

const PROGRAM = `
(deftemplate persona (slot nombre) (slot edad))
(defrule saludar
   (persona (nombre ?n) (edad ?e&:(> ?e 17)))
   =>
   (printout t "hola " ?n crlf)
   (assert (adulto ?n)))
(deffacts iniciales
   (persona (nombre ana) (edad 20))
   (persona (nombre luis) (edad 12)))
`;

check('cw_init crea el entorno', cw.init());

cw.outputClear();
check('cw_load acepta el programa', cw.load(PROGRAM), cw.output());

const templates = cw.templates();
const persona = templates.find(t => t.name === 'persona');
check('cw_templates_json ve el template persona', persona !== undefined, JSON.stringify(templates));
check('y devuelve sus slots como array', JSON.stringify(persona?.slots) === '["nombre","edad"]', JSON.stringify(persona));

cw.reset();

const facts = cw.facts();
check('tras reset hay 2 hechos persona', facts.filter(f => f.template === 'persona').length === 2, JSON.stringify(facts));
check('los hechos traen su texto legible', /ana/.test(facts.map(f => f.text).join(' ')), JSON.stringify(facts));

const ana = facts.find(f => f.text.includes('ana'));
check('cada hecho trae sus slots por separado', JSON.stringify(ana?.slots) === '{"nombre":"ana","edad":"20"}', JSON.stringify(ana));

const agenda = cw.agenda();
check('la agenda tiene 1 activacion de saludar', agenda.length === 1 && agenda[0].rule === 'saludar', JSON.stringify(agenda));
check('la activacion trae su salience', agenda[0]?.salience === 0, JSON.stringify(agenda));

cw.outputClear();
check('cw_run(1) dispara exactamente una regla', cw.run(1) === 1);
check('la salida del printout se captura', cw.output().includes('hola ana'), JSON.stringify(cw.output()));

check('el disparo creo el hecho adulto', cw.facts().some(f => f.template === 'adulto'), JSON.stringify(cw.facts()));

cw.outputClear();
check('cw_eval ejecuta un comando del REPL', cw.eval('(+ 2 3)') === 0);

cw.outputClear();
check('un error de sintaxis no tumba el modulo', cw.load('(defrule rota (foo) =>') === false);
check('y el error queda capturado como texto', cw.output().length > 0, 'la salida estaba vacia');

// Lo que hace posible el boton Stop: un bucle infinito debe poder cortarse
// desde fuera. Aqui solo comprobamos que el limite de pasos se respeta.
cw.outputClear();
cw.load('(defrule contar (declare (salience -10)) ?f <- (n ?x) => (retract ?f) (assert (n (+ ?x 1))))');
cw.eval('(assert (n 0))');
check('cw_run respeta el limite de disparos', cw.run(5) === 5);

console.log(`\n${failures === 0 ? 'SPIKE WASM OK' : 'SPIKE WASM KO'} (${failures} fallos)`);
process.exit(failures === 0 ? 0 : 1);
