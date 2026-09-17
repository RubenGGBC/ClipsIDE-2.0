/*
 * clips_bridge.c — puente entre el núcleo CLIPS 6.4 y el mundo exterior.
 *
 * Expone una API plana, sin punteros a estructuras de CLIPS, pensada para
 * cruzar la frontera WASM/JS. Devuelve JSON en cadenas propiedad del puente:
 * quien llama debe leerlas antes de la siguiente llamada.
 *
 * El mismo fichero compila a WASM (emcc) y a librería nativa (cc), así que
 * aquí no puede haber nada específico del navegador.
 */

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "clips.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

/* ------------------------------------------------------------------ */
/* Buffer de texto que crece solo                                      */
/* ------------------------------------------------------------------ */

typedef struct
  {
   char *data;
   size_t length;
   size_t capacity;
  } Buffer;

static void BufferInit(Buffer *b)
  {
   b->capacity = 1024;
   b->data = (char *) malloc(b->capacity);
   b->data[0] = '\0';
   b->length = 0;
  }

static void BufferReset(Buffer *b)
  {
   b->length = 0;
   if (b->data != NULL) b->data[0] = '\0';
  }

static void BufferAppendN(Buffer *b,const char *text,size_t n)
  {
   if (b->data == NULL) BufferInit(b);

   if (b->length + n + 1 > b->capacity)
     {
      while (b->length + n + 1 > b->capacity) b->capacity *= 2;
      b->data = (char *) realloc(b->data,b->capacity);
     }

   memcpy(b->data + b->length,text,n);
   b->length += n;
   b->data[b->length] = '\0';
  }

static void BufferAppend(Buffer *b,const char *text)
  {
   if (text != NULL) BufferAppendN(b,text,strlen(text));
  }

static void BufferAppendChar(Buffer *b,char c)
  {
   BufferAppendN(b,&c,1);
  }

static void BufferAppendLong(Buffer *b,long long value)
  {
   char tmp[32];
   snprintf(tmp,sizeof(tmp),"%lld",value);
   BufferAppend(b,tmp);
  }

/* Añade `text` como cadena JSON entrecomillada y escapada. */
static void BufferAppendJSONString(Buffer *b,const char *text)
  {
   BufferAppendChar(b,'"');

   if (text != NULL)
     {
      for (const unsigned char *p = (const unsigned char *) text; *p != '\0'; p++)
        {
         switch (*p)
           {
            case '"':  BufferAppend(b,"\\\""); break;
            case '\\': BufferAppend(b,"\\\\"); break;
            case '\n': BufferAppend(b,"\\n");  break;
            case '\r': BufferAppend(b,"\\r");  break;
            case '\t': BufferAppend(b,"\\t");  break;
            default:
              if (*p < 0x20)
                {
                 char esc[8];
                 snprintf(esc,sizeof(esc),"\\u%04x",*p);
                 BufferAppend(b,esc);
                }
              else
                { BufferAppendChar(b,(char) *p); }
           }
        }
     }

   BufferAppendChar(b,'"');
  }

/* ------------------------------------------------------------------ */
/* Estado global del puente                                            */
/* ------------------------------------------------------------------ */

static Environment *theEnv = NULL;
static Buffer captured;   /* todo lo que CLIPS imprime */
static Buffer result;     /* JSON de la última consulta */

#define CAPTURE_ROUTER "cw-capture"

/* Capturamos solo los tres flujos de usuario. Es tentador quedarse con todo
   lo que se imprima, pero CLIPS usa nombres lógicos internos para cosas como
   FactPPForm: si se los robamos, esas funciones devuelven cadenas vacías. */
static bool CaptureQuery(
  Environment *env,
  const char *logicalName,
  void *context)
  {
   (void) env; (void) context;

   if (logicalName == NULL) return false;

   return strcmp(logicalName,STDOUT) == 0 ||
          strcmp(logicalName,STDERR) == 0 ||
          strcmp(logicalName,STDWRN) == 0;
  }

static void CaptureWrite(
  Environment *env,
  const char *logicalName,
  const char *str,
  void *context)
  {
   (void) env; (void) logicalName; (void) context;

   BufferAppend(&captured,str);
  }

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

EXPORT bool cw_init(void)
  {
   if (theEnv != NULL) return true;

   BufferInit(&captured);
   BufferInit(&result);

   theEnv = CreateEnvironment();
   if (theEnv == NULL) return false;

   AddRouter(theEnv,CAPTURE_ROUTER,40,
             CaptureQuery,CaptureWrite,
             NULL,NULL,NULL,NULL);

   return true;
  }

EXPORT void cw_destroy(void)
  {
   if (theEnv == NULL) return;

   DestroyEnvironment(theEnv);
   theEnv = NULL;
  }

/* ------------------------------------------------------------------ */
/* Salida capturada                                                    */
/* ------------------------------------------------------------------ */

EXPORT const char *cw_output(void)
  {
   return captured.data != NULL ? captured.data : "";
  }

EXPORT void cw_output_clear(void)
  {
   BufferReset(&captured);
  }

/* ------------------------------------------------------------------ */
/* Comandos                                                            */
/* ------------------------------------------------------------------ */

/* Carga construcciones desde memoria. Devuelve true si no hubo error. */
EXPORT bool cw_load(const char *text)
  {
   if (theEnv == NULL || text == NULL) return false;

   return LoadFromString(theEnv,text,strlen(text));
  }

/* Evalúa un comando del REPL. Devuelve el código de EvalError (0 = OK). */
EXPORT int cw_eval(const char *command)
  {
   CLIPSValue ignored;

   if (theEnv == NULL || command == NULL) return -1;

   return (int) Eval(theEnv,command,&ignored);
  }

EXPORT void cw_reset(void)
  {
   if (theEnv != NULL) Reset(theEnv);
  }

EXPORT void cw_clear(void)
  {
   if (theEnv != NULL) Clear(theEnv);
  }

/* limit = -1 ejecuta hasta agotar la agenda; 1 dispara una sola regla,
   que es lo que hace posible el paso a paso. Devuelve reglas disparadas.
   Usamos int y no el long long de Run a propósito: los enteros de 64 bits
   cruzan a JavaScript como BigInt y contaminarían toda la UI. Dos mil
   millones de disparos son más de los que ninguna práctica va a necesitar. */
EXPORT int cw_run(int limit)
  {
   if (theEnv == NULL) return 0;

   return (int) Run(theEnv,(long long) limit);
  }

/* ------------------------------------------------------------------ */
/* Introspección                                                       */
/* ------------------------------------------------------------------ */

/* Convierte un valor de slot en texto, usando el mismo truco que CLIPS para
   sus propias funciones de impresión: un destino temporal de StringBuilder. */
static void AppendSlotValue(
  Buffer *out,
  StringBuilder *sb,
  CLIPSValue *value)
  {
   SBReset(sb);
   OpenStringBuilderDestination(theEnv,"cw-slot",sb);
   WriteCLIPSValue(theEnv,"cw-slot",value);
   CloseStringBuilderDestination(theEnv,"cw-slot");

   BufferAppendJSONString(out,sb->contents != NULL ? sb->contents : "");
  }

EXPORT const char *cw_facts_json(void)
  {
   BufferReset(&result);

   if (theEnv == NULL) { BufferAppend(&result,"[]"); return result.data; }

   StringBuilder *sb = CreateStringBuilder(theEnv,256);
   BufferAppendChar(&result,'[');

   bool first = true;
   for (Fact *f = GetNextFact(theEnv,NULL); f != NULL; f = GetNextFact(theEnv,f))
     {
      if (! first) BufferAppendChar(&result,',');
      first = false;

      SBReset(sb);
      FactPPForm(f,sb,false);

      BufferAppend(&result,"{\"index\":");
      BufferAppendLong(&result,FactIndex(f));
      BufferAppend(&result,",\"template\":");
      BufferAppendJSONString(&result,DeftemplateName(f->whichDeftemplate));
      BufferAppend(&result,",\"text\":");
      BufferAppendJSONString(&result,sb->contents);

      /* Los valores slot a slot: es lo que permite pintar los hechos como
         una tabla con una columna por slot en vez de como texto plano.
         Los hechos ordenados —(a b c), sin template— tienen un único slot
         llamado "implied" que no aporta nada, así que lo dejamos fuera. */
      CLIPSValue slotNames;
      FactSlotNames(f,&slotNames);

      BufferAppend(&result,",\"slots\":{");

      if (slotNames.header->type == MULTIFIELD_TYPE)
        {
         Multifield *names = slotNames.multifieldValue;
         bool firstSlot = true;

         for (size_t i = 0; i < names->length; i++)
           {
            const char *slotName = names->contents[i].lexemeValue->contents;
            if (strcmp(slotName,"implied") == 0) continue;

            CLIPSValue slotValue;
            if (GetFactSlot(f,slotName,&slotValue) != GSE_NO_ERROR) continue;

            if (! firstSlot) BufferAppendChar(&result,',');
            firstSlot = false;

            BufferAppendJSONString(&result,slotName);
            BufferAppendChar(&result,':');
            AppendSlotValue(&result,sb,&slotValue);
           }
        }

      BufferAppend(&result,"}}");
     }

   BufferAppendChar(&result,']');
   SBDispose(sb);

   return result.data;
  }

EXPORT const char *cw_agenda_json(void)
  {
   BufferReset(&result);

   if (theEnv == NULL) { BufferAppend(&result,"[]"); return result.data; }

   StringBuilder *sb = CreateStringBuilder(theEnv,256);
   BufferAppendChar(&result,'[');

   bool first = true;
   for (Activation *a = GetNextActivation(theEnv,NULL);
        a != NULL;
        a = GetNextActivation(theEnv,a))
     {
      if (! first) BufferAppendChar(&result,',');
      first = false;

      SBReset(sb);
      ActivationPPForm(a,sb);

      BufferAppend(&result,"{\"rule\":");
      BufferAppendJSONString(&result,ActivationRuleName(a));
      BufferAppend(&result,",\"salience\":");
      BufferAppendLong(&result,(long long) ActivationGetSalience(a));
      BufferAppend(&result,",\"text\":");
      BufferAppendJSONString(&result,sb->contents);
      BufferAppendChar(&result,'}');
     }

   BufferAppendChar(&result,']');
   SBDispose(sb);

   return result.data;
  }

/* Los templates definidos, con sus slots: es la materia prima del
   autocompletado consciente del contexto. */
EXPORT const char *cw_templates_json(void)
  {
   BufferReset(&result);

   if (theEnv == NULL) { BufferAppend(&result,"[]"); return result.data; }

   BufferAppendChar(&result,'[');

   bool first = true;
   for (Deftemplate *t = GetNextDeftemplate(theEnv,NULL);
        t != NULL;
        t = GetNextDeftemplate(theEnv,t))
     {
      if (! first) BufferAppendChar(&result,',');
      first = false;

      CLIPSValue slots;
      DeftemplateSlotNames(t,&slots);

      BufferAppend(&result,"{\"name\":");
      BufferAppendJSONString(&result,DeftemplateName(t));
      BufferAppend(&result,",\"slots\":[");

      if (slots.header->type == MULTIFIELD_TYPE)
        {
         Multifield *mf = slots.multifieldValue;
         for (size_t i = 0; i < mf->length; i++)
           {
            if (i > 0) BufferAppendChar(&result,',');
            BufferAppendJSONString(&result,mf->contents[i].lexemeValue->contents);
           }
        }

      BufferAppend(&result,"]}");
     }

   BufferAppendChar(&result,']');

   return result.data;
  }
