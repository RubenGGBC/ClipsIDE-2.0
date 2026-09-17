# Núcleo CLIPS + puente, con dos objetivos desde el mismo fuente:
#
#   make spike   -> binario nativo de prueba (compilador del sistema)
#   make wasm    -> módulo WebAssembly para el navegador (emcc)
#
# Que ambos salgan del mismo código es deliberado: mantiene abierta la
# puerta a una app de escritorio sin reescribir el motor.

VENDOR     := vendor/clips
BUILD      := build
CLIPS_SRCS := $(wildcard $(VENDOR)/*.c)
BRIDGE     := src/clips_bridge.c

CFLAGS := -I$(VENDOR) -O2 -std=c99 -Wall -Wno-unused-parameter -Wno-unused-but-set-variable

# Funciones del puente visibles desde JavaScript. En una sola línea a
# propósito: emcc no tolera espacios dentro de la lista.
EXPORTS := _cw_init,_cw_destroy,_cw_output,_cw_output_clear,_cw_load,_cw_eval,_cw_reset,_cw_clear,_cw_run,_cw_facts_json,_cw_agenda_json,_cw_templates_json,_malloc,_free

EMFLAGS := -sMODULARIZE=1 \
           -sEXPORT_ES6=1 \
           -sENVIRONMENT=worker,web,node \
           -sALLOW_MEMORY_GROWTH=1 \
           -sEXPORTED_FUNCTIONS=$(EXPORTS) \
           -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToNewUTF8 \
           -sSTACK_SIZE=1048576

.PHONY: all spike wasm clean

all: wasm

$(BUILD):
	mkdir -p $(BUILD)

spike: | $(BUILD)
	cc $(CFLAGS) $(CLIPS_SRCS) $(BRIDGE) test/spike.c -o $(BUILD)/spike -lm

wasm: | $(BUILD)
	emcc $(CFLAGS) $(EMFLAGS) $(CLIPS_SRCS) $(BRIDGE) -o $(BUILD)/clips.mjs

clean:
	rm -rf $(BUILD)
