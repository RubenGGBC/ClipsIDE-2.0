/*
 * spike.c — comprueba el puente contra un programa CLIPS de verdad.
 *
 * Es el mismo recorrido que hará el IDE: cargar, reset, mirar la agenda,
 * disparar una sola regla, y volver a mirar. Si esto pasa en nativo, lo
 * único que queda por demostrar es que emcc produce el mismo resultado.
 */

#include <stdio.h>
#include <string.h>
#include <stdbool.h>

extern bool        cw_init(void);
extern void        cw_destroy(void);
extern const char *cw_output(void);
extern void        cw_output_clear(void);
extern bool        cw_load(const char *text);
extern int         cw_eval(const char *command);
extern void        cw_reset(void);
extern int         cw_run(int limit);
extern const char *cw_facts_json(void);
extern const char *cw_agenda_json(void);
extern const char *cw_templates_json(void);

static int failures = 0;

static void check(const char *label,bool condition,const char *detail)
  {
   printf("%s %s", condition ? "  ok  " : "FALLO ", label);
   if (! condition && detail != NULL) printf("  <- %s", detail);
   printf("\n");
   if (! condition) failures++;
  }

static const char *PROGRAM =
  "(deftemplate persona (slot nombre) (slot edad))\n"
  "(defrule saludar\n"
  "   (persona (nombre ?n) (edad ?e&:(> ?e 17)))\n"
  "   =>\n"
  "   (printout t \"hola \" ?n crlf)\n"
  "   (assert (adulto ?n)))\n"
  "(deffacts iniciales\n"
  "   (persona (nombre ana) (edad 20))\n"
  "   (persona (nombre luis) (edad 12)))\n";

int main(void)
  {
   check("cw_init crea el entorno",cw_init(),NULL);

   cw_output_clear();
   check("cw_load acepta el programa",cw_load(PROGRAM),cw_output());

   const char *templates = cw_templates_json();
   check("cw_templates_json ve el template persona",
         strstr(templates,"\"persona\"") != NULL,templates);
   check("cw_templates_json ve sus slots",
         strstr(templates,"\"nombre\"") != NULL &&
         strstr(templates,"\"edad\"") != NULL,templates);

   cw_reset();

   const char *facts = cw_facts_json();
   check("tras reset hay hechos de deffacts",
         strstr(facts,"ana") != NULL && strstr(facts,"luis") != NULL,facts);

   const char *agenda = cw_agenda_json();
   check("la agenda contiene la regla saludar",
         strstr(agenda,"saludar") != NULL,agenda);
   check("luis (12 anios) no activa la regla",
         strstr(agenda,"luis") == NULL,agenda);

   cw_output_clear();
   long long fired = cw_run(1);
   check("cw_run(1) dispara exactamente una regla",fired == 1,NULL);
   check("la salida del printout se captura",
         strstr(cw_output(),"hola ana") != NULL,cw_output());

   facts = cw_facts_json();
   check("el disparo ha creado el hecho adulto",
         strstr(facts,"adulto") != NULL,facts);

   cw_output_clear();
   check("cw_eval ejecuta un comando del REPL",cw_eval("(+ 2 3)") == 0,NULL);

   cw_output_clear();
   check("un error de sintaxis no revienta el proceso",
         cw_load("(defrule rota (foo) =>") == false,NULL);
   check("y el error queda capturado como texto",
         strlen(cw_output()) > 0,"la salida estaba vacia");

   cw_destroy();
   check("cw_destroy libera la salida capturada",
         strlen(cw_output()) == 0,cw_output());
   check("cw_init recrea el entorno tras destruirlo",cw_init(),NULL);
   check("el entorno recreado acepta el programa",cw_load(PROGRAM),cw_output());
   cw_reset();
   check("el entorno recreado sigue siendo util",cw_run(1) == 1,NULL);
   cw_destroy();

   printf("\n%s (%d fallos)\n", failures == 0 ? "SPIKE OK" : "SPIKE KO", failures);
   return failures == 0 ? 0 : 1;
  }
